import {isIP} from 'node:net';

const privateIp = ip => /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80:)/i.test(ip);
const geoCache = new Map();

export function clientIp(req, trustProxy = process.env.TRUST_PROXY === 'true') {
  let ip = req.socket.remoteAddress || '';
  if (trustProxy) {
    const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0];
    if (isIP(String(forwarded).trim())) ip = String(forwarded).trim();
  }
  return ip.replace(/^::ffff:/, '');
}

// Hosting providers often send geolocation headers; otherwise ask ipwho.is (cached per IP).
export async function locate(ip, headers = {}) {
  const city = headers['x-vercel-ip-city'] || headers['cf-ipcity'];
  if (city) return {city: decodeURIComponent(city), region: headers['x-vercel-ip-country-region'] || headers['cf-region'] || null, country: headers['x-vercel-ip-country'] || headers['cf-ipcountry'] || null};
  if (privateIp(ip)) return {city: 'Rede local', region: null, country: null};
  if (geoCache.has(ip)) return geoCache.get(ip);
  let result = {city: null, region: null, country: null};
  try {
    const data = await (await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country`, {signal: AbortSignal.timeout(4000)})).json();
    if (data.success) result = {city: data.city || null, region: data.region || null, country: data.country || null};
  } catch {}
  if (geoCache.size > 5000) geoCache.clear();
  geoCache.set(ip, result);
  return result;
}

export function createVisitStore(db) {
  const memory = []; // fallback when Supabase is not configured (lost on restart)
  return {
    persistent: Boolean(db),
    async record(req, pathname) {
      const ip = clientIp(req);
      const visit = {ip, path: pathname.slice(0, 500), referrer: String(req.headers.referer || '').slice(0, 500) || null, user_agent: String(req.headers['user-agent'] || '').slice(0, 500) || null, ...await locate(ip, req.headers)};
      if (db) return db.insertVisit(visit);
      memory.unshift({id: Date.now(), created_at: new Date().toISOString(), ...visit});
      memory.length = Math.min(memory.length, 500);
    },
    async list(limit) {
      return db ? db.listVisits(limit) : memory.slice(0, limit);
    },
  };
}
