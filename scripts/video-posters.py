"""Store covers for the YouTube videos embedded in the captured site."""
from pathlib import Path
import re, urllib.request
from concurrent.futures import ThreadPoolExecutor

root = Path(__file__).resolve().parents[1] / 'public'
ids = set()
for page in root.rglob('*.html'):
    html = page.read_text(encoding='utf-8')
    ids.update(re.findall(r'youtube\.com/embed/([\w-]{11})', html))
    ids.update(re.findall(r'data-bs-id="([\w-]{11})"', html))
dest = root / 'assets/video-posters'
dest.mkdir(exist_ok=True, parents=True)
def download(id):
    for quality in ['maxresdefault', 'hqdefault']:
        try:
            with urllib.request.urlopen(f'https://i.ytimg.com/vi/{id}/{quality}.jpg', timeout=20) as response:
                (dest / f'{id}.jpg').write_bytes(response.read())
            return id + ': OK'
        except Exception:
            pass
    return id + ': FAILED'
with ThreadPoolExecutor(max_workers=6) as pool:
    for result in pool.map(download, sorted(ids)): print(result, flush=True)
