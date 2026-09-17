import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createServer} from '../server.mjs';
import {normalizePhone} from '../settings.mjs';
let directory, file, server, origin, token;
const start=async()=>{server=createServer({settingsFile:file,db:null});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;token=(await(await fetch(origin+'/api/admin/settings')).json()).token;};
before(async()=>{directory=await mkdtemp(path.join(tmpdir(),'trie-admin-test-'));file=path.join(directory,'settings.json');await start();});
after(async()=>{await new Promise(r=>server.close(r));await unlink(file).catch(()=>{});await rmdir(directory);});
const put=(value,headers={})=>fetch(origin+'/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json','X-Admin-Token':token,...headers},body:JSON.stringify({whatsappPhone:value})});

test('Brazilian numbers normalize without duplicating country code, including DDD 55',()=>{
  assert.equal(normalizePhone('(62) 99999-1234'),'5562999991234');
  assert.equal(normalizePhone('+55 (55) 99999-1234'),'5555999991234');
  assert.equal(normalizePhone('(55) 99999-1234'),'5555999991234');
  assert.equal(normalizePhone('11 3333-1234'),'551133331234');
  for(const bad of ['12','(20) 99999-1234','(11) 89999-1234','abc61999991234','<script>'])assert.throws(()=>normalizePhone(bad));
});
test('Admin saves persist across restart and change all WhatsApp destinations',async()=>{
  assert.equal((await fetch(origin+'/admin')).status,200);
  let response=await put('(62) 99999-1234');assert.equal(response.status,200);
  assert.equal(JSON.parse(await readFile(file,'utf8')).whatsappPhone,'5562999991234');
  await new Promise(r=>server.close(r));await start();
  assert.equal((await(await fetch(origin+'/api/settings')).json()).whatsappPhone,'5562999991234');
  for(const route of ['/','/blog','/quem-somos']){
    const html=await(await fetch(origin+route)).text();
    const links=[...html.matchAll(/href="https:\/\/wa.me\/([^"?]+)/g)];
    assert.ok(links.length>0);assert.ok(links.every(m=>m[1]==='5562999991234'));
    assert.ok(html.includes('Olá, quero fazer minha simulação agora!'));
  }
  response=await put('(11) 98888-4321');assert.equal(response.status,200);
  assert.equal((await(await fetch(origin+'/api/settings')).json()).whatsappPhone,'5511988884321');
});
test('Invalid, cross-origin and unauthenticated writes cannot change settings',async()=>{
  const before=await readFile(file,'utf8');
  assert.equal((await put('123')).status,422);
  assert.equal((await put('(11) 99999-1234',{'X-Admin-Token':''})).status,403);
  assert.equal((await put('(11) 99999-1234',{Origin:'https://example.com'})).status,403);
  const reboundStatus=await new Promise((resolve,reject)=>{const request=http.get(origin+'/api/admin/settings',{headers:{Host:'example.com'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);});
  assert.equal(reboundStatus,403);
  assert.equal((await fetch(origin+'/data/settings.json')).status,404);
  assert.equal(await readFile(file,'utf8'),before);
});
test('Page views are listed in the admin visits tab and require the admin token',async()=>{
  await fetch(origin+'/quem-somos');
  await new Promise(r=>setTimeout(r,50));
  assert.equal((await fetch(origin+'/api/admin/visits')).status,403);
  const data=await(await fetch(origin+'/api/admin/visits',{headers:{'X-Admin-Token':token}})).json();
  assert.equal(data.persistent,false);
  const visit=data.visits.find(v=>v.path==='/quem-somos');
  assert.ok(visit);assert.equal(visit.ip,'127.0.0.1');assert.equal(visit.city,'Rede local');assert.ok(visit.created_at);
  assert.ok(!data.visits.some(v=>v.path==='/admin'));
});
