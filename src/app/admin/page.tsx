import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { decideEvidence, addSignal, setVerified, removeReview, importQuotes } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation" };

const KIND: Record<string, string> = {
  payment_ref: "Payment reference", receipt: "Receipt", delivery_photo: "Delivery photo", chat: "Chat screenshot", other: "Other",
};

export default async function Admin() {
  const { sb, profile } = await currentUser();
  if (!profile || !["moderator", "admin"].includes(profile.role)) notFound();

  const [{ data: pending }, { data: recent }, { data: quotes }] = await Promise.all([
    sb.from("evidence").select("id, kind, txn_ref, storage_path, created_at, review_id, reviews(id, seller_id, body, ratings, paid_usd, sellers(name))")
      .eq("status", "pending").order("created_at").limit(50),
    sb.from("reviews").select("id, seller_id, body, ratings, tier, created_at, sellers(name)").eq("status", "published").order("created_at", { ascending: false }).limit(20),
    sb.from("shop_quotes").select("round").order("created_at", { ascending: false }).limit(500),
  ]);

  const signed = await Promise.all((pending ?? []).map(async (e) =>
    e.storage_path ? (await sb.storage.from("evidence").createSignedUrl(e.storage_path, 600)).data?.signedUrl ?? null : null));
  const rounds = [...new Set((quotes ?? []).map((q) => q.round))];

  type Rev = { id: string; seller_id: string; body: string | null; ratings: Record<string, number>; paid_usd?: number | null; sellers: { name: string } | null };

  return (
    <>
      <h1 className="page-title">Moderation</h1>

      <section className="block">
        <h2>Proof waiting for review ({pending?.length ?? 0})</h2>
        {!pending?.length && <p className="muted">Nothing waiting.</p>}
        <div className="list">
          {(pending ?? []).map((e, i) => {
            const r = e.reviews as unknown as Rev | null;
            return (
              <div key={e.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto", cursor: "default" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="name"><Link href={`/s/${r?.seller_id}`}>{r?.sellers?.name}</Link> · {KIND[e.kind]}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {e.txn_ref && <>Ref <span className="mono">{e.txn_ref}</span> · </>}
                    {r?.paid_usd ? `Paid $${r.paid_usd} · ` : ""}Overall {r?.ratings?.overall}/5
                  </div>
                  {r?.body && <p style={{ margin: "4px 0 0", fontSize: 14 }}>{r.body.slice(0, 240)}</p>}
                  {signed[i] && <a href={signed[i]!} target="_blank" rel="noopener">Open file</a>}
                </div>
                <form action={decideEvidence} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="btn" name="decision" value="t3">Verified</button>
                  <button className="btn" name="decision" value="t2">Supported</button>
                  <button className="btn danger" name="decision" value="reject">Reject</button>
                </form>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block">
        <h2>Mystery-shop quotes</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Rounds loaded: {rounds.length ? rounds.join(", ") : "none yet"}. Paste one quote per line:
          <span className="mono"> phone,item,qty,unit,area,profile,quote_usd,shopper,notes</span>. Profiles: local_shona, local_ndebele, local_english, foreign, diaspora.
        </p>
        <form action={importQuotes} className="stack">
          <div className="field"><label htmlFor="round">Round name</label><input id="round" name="round" required placeholder="harare-aggr-r1" /></div>
          <div className="field"><label htmlFor="csv">Quotes</label><textarea id="csv" name="csv" required placeholder="+263772844668,river,5,m3,Ruwa,foreign,95,TM,quoted on WhatsApp" /></div>
          <div><button className="btn primary">Import quotes</button></div>
        </form>
      </section>

      <section className="block">
        <h2>Seller tools</h2>
        <div className="grid2">
          <form action={addSignal} className="panel stack">
            <strong>Add a public-complaint link</strong>
            <div className="field"><label htmlFor="sig_seller">Seller ID</label><input id="sig_seller" name="seller_id" required /></div>
            <div className="field"><label htmlFor="sig_url">Link</label><input id="sig_url" name="url" type="url" required /></div>
            <div className="field"><label htmlFor="sig_note">Short label</label><input id="sig_note" name="note" maxLength={300} placeholder="Facebook group post, Mar 2026" /></div>
            <div><button className="btn">Add link</button></div>
          </form>
          <form action={setVerified} className="panel stack">
            <strong>TrustTrust badge</strong>
            <div className="field"><label htmlFor="v_seller">Seller ID</label><input id="v_seller" name="seller_id" required /></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn primary" name="verified" value="1">Award badge</button>
              <button className="btn" name="verified" value="0">Remove</button>
            </div>
          </form>
        </div>
      </section>

      <section className="block">
        <h2>Latest reviews</h2>
        <div className="list">
          {((recent ?? []) as unknown as (Rev & { tier: number })[]).map((r) => (
            <div key={r.id} className="row" style={{ gridTemplateColumns: "minmax(0,1fr) auto", cursor: "default" }}>
              <div style={{ minWidth: 0 }}>
                <div className="name"><Link href={`/s/${r.seller_id}`}>{r.sellers?.name}</Link> · {r.ratings?.overall}/5 · tier {r.tier}</div>
                {r.body && <div className="muted" style={{ fontSize: 13 }}>{r.body.slice(0, 200)}</div>}
              </div>
              <form action={removeReview}><input type="hidden" name="id" value={r.id} /><button className="btn danger">Remove</button></form>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
