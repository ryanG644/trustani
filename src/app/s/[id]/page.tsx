import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { getCategories, itemLabels, unitLabels } from "@/lib/categories";
import { TIER_LABEL, formatPhone, money, type SellerRow } from "@/lib/data";

export const dynamic = "force-dynamic";

type Review = {
  id: string; author_id: string; category_id: string; ratings: Record<string, number>;
  load_status: string | null; item: string | null; qty: number | null; unit: string | null;
  paid_usd: number | null; purchase_month: string | null; body: string | null; tier: number;
  is_mystery_shop: boolean; created_at: string;
};

const LOAD: Record<string, [string, string]> = {
  full: ["Full load", "good"],
  slightly_short: ["Slightly short", "warn"],
  clearly_short: ["Clearly short", "bad"],
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await currentUser();
  const { data } = await sb.from("sellers").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Seller" };
}

export default async function SellerPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ posted?: string }> }) {
  const { id } = await params;
  const { posted } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { sb, user } = await currentUser();
  const [{ data: seller }, { data: reviews }, { data: prices }, { data: signals }, cats] = await Promise.all([
    sb.from("seller_directory").select("*").eq("id", id).maybeSingle(),
    sb.from("reviews").select("*").eq("seller_id", id).eq("status", "published").order("created_at", { ascending: false }),
    sb.from("price_points").select("item, unit, price_usd, kind, observed_on").eq("seller_id", id),
    sb.from("signals").select("url, note, created_at").eq("seller_id", id),
    getCategories(),
  ]);
  if (!seller) notFound();
  const s = seller as SellerRow;
  const rs = (reviews ?? []) as Review[];
  const items = itemLabels(cats);
  const units = unitLabels(cats);

  const authorIds = [...new Set(rs.map((r) => r.author_id))];
  const { data: profiles } = authorIds.length
    ? await sb.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameOf = (uid: string) => profiles?.find((p) => p.id === uid)?.display_name || "A buyer";

  // Rating breakdown uses the category most reviews are in.
  const catId = rs[0]?.category_id ?? s.categories[0] ?? "aggregates";
  const cat = cats.find((c) => c.id === catId);
  const avg = (key: string) => {
    const v = rs.filter((r) => r.category_id === catId && r.ratings?.[key]).map((r) => r.ratings[key]);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  // Prices: median per item/unit/kind
  const groups = new Map<string, number[]>();
  for (const p of prices ?? []) {
    const k = `${p.item}|${p.unit}|${p.kind}`;
    groups.set(k, [...(groups.get(k) ?? []), Number(p.price_usd)]);
  }
  const median = (a: number[]) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const priceRows = [...groups.entries()].map(([k, v]) => { const [item, unit, kind] = k.split("|"); return { item, unit, kind, med: median(v), n: v.length }; })
    .sort((a, b) => a.item.localeCompare(b.item));

  const mine = user ? rs.find((r) => r.author_id === user.id) : null;
  const shortPct = s.measured_count ? Math.round((s.short_count / s.measured_count) * 100) : 0;

  return (
    <>
      <p style={{ margin: "0 0 12px" }}><Link href="/" className="muted">← All sellers</Link></p>
      {posted && <p className="notice good" role="status">Review posted. If you added proof, a moderator will check it and your review will count for more.</p>}
      <div className="cols">
        <div className="panel">
          <div className="label">{s.province}</div>
          <h1 className="page-title" style={{ overflowWrap: "anywhere" }}>{s.name}</h1>
          <div className="chips">
            {s.verified && <span className="chip trust">TrustTrust verified</span>}
            {s.source === "lead" && !s.review_count && <span className="chip">Listed from public adverts</span>}
          </div>
          <dl className="kv">
            <dt>Phone</dt>
            <dd className="mono">{s.phones.length ? s.phones.map(formatPhone).join(", ") : "–"}</dd>
            {s.town && (<><dt>Area</dt><dd>{s.town}</dd></>)}
            {s.yard && (<><dt>Yard</dt><dd>{s.yard}</dd></>)}
            {s.delivers_to && (<><dt>Delivers to</dt><dd>{s.delivers_to}</dd></>)}
            {s.trucks && (<><dt>Trucks</dt><dd>{s.trucks}</dd></>)}
            <dt>Sells</dt><dd>{s.items.map((i) => items[i] ?? i).join(", ") || "–"}</dd>
            {s.source_url && (<><dt>Source</dt><dd><a href={s.source_url} target="_blank" rel="noopener nofollow">Original listing</a></dd></>)}
          </dl>

          {s.discrim_flag && (
            <div className="notice bad">
              In TrustAni mystery shops, this seller quoted some buyers more than others for the same order
              (up to {Math.round((s.max_spread ?? 0) * 100)}% more). Ask a local contact to get the quote, and compare with the fair price.
            </div>
          )}
          {s.short_flag && (
            <div className="notice bad">
              {shortPct}% of buyers who measured ({s.measured_count}) say the delivery came up short. Measure the load or get a weighbridge ticket before paying in full.
            </div>
          )}
          {(signals ?? []).length > 0 && (
            <div className="notice warn">
              Public complaints about this seller exist elsewhere. They are not verified by TrustAni:{" "}
              {(signals ?? []).map((g, i) => (
                <span key={g.url}>{i > 0 && ", "}<a href={g.url} target="_blank" rel="noopener nofollow">{g.note || `source ${i + 1}`}</a></span>
              ))}
            </div>
          )}

          {priceRows.length > 0 && (
            <section className="block">
              <h2>Prices</h2>
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Item</th><th>Per</th><th>Type</th><th className="num">Median</th><th className="num">Reports</th></tr></thead>
                  <tbody>
                    {priceRows.map((p) => (
                      <tr key={`${p.item}${p.unit}${p.kind}`}>
                        <td>{items[p.item] ?? p.item}</td>
                        <td>{units[p.unit] ?? p.unit}</td>
                        <td className="muted">{p.kind === "paid" ? "Buyers paid" : p.kind === "quoted" ? "Quoted to shoppers" : "Advertised"}</td>
                        <td className="num">{money(p.med)}</td>
                        <td className="num">{p.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>Compare with the <Link href="/prices">fair price ranges</Link> for your area.</p>
            </section>
          )}
        </div>

        <div className="panel">
          <div className="scorebox">
            <div>
              <div className="label">Rank score</div>
              <div className="big">{s.score ?? "–"}<small>/100</small></div>
              <div className="label" style={{ marginTop: 4 }}>{s.review_count} review{s.review_count === 1 ? "" : "s"} · {s.verified_count} verified</div>
            </div>
            <div className="bars">
              {(cat?.dims ?? []).map((d) => {
                const v = avg(d.key);
                return (
                  <span key={d.key} style={{ display: "contents" }}>
                    <span>{d.label}</span>
                    <span className="bar"><i style={{ width: `${v ? ((v - 1) / 4) * 100 : 0}%` }} /></span>
                    <span className="num">{v ? v.toFixed(1) : "–"}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <section className="block">
            <h2>
              <span>Vanhu vanoti</span>
              <Link className={`btn ${mine ? "" : "primary"}`} href={user ? `/s/${s.id}/review` : `/login?next=/s/${s.id}/review`}>
                {mine ? "Edit my review" : "Write a review"}
              </Link>
            </h2>
            {rs.length === 0 && <p className="muted">No reviews yet. If you have bought from {s.name}, yours will be the first.</p>}
            {rs.map((r) => (
              <article key={r.id} className="review">
                <div className="head">
                  <span className="stars" aria-label={`${r.ratings.overall} of 5`}>
                    {"★".repeat(r.ratings.overall)}<span className="off">{"★".repeat(5 - r.ratings.overall)}</span>
                  </span>
                  <strong>{r.is_mystery_shop ? "TrustAni mystery shop" : nameOf(r.author_id)}{user?.id === r.author_id ? " (you)" : ""}</strong>
                  <span className={`chip ${r.tier >= 3 ? "good" : ""}`}>{TIER_LABEL[r.tier]}</span>
                  {r.load_status && LOAD[r.load_status] && <span className={`chip ${LOAD[r.load_status][1]}`}>{LOAD[r.load_status][0]}</span>}
                  {r.purchase_month && <span className="label">{r.purchase_month.slice(0, 7)}</span>}
                </div>
                {r.item && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {items[r.item] ?? r.item}
                    {r.qty ? ` · ${r.qty} ${units[r.unit ?? ""] ?? r.unit ?? ""}` : ""}
                    {r.paid_usd ? <> · paid <span className="mono">{money(Number(r.paid_usd))}</span></> : null}
                  </div>
                )}
                {r.body && <p>{r.body}</p>}
              </article>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
