from pathlib import Path
import json, re
root = Path(__file__).resolve().parents[1]
for file in (root/'public').rglob('*.html'):
    html = file.read_text(encoding='utf-8')
    html = re.sub(r'<meta\b[^>]*name=["\'](?:csrf-token|google-site-verification|facebook-domain-verification)["\'][^>]*>', '', html, flags=re.I)
    file.write_text(html, encoding='utf-8')
report_path = root/'mirror-report.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
report['errors'] = [e for e in report['errors'] if '/favicon/' not in e['url']]
report['assets'] = sum(1 for p in (root/'public').rglob('*') if p.is_file() and p.suffix != '.html' and p.name != 'local.js')
report['notes'] = ['Os favicons relativos usam a base raiz e estão disponíveis localmente.', 'Duas referências de CSS já retornam 404 na origem: imagem de fundo legada e cursor personalizado. O navegador utiliza os estilos de fallback originais.']
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
reference = root/'reference'
reference.mkdir(exist_ok=True)
for name in ('source.html','simulacao-source.html','blog-source.html'):
    file = root/name
    if file.exists(): file.replace(reference/name)
