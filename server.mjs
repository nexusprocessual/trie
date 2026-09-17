import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {readSettings, saveSettings, configureWhatsApp} from './settings.mjs';
import {supabaseFromEnv} from './supabase.mjs';
import {createVisitStore} from './visits.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf', '.eot':'application/vnd.ms-fontobject', '.ico':'image/x-icon' };

export function createServer({settingsFile = path.join(root,'data','settings.json'), db = supabaseFromEnv()} = {}) {
  const adminToken=randomBytes(32).toString('hex');
  const visits=createVisitStore(db);
  let cached, cachedAt=0;
  const settings=async()=>{if(!cached||Date.now()-cachedAt>30000){cached=await readSettings(settingsFile,db);cachedAt=Date.now();}return cached;};
  const validToken=req=>{const token=Buffer.from(String(req.headers['x-admin-token']||''));return token.length===adminToken.length&&timingSafeEqual(token,Buffer.from(adminToken));};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/';
      if(pathname==='/admin' || pathname.startsWith('/api/admin/')) {
        // This installation is local. Reject remote/rebound hosts and cross-origin writes.
        const host=new URL('http://'+req.headers.host).hostname;
        if(process.env.ADMIN_PUBLIC!=='true' && (!['localhost','127.0.0.1','[::1]'].includes(host) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))) return json(res,403,{message:'O painel está disponível apenas neste computador.'});
        if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return json(res,403,{message:'Origem não autorizada.'});
        if(req.headers['sec-fetch-site']==='cross-site') return json(res,403,{message:'Origem não autorizada.'});
      }
      if(pathname==='/api/settings' && req.method==='GET') return json(res,200,await settings());
      if(pathname==='/api/admin/settings') {
        if(req.method==='GET') return json(res,200,{...await settings(),token:adminToken,visitsPersistent:visits.persistent});
        if(req.method==='PUT') {
          if(!validToken(req)) return json(res,403,{message:'Recarregue o painel e tente novamente.'});
          if(!req.headers['content-type']?.startsWith('application/json')) return json(res,415,{message:'Formato de dados inválido.'});
          let body='';
          for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2048)return json(res,413,{message:'Dados excedem o limite.'});}
          let input;
          try {input=JSON.parse(body);} catch{return json(res,400,{message:'Dados inválidos.'});}
          try {cached=await saveSettings(settingsFile,input.whatsappPhone,db);cachedAt=Date.now();return json(res,200,cached);}
          catch(error){if(!error.code)return json(res,422,{message:error.message});throw error;}
        }
        return json(res,405,{message:'Método não permitido.'});
      }
      if(pathname==='/api/admin/visits') {
        if(req.method!=='GET') return json(res,405,{message:'Método não permitido.'});
        if(!validToken(req)) return json(res,403,{message:'Recarregue o painel e tente novamente.'});
        const limit=Math.min(Math.max(Number(url.searchParams.get('limit'))||200,1),1000);
        try {return json(res,200,{persistent:visits.persistent,visits:await visits.list(limit)});}
        catch(error){console.error(error);return json(res,502,{message:'Não foi possível carregar os acessos do Supabase.'});}
      }
      if (!['GET','HEAD'].includes(req.method)) {
        res.writeHead(405, {'Content-Type':'application/json; charset=utf-8', Allow:'GET, HEAD'});
        return res.end(JSON.stringify({message:'Esta cópia local não envia dados ao sistema original.'}));
      }
      const routes = JSON.parse(await readFile(path.join(root,'routes.json'),'utf8'));
      const route = routes[pathname + url.search] ?? routes[pathname];
      let file = path.resolve(publicDir, route ?? '.' + pathname);
      if (!file.startsWith(publicDir + path.sep)) { res.writeHead(403); return res.end(); }
      if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
      let data = await readFile(file);
      if(path.extname(file)==='.html') {
        data=Buffer.from(configureWhatsApp(data.toString('utf8'),await settings()));
        if(req.method==='GET' && pathname!=='/admin') visits.record(req,pathname).catch(error=>console.error('Falha ao registrar acesso:',error.message));
      }
      res.writeHead(200, {'Content-Type':types[path.extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch(error) {
      if(!['ENOENT','ENOTDIR'].includes(error.code)) return json(res,500,{message:'Não foi possível ler ou salvar a configuração. Tente novamente.'});
      res.writeHead(404, {'Content-Type':'text/html; charset=utf-8'});
      res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Página não encontrada | Triê</title><body style="font-family:Arial;padding:8vw;color:#063449"><h1>Página não encontrada</h1><p>Este endereço não está disponível na cópia local.</p><a href="/">Voltar ao início</a></body></html>');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(); } catch {}
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Triê disponível em http://localhost:${port}`));
}
