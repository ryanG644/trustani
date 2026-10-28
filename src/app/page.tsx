import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCategories, itemLabels } from "@/lib/categories";
import { PROVINCES, formatPhone, money, normalisePhone, type SellerRow } from "@/lib/data";
import { PRODUCTS, TOP_N, UNIT_SHORT } from "@/lib/products";

export const dynamic = "force-dynamic";

type SP = Promise<{ p?: string; province?: string; q?: string }>;

type Listing = {
  id: string; name: string; province: string; town: string | null; phones: string[]; verified: boolean;
  review_count: number; verified_count: number; score: number | null;
  short_flag: boolean; discrim_flag: boolean; signal_count: number;
  item: string; unit: string | null; price: number | null; price_kind: string | null; price_reports: number | null;
  latest_review: string | null; latest_rating: number | null; latest_tier: number | null;
};

const KIND: Record<string, string> = { paid: "buyers paid", quoted: "quoted", advertised: "advertised" };

function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} of 5`}>
      {"★".repeat(n)}<span className="off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default async function Home({ searchParams }: { searchParams: SP }) {
  const { p, province = "Harare", q = "" } = await searchParams;
  const product = PRODUCTS.find((x) => x.key === p) ?? PRODUCTS[0];
  const sb = await supabaseServer();

  // Name or phone search keeps working from the box at the top.
  if (q.trim()) return <SearchResults q={q} />;

  const [{ data: rows }, { data: fair }] = await Promise.all([
    sb.from("product_listings").select("*")
      .eq("item", product.key).eq("province", province)
      .order("score", { ascending: false, nullsFirst: false })
      .order("review_count", { ascending: false })
      .order("price", { ascending: true, nullsFirst: false })
      .limit(TOP_N),
    sb.from("price_index").select("kind, n, p25, median, p75")
      .eq("item", product.key).eq("unit", product.unit).eq("province", province),
  ]);
  const list = (rows ?? []) as Listing[];
  const fairRow = (fair ?? []).find((f) => f.kind === "paid") ?? (fair ?? []).find((f) => f.kind === "quoted") ?? (fair ?? [])[0];

  return (
    <>
      <h1 className="page-title">Who do you trust?</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "62ch" }}>
        Pick what you&apos;re buying. See the top {TOP_N} sellers, their prices and what buyers say, before you call anyone.
      </p>

      <nav className="tabs" aria-label="Products">
        {PRODUCTS.map((x) => (
          <Link key={x.key} href={`/?p=${x.key}&province=${encodeURIComponent(province)}`}
            className={`tab ${x.key === product.key ? "on" : ""}`} aria-current={x.key === product.key ? "page" : undefined}>
            {x.label}
          </Link>
        ))}
      </nav>

      <form className="filters" method="get">
        <input type="hidden" name="p" value={product.key} />
        <select name="province" defaultValue={province} aria-label="Province">
          {PROVINCES.map((pv) => <option key={pv}>{pv}</option>)}
        </select>
        <button className="btn" type="submit">Show</button>
        <span style={{ flex: 1 }} />
        <a href="#search" className="muted" style={{ fontSize: 14 }}>Check a seller by name or number ↓</a>
      </form>

      <div className="fairbar">
        <div>
          <div className="label">Fair price, {product.label.toLowerCase()} in {province}</div>
          {fairRow ? (
            <div className="fairnum">
              <b className="mono">{money(Number(fairRow.median))}</b>
              <span className="muted"> {product.per}</span>
              <span className="muted" style={{ display: "block", fontSize: 13 }}>
                Most pay {money(Number(fairRow.p25))} to {money(Number(fairRow.p75))} · {fairRow.n} {KIND[fairRow.kind] ?? fairRow.kind} prices, last 90 days
              </span>
            </div>
          ) : (
            <div className="muted">Not enough prices yet. <Link href="/prices">See all prices</Link></div>
          )}
        </div>
        <Link className="btn" href={`/add?cat=${product.category}`}>+ Add a seller</Link>
      </div>

      <h2 className="section-title">Top {TOP_N} {product.label.toLowerCase()} sellers in {province}</h2>
      {list.length > 0 && (
        <p className="muted" style={{ marginTop: -4, fontSize: 14 }}>
          {list.some((s) => s.score != null)
            ? "Ranked by buyer score, weighted towards reviews with proof of purchase. Unreviewed sellers follow, cheapest first."
            : "No buyer reviews yet, so sellers are listed cheapest first. A low price is not a recommendation: check reviews and flags before you pay."}
        </p>
      )}
      <ol className="cards" aria-label={`Top ${product.label} sellers`}>
        {list.length === 0 && (
          <li className="empty">
            <h3>No {product.label.toLowerCase()} sellers listed in {province} yet</h3>
            <p>Bought {product.label.toLowerCase()} recently? <Link href={`/add?cat=${product.category}`}>Add the seller</Link> and review them.</p>
          </li>
        )}
        {list.map((s, i) => (
          <li key={s.id} className="card">
            <Link href={`/s/${s.id}`} className="card-link">
              <div className="card-top">
                <span className="rank">{i + 1}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="name">{s.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {[s.town, s.province].filter(Boolean).join(", ")}
                    {s.phones[0] && <> · <span className="mono">{formatPhone(s.phones[0])}</span></>}
                  </div>
                </div>
                <div className="card-price">
                  {s.price != null ? (
                    <>
                      <b className="mono">{money(Number(s.price))}<small>{UNIT_SHORT[s.unit ?? ""] ?? ""}</small></b>
                      <small className="muted">{KIND[s.price_kind ?? ""] ?? ""}</small>
                    </>
                  ) : <small className="muted">Price not yet known</small>}
                </div>
              </div>

              <div className="card-mid">
                {s.score != null ? (
                  <span className="scorepill"><b className="mono">{s.score}</b>/100</span>
                ) : <span className="chip">Unrated</span>}
                <span className="muted" style={{ fontSize: 13 }}>
                  {s.review_count ? `${s.review_count} review${s.review_count === 1 ? "" : "s"}${s.verified_count ? `, ${s.verified_count} verified` : ""}` : "No reviews yet"}
                </span>
                {s.verified && <span className="chip trust">TrustTrust</span>}
                {s.discrim_flag && <span className="chip bad">Charges some buyers more</span>}
                {s.short_flag && <span className="chip bad">Short loads reported</span>}
                {s.signal_count > 0 && <span className="chip warn">Public complaints</span>}
              </div>

              {s.latest_review && (
                <blockquote className="snippet">
                  {s.latest_rating ? <Stars n={s.latest_rating} /> : null}{" "}
                  {s.latest_review.length > 160 ? s.latest_review.slice(0, 157) + "…" : s.latest_review}
                </blockquote>
              )}
            </Link>
          </li>
        ))}
      </ol>

      <section id="search" className="block">
        <h2 className="section-title">Check a seller</h2>
        <form className="filters" method="get" role="search">
          <input type="search" name="q" placeholder="Seller name, or the +263 number that called you" aria-label="Search sellers" />
          <button className="btn" type="submit">Check</button>
        </form>
      </section>
    </>
  );
}

async function SearchResults({ q }: { q: string }) {
  const sb = await supabaseServer();
  const labels = itemLabels(await getCategories());
  let query = sb.from("seller_directory").select("*").limit(50);
  const phone = /\d{6,}/.test(q.replace(/\s/g, "")) ? normalisePhone(q) : null;
  if (phone) query = query.contains("phones", [phone]);
  else {
    const term = q.trim().replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${term}%,town.ilike.%${term}%,yard.ilike.%${term}%`);
  }
  const { data } = await query.order("score", { ascending: false, nullsFirst: false }).order("name");
  const rows = (data ?? []) as SellerRow[];

  return (
    <>
      <p style={{ margin: "0 0 12px" }}><Link href="/" className="muted">← Browse by product</Link></p>
      <h1 className="page-title">Results for “{q}”</h1>
      <form className="filters" method="get" role="search">
        <input type="search" name="q" defaultValue={q} aria-label="Search sellers" />
        <button className="btn" type="submit">Check</button>
      </form>
      {phone && !rows.length && (
        <div className="notice warn">
          No seller is listed with {phone} yet. That doesn&apos;t mean they&apos;re safe or unsafe, just unknown.{" "}
          <Link href={`/add?phone=${encodeURIComponent(phone)}`}>Add them</Link> after you buy so the next person knows.
        </div>
      )}
      <div className="list">
        {!rows.length && !phone && <div className="empty"><h3>No sellers match</h3><p>Try part of the name, or the phone number.</p></div>}
        {rows.map((s) => (
          <Link key={s.id} href={`/s/${s.id}`} className="row">
            <span className="rank">{s.score ?? "–"}</span>
            <span style={{ minWidth: 0 }}>
              <span className="name">{s.name}</span>
              <span className="muted" style={{ display: "block", fontSize: 13 }}>{[s.town, s.province].filter(Boolean).join(", ")}</span>
              <span className="chips">
                {s.discrim_flag && <span className="chip bad">Charges some buyers more</span>}
                {s.short_flag && <span className="chip bad">Short loads reported</span>}
                {s.items.slice(0, 4).map((i) => <span key={i} className="chip">{labels[i] ?? i}</span>)}
              </span>
            </span>
            <span className="score"><small>{s.review_count} review{s.review_count === 1 ? "" : "s"}</small></span>
          </Link>
        ))}
      </div>
    </>
  );
}
