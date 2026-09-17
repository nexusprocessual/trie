import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {readSettings,configureWhatsApp} from '../settings.mjs';
import {supabaseFromEnv} from '../supabase.mjs';
try{process.loadEnvFile();}catch{}
await mkdir('dist', {recursive:true});
await cp('public','dist',{recursive:true});
const routes = JSON.parse(await readFile('routes.json','utf8'));
const settings=await readSettings('data/settings.json',supabaseFromEnv());
await mkdir('dist/api',{recursive:true});
await writeFile('dist/api/settings.json',JSON.stringify(settings));
// Static hosts do not resolve pagination query strings to separate files.
for (const file of Object.values(routes)) {
  let html = await readFile('dist/'+file,'utf8');
  for (const [route,target] of Object.entries(routes)) {
    if (route.includes('?')) html = html.replaceAll(`href="${route}"`, `href="/${target}"`);
  }
  await writeFile('dist/'+file,configureWhatsApp(html,settings));
}
const redirects = Object.entries(routes).filter(([route])=>!route.includes('?')).map(([route,file])=>`${route} /${file} 200`).join('\n');
await writeFile('dist/_redirects',redirects+'\n');
console.log(`Build pronto: ${Object.keys(routes).length} páginas em dist/.`);
