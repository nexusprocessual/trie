import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const defaultSettings = {whatsappPhone:'5508000001461'};
const ddds = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));
export function normalizePhone(value) {
  if(typeof value!=='string' || value.length>40 || /[^\d\s()+.-]/.test(value)) throw new Error('Informe um telefone brasileiro válido.');
  let digits=value.replace(/\D/g,'');
  if(digits.startsWith('55') && digits.length>=12) digits=digits.slice(2);
  if(/^0800\d{7}$/.test(digits)) return '55'+digits;
  if(!ddds.has(digits.slice(0,2)) || !(/^[2-5]\d{7}$/.test(digits.slice(2)) || /^9\d{8}$/.test(digits.slice(2)))) {
    throw new Error('Digite o DDD e um número válido, por exemplo: (62) 99999-9999.');
  }
  return '55'+digits;
}
export async function readSettings(file, db) {
  if(db) {
    const value=await db.getSetting('whatsappPhone');
    return value ? {whatsappPhone:normalizePhone(value)} : {...defaultSettings};
  }
  try {
    const data=JSON.parse(await readFile(file,'utf8'));
    return {whatsappPhone:normalizePhone(data.whatsappPhone)};
  } catch(error) { if(error.code==='ENOENT') return {...defaultSettings}; throw error; }
}
export async function saveSettings(file, value, db) {
  const settings={whatsappPhone:normalizePhone(value)};
  if(db) { await db.setSetting('whatsappPhone',settings.whatsappPhone); return settings; }
  await mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(settings,null,2)+'\n',{mode:0o600});
  await rename(temp,file);
  return settings;
}
export function formatPhone(phone) {
  const d=phone.replace(/^55/,'');
  if(d.startsWith('0800')) return d.replace(/^(\d{4})(\d{3})(\d{4})$/,'$1 $2 $3');
  return d.replace(/^(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3');
}
export function configureWhatsApp(html, settings) {
  const phone=settings.whatsappPhone;
  return html
    .replace(/(href=["']https:\/\/wa\.me\/)\d+/g, '$1'+phone)
    // Footer contact: the original fixed 0800 "tel:" link now shows the admin number and opens WhatsApp.
    .replace(/title="Clique para ligar"([^>]*?)href="tel:[^"]*">\s*<i class="fas fa-phone"><\/i>\s*[\d ]+/g,
      `title="Clique para conversar no WhatsApp"$1href="https://wa.me/${phone}" target="_blank" rel="noopener"> <i class="fab fa-whatsapp"></i> <span data-whatsapp-number>${formatPhone(phone)}</span>`);
}
