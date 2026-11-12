// usage: node measure.mjs  (expects upstream :4100 and next :4101 running)
const N = 'http://127.0.0.1:4101', U = 'http://127.0.0.1:4100';
const H = { 'x-revalidate-secret': 'dev-secret', 'content-type': 'application/json' };
const set = (id, score) => fetch(`${U}/match/${id}`, { method: 'POST', body: JSON.stringify({ score }) });
const get = async (id) => { const t = performance.now(); const r = await fetch(`${N}/match/${id}`); const b = (await r.text()).replace(/<!-- -->/g,''); return { ms: +(performance.now() - t).toFixed(1), m: b.match(/score=([^ ]+) version=(\d+)/)?.slice(1).join('/') }; };
const rev = async (tags, mode, headers = H) => { const t = performance.now(); const r = await fetch(`${N}/api/revalidate`, { method: 'POST', headers, body: JSON.stringify({ tags, mode }) }); return { status: r.status, body: (await r.text()).slice(0, 120), ms: +(performance.now() - t).toFixed(1) }; };
const modes = (process.argv[2] ?? 'max,expire0,legacy,update,path').split(',');
for (const mode of modes) {
  const id = 'm' + mode + Date.now();
  await set(id, '1-0'); const a = await get(id); const a2 = await get(id);
  await set(id, '2-0');
  const stale = await get(id);
  const r = await rev([`match-${id}`], mode);
  const t0 = performance.now();
  const first = await get(id); const second = await get(id); const third = await get(id);
  const pass = first.m?.startsWith('2-0/');
  console.log(JSON.stringify({ mode, warm: a.m, warm2: a2.m, beforeRevalidate: stale.m, revalidate: r, first, second, third, PASS_first_fresh: pass, afterRevalidateToFirstFreshMs: +(performance.now() - t0).toFixed(1) }));
}
