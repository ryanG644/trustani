import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { formatPhone, money } from "@/lib/data";
import { PRODUCTS, TOP_N } from "@/lib/products";
import QuoteForm from "./QuoteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mystery shop" };

const CALLERS: { key: string; label: string; hint: string }[] = [
  { key: "foreign", label: "Calling from a foreign number", hint: "e.g. a Canadian +1 number" },
  { key: "local_english", label: "Local number, speaking English", hint: "+263 number" },
  { key: "local_shona", label: "Local number, speaking Shona", hint: "+263 number" },
  { key: "local_ndebele", label: "Local number, speaking Ndebele", hint: "+263 number" },
];

type SP = Promise<{ p?: string; profile?: string; qty?: string; area?: string; round?: string; province?: string }>;

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { sb, user, profile } = await currentUser();
  if (!user) redirect("/login?next=/shop");
  const role = profile?.role ?? "user";
  if (!["shopper", "moderator", "admin"].includes(role)) {
    return (
      <>
        <h1 className="page-title">Mystery shop</h1>
        <p className="notice warn">Your account isn&apos;t set up as a mystery shopper yet. Ask the TrustAni admin to add you, then reload this page.</p>
      </>
    );
  }

  const product = PRODUCTS.find((x) => x.key === sp.p) ?? PRODUCTS[1]; // default 3/4 stone
  const province = sp.province || "Harare";
  const callerKey = CALLERS.some((c) => c.key === sp.profile) ? sp.profile! : "";
  const qty = Number(sp.qty) > 0 ? Number(sp.qty) : 10;
  const area = (sp.area || "").slice(0, 60);
  const today = new Date().toISOString().slice(0, 10);
  const round = (sp.round || `${province.toLowerCase()}-${product.key}-${today}`).slice(0, 60);
  const ready = !!callerKey && !!area;

  const [{ data: sellers }, { data: mine }] = await Promise.all([
    sb.from("product_listings").select("id, name, town, phones, price, unit, price_kind")
      .eq("item", product.key).eq("province", province)
      .order("score", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false })
      .order("price", { ascending: true, nullsFirst: false }).limit(TOP_N),
    sb.from("shop_quotes").select("seller_id, quote_usd, delivered, notes, profile").eq("round", round).eq("created_by", user.id),
  ]);
  // Foreign callers go through the list in reverse so the two callers don't reach the same seller back to back.
  const list = [...(sellers ?? [])];
  if (callerKey === "foreign") list.reverse();
  const done = new Map((mine ?? []).filter((m) => m.profile === callerKey).map((m) => [m.seller_id, m]));

  const caller = CALLERS.find((c) => c.key === callerKey);
  const perLabel = product.unit === "m3" ? "cubes (m³)" : product.per;

  return (
    <>
      <h1 className="page-title">Mystery shop: {product.label}</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "64ch" }}>
        Call each seller, ask for the same order, and record exactly what they quote. Don&apos;t mention TrustAni.
        {role !== "shopper" && <> <Link href={`/shop/results?round=${encodeURIComponent(round)}`}>See results for this round →</Link></>}
      </p>

      <form className="panel stack" method="get" style={{ maxWidth: "none" }}>
        <input type="hidden" name="p" value={product.key} />
        <div className="field">
          <label htmlFor="profile">Who is calling?</label>
          <select id="profile" name="profile" defaultValue={callerKey} required>
            <option value="" disabled>Choose…</option>
            {CALLERS.map((c) => <option key={c.key} value={c.key}>{c.label} ({c.hint})</option>)}
          </select>
        </div>
        <div className="grid3">
          <div className="field">
            <label htmlFor="qty">Quantity ({perLabel})</label>
            <input id="qty" name="qty" type="number" min="1" step="1" defaultValue={qty} />
          </div>
          <div className="field">
            <label htmlFor="area">Deliver to (suburb)</label>
            <input id="area" name="area" defaultValue={area} required placeholder="e.g. Ruwa" />
          </div>
          <div className="field">
            <label htmlFor="round">Round name</label>
            <input id="round" name="round" defaultValue={round} />
          </div>
        </div>
        <p className="hint muted" style={{ margin: 0 }}>Both callers must use the same quantity, suburb and round name, or the comparison won&apos;t work.</p>
        <div><button className="btn primary">{ready ? "Update setup" : "Start"}</button></div>
      </form>

      {ready && (
        <>
          <section className="block">
            <h2 className="section-title">What to say</h2>
            <div className="panel script">
              <p>&ldquo;Hi, I need <b>{qty} {perLabel}</b> of <b>{product.label.toLowerCase()}</b>, delivered to <b>{area}</b>.
              {callerKey === "foreign" ? " I'm in Canada, it's for my family's build back home." : " It's for a house I'm building."}
              {" "}How much is that in total, with delivery? When can you deliver, and how do I pay?&rdquo;</p>
              <ul>
                <li>Ask for the <b>total in US dollars, including delivery</b>. If they give a per-cube price, ask for the total.</li>
                <li>Don&apos;t haggle and don&apos;t mention other quotes. We want their first price.</li>
                <li>If they don&apos;t answer, move on and try them again at the end.</li>
              </ul>
            </div>
          </section>

          <section className="block">
            <h2 className="section-title">Sellers to call ({done.size} of {list.length} done) · {caller?.label}</h2>
            <ol className="cards">
              {list.map((s, i) => {
                const saved = done.get(s.id);
                const tel = s.phones?.[0] ?? null;
                return (
                  <li key={s.id} className={`card ${saved ? "card-done" : ""}`}>
                    <div className="card-link" style={{ cursor: "default" }}>
                      <div className="card-top">
                        <span className="rank">{saved ? "✓" : i + 1}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="name">{s.name}</div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            {s.price != null ? <>Advertises {money(Number(s.price))} per cube</> : "No advertised price"}
                          </div>
                        </div>
                        {tel && <a className="btn" href={`tel:${tel}`}>Call {formatPhone(tel)}</a>}
                      </div>
                      {(s.phones?.length ?? 0) > 1 && (
                        <div className="muted" style={{ fontSize: 13, paddingLeft: 42 }}>
                          Other numbers: {s.phones.slice(1).map((ph: string) => <a key={ph} href={`tel:${ph}`} className="mono" style={{ marginRight: 10 }}>{formatPhone(ph)}</a>)}
                        </div>
                      )}
                      <QuoteForm sellerId={s.id} round={round} profile={callerKey} item={product.key} qty={qty} area={area} phone={tel}
                        saved={saved ? { quote_usd: Number(saved.quote_usd), delivered: saved.delivered, notes: saved.notes } : null} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </>
  );
}
