import { supabaseServer } from "@/lib/supabase/server";
import { getCategories, itemLabels, unitLabels } from "@/lib/categories";
import { PROVINCES, money } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fair prices" };

type Row = { item: string; unit: string; province: string | null; kind: string; n: number; p25: number; median: number; p75: number; latest: string };

const KIND: Record<string, string> = { paid: "Buyers paid", quoted: "Quoted to shoppers", advertised: "Advertised" };

export default async function Prices({ searchParams }: { searchParams: Promise<{ province?: string }> }) {
  const { province = "Harare" } = await searchParams;
  const sb = await supabaseServer();
  const cats = await getCategories();
  const items = itemLabels(cats);
  const units = unitLabels(cats);
  let q = sb.from("price_index").select("*").order("item");
  if (province) q = q.eq("province", province);
  const { data } = await q;
  const rows = (data ?? []) as Row[];

  // One line per item+unit, with columns per kind.
  const byItem = new Map<string, Partial<Record<string, Row>>>();
  for (const r of rows) {
    const k = `${r.item}|${r.unit}`;
    byItem.set(k, { ...(byItem.get(k) ?? {}), [r.kind]: r });
  }
  const order = cats.flatMap((c) => c.items.map((i) => i.key));
  const lines = [...byItem.entries()].sort(([a], [b]) => order.indexOf(a.split("|")[0]) - order.indexOf(b.split("|")[0]));
  const cell = (r?: Row) => r ? (
    <>
      <span className="mono">{money(r.median)}</span>
      <span className="muted" style={{ fontSize: 12, display: "block" }}>{money(r.p25)} to {money(r.p75)} · {r.n}</span>
    </>
  ) : <span className="muted">–</span>;

  return (
    <>
      <h1 className="page-title">Fair prices</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "64ch" }}>
        Know the going rate before you call. Medians over the last 90 days, with the middle half of prices underneath.
        What buyers actually paid matters most; advertised prices are what sellers post publicly.
      </p>
      <form className="filters" method="get">
        <select name="province" defaultValue={province} aria-label="Province">
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
      </form>
      {lines.length === 0 ? (
        <div className="list"><div className="empty"><h3>No prices for {province} yet</h3><p>Prices appear once buyers report what they paid.</p></div></div>
      ) : (
        <div className="tblwrap panel" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>Item</th><th>Per</th><th className="num">{KIND.paid}</th><th className="num">{KIND.quoted}</th><th className="num">{KIND.advertised}</th></tr>
            </thead>
            <tbody>
              {lines.map(([k, v]) => {
                const [item, unit] = k.split("|");
                return (
                  <tr key={k}>
                    <td>{items[item] ?? item}</td>
                    <td>{units[unit] ?? unit}</td>
                    <td className="num">{cell(v.paid)}</td>
                    <td className="num">{cell(v.quoted)}</td>
                    <td className="num">{cell(v.advertised)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
