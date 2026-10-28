import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { money } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mystery shop results" };

const LABEL: Record<string, string> = {
  foreign: "Foreign number", local_english: "Local (English)", local_shona: "Local (Shona)",
  local_ndebele: "Local (Ndebele)", diaspora: "Diaspora",
};

type Q = { seller_id: string; profile: string; quote_usd: number; qty: number; delivered: boolean | null; notes: string | null; round: string; sellers: { name: string } | null };

export default async function Results({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const { round } = await searchParams;
  const { sb, profile } = await currentUser();
  if (!profile || !["moderator", "admin"].includes(profile.role)) notFound();

  const { data: roundsData } = await sb.from("shop_quotes").select("round").order("created_at", { ascending: false }).limit(1000);
  const rounds = [...new Set((roundsData ?? []).map((r) => r.round))];
  const current = round || rounds[0];
  const { data } = current
    ? await sb.from("shop_quotes").select("seller_id, profile, quote_usd, qty, delivered, notes, round, sellers(name)").eq("round", current)
    : { data: [] };
  const quotes = (data ?? []) as unknown as Q[];

  const profiles = [...new Set(quotes.map((q) => q.profile))].sort();
  const bySeller = new Map<string, { name: string; q: Record<string, Q> }>();
  for (const q of quotes) {
    const e = bySeller.get(q.seller_id) ?? { name: q.sellers?.name ?? "?", q: {} };
    e.q[q.profile] = q;
    bySeller.set(q.seller_id, e);
  }
  const rows = [...bySeller.entries()].map(([id, e]) => {
    const per = Object.values(e.q).map((q) => Number(q.quote_usd) / Number(q.qty || 1));
    const spread = per.length >= 2 ? Math.max(...per) / Math.min(...per) - 1 : null;
    return { id, ...e, spread };
  }).sort((a, b) => (b.spread ?? -1) - (a.spread ?? -1));
  const compared = rows.filter((r) => r.spread != null);
  const avgSpread = compared.length ? compared.reduce((s, r) => s + (r.spread ?? 0), 0) / compared.length : null;
  const foreignHigher = compared.filter((r) => r.q.foreign && Object.entries(r.q).some(([k, v]) => k !== "foreign" && Number(r.q.foreign.quote_usd) > Number(v.quote_usd))).length;

  return (
    <>
      <p style={{ margin: "0 0 12px" }}><Link href="/shop" className="muted">← Mystery shop</Link></p>
      <h1 className="page-title">Mystery shop results</h1>
      <form className="filters" method="get">
        <select name="round" defaultValue={current} aria-label="Round">
          {rounds.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button className="btn">Show</button>
      </form>

      {!quotes.length ? <p className="muted">No quotes recorded yet.</p> : (
        <>
          <div className="fairbar">
            <div>
              <div className="label">Round {current}</div>
              <div><b className="mono" style={{ fontSize: 24 }}>{compared.length}</b> sellers quoted by both callers
                {avgSpread != null && <> · average gap <b className="mono">{Math.round(avgSpread * 100)}%</b></>}
                {compared.length > 0 && <> · foreign number quoted higher by <b className="mono">{foreignHigher}</b> of {compared.length}</>}
              </div>
            </div>
          </div>
          <div className="tblwrap panel" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr><th>Seller</th>{profiles.map((p) => <th key={p} className="num">{LABEL[p] ?? p}</th>)}<th className="num">Gap</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/s/${r.id}`}>{r.name}</Link></td>
                    {profiles.map((p) => {
                      const q = r.q[p];
                      return (
                        <td key={p} className="num">
                          {q ? <>
                            <span className="mono">{money(Number(q.quote_usd))}</span>
                            <span className="muted" style={{ display: "block", fontSize: 12 }}>
                              {money(Number(q.quote_usd) / Number(q.qty || 1))}/m³{q.delivered === false ? ", collect" : ""}
                            </span>
                          </> : <span className="muted">–</span>}
                        </td>
                      );
                    })}
                    <td className="num">{r.spread != null
                      ? <span className={`chip ${r.spread > 0.2 ? "bad" : r.spread > 0.05 ? "warn" : "good"}`}>{Math.round(r.spread * 100)}%</span>
                      : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Gap compares price per cube between callers. A seller is publicly flagged &quot;Charges some buyers more&quot; only after two rounds with a gap over 20%.
          </p>
        </>
      )}
    </>
  );
}
