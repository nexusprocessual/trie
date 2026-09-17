// Minimal Supabase REST client (PostgREST). Uses the service role key, so it must only run on the server.
export function supabaseFromEnv(env = process.env) {
  const url = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const request = async (table, {method = 'GET', query = '', body, prefer} = {}) => {
    const response = await fetch(`${url}/rest/v1/${table}${query}`, {
      method,
      headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer && {Prefer: prefer})},
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Object.assign(new Error(`Supabase ${response.status}: ${await response.text()}`), {code: 'SUPABASE'});
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  return {
    async getSetting(key) {
      const rows = await request('site_settings', {query: `?key=eq.${encodeURIComponent(key)}&select=value`});
      return rows[0]?.value;
    },
    async setSetting(key, value) {
      await request('site_settings', {method: 'POST', query: '?on_conflict=key', body: {key, value, updated_at: new Date().toISOString()}, prefer: 'resolution=merge-duplicates,return=minimal'});
    },
    async insertVisit(visit) {
      await request('site_visits', {method: 'POST', body: visit, prefer: 'return=minimal'});
    },
    async listVisits(limit = 200) {
      return request('site_visits', {query: `?select=*&order=created_at.desc&limit=${limit}`});
    },
  };
}
