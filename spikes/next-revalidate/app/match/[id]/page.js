const UP = process.env.UPSTREAM ?? 'http://127.0.0.1:4100';

export default async function Match({ params }) {
  const { id } = await params;
  // Tag derived from URL slug, available before any fetch.
  const res = await fetch(`${UP}/match/${id}`, { cache: 'force-cache', next: { tags: [`match-${id}`] } });
  const m = await res.json();
  return (<main>MATCH id={m.id} score={m.score} version={m.version}</main>);
}
