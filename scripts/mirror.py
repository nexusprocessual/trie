"""Capture the publicly linked Triê pages and their presentation assets."""
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
import re, json, hashlib, time

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
ORIGIN = 'https://triesolucoes.com'
assets, pages, errors = {}, {}, []

def normalize(url):
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path or '/', p.query if p.path.startswith('/blog') else '', ''))

def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=35) as r:
                return r.read(), r.headers.get('Content-Type', ''), r.url
        except Exception as e:
            if attempt == 2: return None, str(e), url
            time.sleep(0.4)

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.assets = []; self.links = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and a.get('href'): self.links.append(a['href'])
        if tag in ('img', 'script', 'source'):
            for key in ('src', 'data-src'):
                if a.get(key): self.assets.append(a[key])
        if tag == 'link' and a.get('rel') in ('stylesheet', 'icon', 'apple-touch-icon'):
            self.assets.append(a.get('href', ''))

def asset_path(url):
    p = urlsplit(url)
    if p.netloc == 'triesolucoes.com': return p.path
    suffix = Path(p.path).suffix
    if p.netloc == 'fonts.googleapis.com': suffix = '.css'
    return '/assets/external/' + p.netloc + '/' + hashlib.sha256(url.encode()).hexdigest()[:16] + suffix

def queue_asset(url, base):
    url = urljoin(base, url.strip())
    if not url.startswith('https://'): return
    if urlsplit(url).netloc not in ('triesolucoes.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'i.ytimg.com'): return
    assets.setdefault(url, asset_path(url))

def clean(html, url):
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'<base\b[^>]*>', '<base href="/">', html, flags=re.I)
    # Production analytics and server session tokens do not belong in a local copy.
    html = re.sub(r'<script\b[^>]*>.*?</script>', lambda m: '' if any(x in m[0] for x in ('googletagmanager', 'clarity.ms', 'cloudfront.net/js/loader-scripts')) else m[0], html, flags=re.S|re.I)
    html = re.sub(r'<input\b[^>]*name=["\'](?:_token|gclid|gclid_time)["\'][^>]*>', '', html, flags=re.I)
    html = re.sub(r'<meta\b[^>]*name=["\'](?:csrf-token|google-site-verification|facebook-domain-verification)["\'][^>]*>', '', html, flags=re.I)
    html = html.replace('https://triesolucoes.com', '')
    html = re.sub(r'href=["\']["\']', 'href="/"', html)
    if urlsplit(url).path != '/': html = html.replace('href="#depoimentos"', 'href="/#depoimentos"')
    return html.replace('</body>', '<script src="/local.js"></script>\n</body>')

pending = [ORIGIN+'/', ORIGIN+'/simulacao', ORIGIN+'/blog', ORIGIN+'/politica-de-privacidade', ORIGIN+'/termos-de-uso']
while pending:
    batch = [u for u in dict.fromkeys(pending) if u not in pages]; pending = []
    if not batch: break
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(get, batch))
    for url, (data, mime, final) in zip(batch, results):
        if data is None:
            errors.append({'url':url, 'error':mime}); pages[url] = None; continue
        if 'text/html' not in mime: continue
        html = data.decode('utf-8', errors='replace')
        parser = Links(); parser.feed(re.sub(r'<!--.*?-->', '', html, flags=re.S))
        path = urlsplit(url).path
        filename = path.strip('/') + '/index.html' if path != '/' else 'index.html'
        if urlsplit(url).query: filename = path.strip('/') + '/query-' + hashlib.sha256(urlsplit(url).query.encode()).hexdigest()[:12] + '.html'
        pages[url] = {'file':filename, 'html':clean(html,url)}
        base_match = re.search(r'<base\b[^>]*href=["\']([^"\']+)', html, re.I)
        asset_base = base_match[1] if base_match else url
        for a in parser.assets: queue_asset(a, asset_base)
        for a in re.findall(r'url\(["\']?([^\)"\']+)', html): queue_asset(a, url)
        for link in parser.links:
            u = normalize(urljoin(url, link))
            p = urlsplit(u)
            if p.netloc == 'triesolucoes.com' and (p.path in ('/', '/simulacao','/blog','/quem-somos','/politica-de-privacidade','/termos-de-uso') or p.path.startswith(('/post/', '/blog/categoria/'))):
                if u not in pages: pending.append(u)
    print(f'Pages: {len(pages)}, assets discovered: {len(assets)}', flush=True)

done = set()
while todo := [u for u in assets if u not in done]:
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(get, todo))
    for url, (data,mime,final) in zip(todo, results):
        done.add(url)
        if data is None:
            errors.append({'url':url,'error':mime}); continue
        dest = PUBLIC / assets[url].lstrip('/'); dest.parent.mkdir(parents=True, exist_ok=True)
        if 'text/css' in mime or dest.suffix == '.css':
            css = data.decode('utf-8',errors='replace')
            def replace(m):
                value = m[1].strip(' \"\'')
                if value.startswith('data:'): return m[0]
                u = urljoin(url, value); queue_asset(u, url)
                return 'url("'+assets.get(u, u)+'")'
            css = re.sub(r'url\(([^)]+)\)',replace,css)
            data = css.encode('utf-8')
        dest.write_bytes(data)
    print(f'Assets saved: {len(done)}/{len(assets)}', flush=True)

routes = {}
for url, entry in pages.items():
    if not entry: continue
    html = entry.pop('html')
    for remote, local in assets.items():
        if not remote.startswith(ORIGIN): html = html.replace(remote.replace('&','&amp;'),local).replace(remote,local)
    # Legacy campaign CTA leads into the same local simulator.
    html = re.sub(r'href="/c/[^\"]+"', 'href="/simulacao"', html)
    dest = PUBLIC / entry['file']; dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(html,encoding='utf-8')
    p = urlsplit(url); routes[p.path + ('?'+p.query if p.query else '')] = entry['file']
(ROOT / 'routes.json').write_text(json.dumps(routes,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT / 'mirror-report.json').write_text(json.dumps({'source':ORIGIN,'pages':len(routes),'assets':len(done),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':len(routes),'assets':len(done),'errors':errors},ensure_ascii=False),flush=True)
