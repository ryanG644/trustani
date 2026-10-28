import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCategories, itemLabels } from "@/lib/categories";
import { PROVINCES, normalisePhone, type SellerRow } from "@/lib/data";

export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; province?: string; item?: string; sort?: string }>;

export default async function Directory({ searchParams }: { searchParams: SP }) {
  const { q = "", province = "", item = "", sort = "score" } = await searchParams;
  const sb = await supabaseServer();
  const cats = await getCategories();
  const labels = itemLabels(cats);

  let query = sb.from("seller_directory").select("*").limit(200);
  const phone = /\d{6,}/.test(q.replace(/\s/g, "")) ? normalisePhone(q) : null;
  if (phone) query = query.contains("phones", [phone]);
  else if (q.trim()) {
    const term = q.trim().replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${term}%,town.ilike.%${term}%,yard.ilike.%${term}%`);
  }
  if (province) query = query.eq("province", province);
  if (item) query = query.contains("items", [item]);
  if (sort === "reviews") query = query.order("review_count", { ascending: false }).order("score", { ascending: false, nullsFirst: false });
  else if (sort === "new") query = query.order("created_at", { ascending: false });
  else query = query.order("score", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false }).order("name");

  const { data, error } = await query;
  const rows = (data ?? []) as SellerRow[];
  let rank = 0;

  return (
    <>
      <h1 className="page-title">Who do you trust?</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "62ch" }}>
        Check a seller before you pay. Search by name, area, or the phone number they called you from.
      </p>

      <form className="filters" role="search" method="get">
        <input type="search" name="q" defaultValue={q} placeholder="Seller name, area or +263 number" aria-label="Search sellers" />
        <select name="province" defaultValue={province} aria-label="Province">
          <option value="">All provinces</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="item" defaultValue={item} aria-label="Material or product">
          <option value="">Everything</option>
          {cats.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {c.items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </optgroup>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sort">
          <option value="score">Rank score</option>
          <option value="reviews">Most reviewed</option>
          <option value="new">Newest listed</option>
        </select>
        <button className="btn" type="submit">Search</button>
      </form>

      {phone && !rows.length && (
        <div className="notice warn">
          No seller is listed with {phone} yet. That doesn&apos;t mean they&apos;re safe or unsafe, just unknown.{" "}
          <Link href={`/add?phone=${encodeURIComponent(phone)}`}>Add them</Link> after you buy so the next person knows.
        </div>
      )}
      {error && <div className="notice bad">The list didn&apos;t load. Refresh the page to try again.</div>}

      <div className="list" aria-label="Sellers">
        {rows.length === 0 && !phone && (
          <div className="empty">
            <h3>No sellers match</h3>
            <p>Try another province or product, or clear the search.</p>
          </div>
        )}
        {rows.map((s) => {
          const r = s.score != null ? ++rank : "–";
          return (
            <Link key={s.id} href={`/s/${s.id}`} className="row">
              <span className="rank">{r}</span>
              <span style={{ minWidth: 0 }}>
                <span className="name">{s.name}</span>
                <span className="muted" style={{ display: "block", fontSize: 13 }}>
                  {[s.town, s.province].filter(Boolean).join(", ")}
                </span>
                <span className="chips">
                  {s.verified && <span className="chip trust">TrustTrust</span>}
                  {s.discrim_flag && <span className="chip bad">Charges some buyers more</span>}
                  {s.short_flag && <span className="chip bad">Short loads reported</span>}
                  {s.signal_count > 0 && <span className="chip warn">Public complaints</span>}
                  {s.items.slice(0, 4).map((i) => <span key={i} className="chip">{labels[i] ?? i}</span>)}
                </span>
              </span>
              {s.score != null ? (
                <span className="score">
                  <b>{s.score}</b>
                  <span className="meter"><i style={{ width: `${s.score}%` }} /></span>
                  <small>{s.review_count} review{s.review_count === 1 ? "" : "s"}{s.verified_count ? `, ${s.verified_count} verified` : ""}</small>
                </span>
              ) : (
                <span className="score"><b className="muted" style={{ fontSize: 14 }}>Unrated</b><small>No reviews yet</small></span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
