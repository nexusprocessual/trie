import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {createServer} from '../server.mjs';

const server = createServer();
let origin;
before(async () => { await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
after(() => new Promise(resolve => server.close(resolve)));

test('Every captured route and HTML resource resolves locally', async () => {
  const routes = JSON.parse(await readFile('routes.json','utf8'));
  const resources = new Set();
  for (const [route,file] of Object.entries(routes)) {
    const response = await fetch(origin+route);
    assert.equal(response.status,200,route);
    const html = await response.text();
    assert.ok(/<html\b[^>]*lang="pt-br"/i.test(html), `Invalid HTML at ${route}`);
    assert.doesNotMatch(html, /src=["']https:\/\/triesolucoes\.com/);
    for (const tag of html.matchAll(/<(?:img|script|link)\b[^>]*>/gi)) {
      if (tag[0].includes('preconnect') || tag[0].includes('canonical')) continue;
      for (const match of tag[0].matchAll(/(?:src|href|data-src)=["']([^"']+)["']/gi)) {
        const url = new URL(match[1],origin+'/');
        if (url.origin===origin) resources.add(url.pathname);
      }
    }
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
      const url = new URL(match[1].replaceAll('&amp;','&'),origin+'/');
      if (url.origin===origin && !url.pathname.startsWith('/assets/')) {
        assert.ok(routes[url.pathname+url.search] || routes[url.pathname], `Unresolved internal link in ${file}: ${url.href}`);
      }
    }
  }
  for (const resource of resources) {
    await access(path.join('public',decodeURIComponent(resource)));
    const response = await fetch(origin+resource);
    assert.equal(response.status,200,resource);
  }
});

test('Unknown routes, server files and external submissions stay unavailable', async () => {
  for (const route of ['/missing-page','/server.mjs','/package.json','/%2e%2e%5cserver.mjs']) {
    const res = await fetch(origin+route);
    assert.ok([403,404].includes(res.status),route);
  }
  const response = await fetch(origin+'/simulacao',{method:'POST',body:'test'});
  assert.equal(response.status,405);
});

test('Pagination routes serve distinct content', async () => {
  const [first,second] = await Promise.all(['/blog/categoria/trie','/blog/categoria/trie?page=2'].map(async route => (await fetch(origin+route)).text()));
  assert.notEqual(first,second);
});

test('Every embedded and modal video has a locally available cover', async () => {
  const routes = JSON.parse(await readFile('routes.json','utf8'));
  const ids = new Set();
  for(const file of Object.values(routes)) {
    const html = await readFile(path.join('public',file),'utf8');
    for(const m of html.matchAll(/(?:youtube\.com\/embed\/|data-bs-id=")([\w-]{11})/g)) ids.add(m[1]);
  }
  assert.ok(ids.size >= 2);
  for(const id of ids) {
    const response = await fetch(`${origin}/assets/video-posters/${id}.jpg`);
    assert.equal(response.status,200,id);
    const data = new Uint8Array(await response.arrayBuffer());
    assert.equal(data[0],0xff,id);
    assert.equal(data[1],0xd8,id);
    assert.ok(data.length>1000,id);
  }
});
