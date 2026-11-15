export const API = 'https://api.reidoscanais.im';
export const TTL = 300000;
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function currentProgram(channel, now = Date.now()) {
  const p = channel?.epg?.current;
  return p && Number(p.start_time) * 1000 <= now && Number(p.end_time) * 1000 > now ? p : null;
}
export function eventTime(event) {
  const stamp = Number(event.start_timestamp);
  if (!Number.isFinite(stamp) || stamp <= 0) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}).format(new Date(stamp * 1000));
}
export function sortEvents(events) {
  const rank = {live:0, upcoming:1, finished:2};
  return [...events].sort((a,b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || (a.status === 'finished' ? -1 : 1) * ((Number(a.start_timestamp)||0) - (Number(b.start_timestamp)||0)));
}
export function createAPI(fetcher = fetch) {
  const cache = new Map();
  return async function request(path, {signal, fresh = false} = {}) {
    const hit = cache.get(path);
    if (!fresh && hit && Date.now() - hit.time < TTL) return hit.data;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, {once:true});
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetcher(API + path, {signal:controller.signal, credentials:'omit'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (data.success === false) throw new Error('API indisponível');
      if (path !== '/health' && !Object.hasOwn(data, 'data')) throw new Error('Resposta inválida');
      cache.set(path, {time:Date.now(), data});
      if (cache.size > 150) cache.delete(cache.keys().next().value);
      return data;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
}
