"use client";

import { useActionState } from "react";
import type { Category } from "@/lib/data";
import { saveReview, deleteReview, type ReviewState } from "./actions";

type Existing = {
  category_id: string; ratings: Record<string, number>; load_status: string | null;
  item: string | null; qty: number | null; unit: string | null; paid_usd: number | null;
  purchase_month: string | null; body: string | null;
} | null;

export default function ReviewForm({ sellerId, cat, existing }: { sellerId: string; cat: Category; existing: Existing }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(saveReview, {});
  const same = existing?.category_id === cat.id ? existing : null;
  const hasMeasure = cat.dims.some((d) => d.key === "measure");

  return (
    <>
      <form action={action} className="stack">
        <input type="hidden" name="seller_id" value={sellerId} />
        <input type="hidden" name="category_id" value={cat.id} />

        <div>
          {cat.dims.map((d) => (
            <div className="rate" key={d.key}>
              <div>{d.label}<small>{d.hint}</small></div>
              <div className="seg" role="radiogroup" aria-label={d.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n}>
                    <input type="radio" id={`r_${d.key}_${n}`} name={`r_${d.key}`} value={n}
                      defaultChecked={same?.ratings?.[d.key] === n} required={d.key === "overall"} />
                    <label htmlFor={`r_${d.key}_${n}`}>{n}</label>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {hasMeasure && (
          <div className="field">
            <label htmlFor="load">Did you get the full quantity?</label>
            <select id="load" name="load" defaultValue={same?.load_status ?? "full"}>
              <option value="full">Full quantity, as agreed</option>
              <option value="slightly_short">Slightly short</option>
              <option value="clearly_short">Clearly short</option>
              <option value="not_measured">Didn&apos;t check</option>
            </select>
          </div>
        )}

        <div className="grid3">
          <div className="field">
            <label htmlFor="item">What you bought</label>
            <select id="item" name="item" defaultValue={same?.item ?? ""}>
              <option value="">Choose…</option>
              {cat.items.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" name="qty" type="number" min="0" step="0.5" inputMode="decimal" defaultValue={same?.qty ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="unit">Unit</label>
            <select id="unit" name="unit" defaultValue={same?.unit ?? cat.units[0]?.key}>
              {cat.units.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid2">
          <div className="field">
            <label htmlFor="paid">Total paid (USD)</label>
            <input id="paid" name="paid" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={same?.paid_usd ?? ""} />
            <span className="hint">Include delivery if it was one price. This feeds the fair-price index.</span>
          </div>
          <div className="field">
            <label htmlFor="month">Month of purchase</label>
            <input id="month" name="month" type="month" defaultValue={same?.purchase_month?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="body">What happened</label>
          <textarea id="body" name="body" maxLength={2000} defaultValue={same?.body ?? ""}
            placeholder="Quality, how the load or item compared with what was promised, payment terms, delivery. Facts help the next buyer most." />
        </div>

        <fieldset className="field panel" style={{ padding: 14 }}>
          <legend style={{ padding: "0 4px" }}>Proof (optional, raises your review&apos;s weight)</legend>
          <div className="grid2">
            <div className="field">
              <label htmlFor="evidence_kind">Type of proof</label>
              <select id="evidence_kind" name="evidence_kind" defaultValue="payment_ref">
                <option value="payment_ref">EcoCash / InnBucks / bank reference</option>
                <option value="receipt">Receipt or invoice</option>
                <option value="delivery_photo">Delivery photo</option>
                <option value="chat">WhatsApp chat screenshot</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="txn_ref">Transaction reference</label>
              <input id="txn_ref" name="txn_ref" maxLength={80} placeholder="e.g. MP2610.1234.A56789" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="evidence_file">Photo or PDF (max 5 MB)</label>
            <input id="evidence_file" name="evidence_file" type="file" accept="image/*,application/pdf" />
            <span className="hint">Only moderators see your proof. The public sees a &quot;Supported&quot; or &quot;Verified purchase&quot; badge.</span>
          </div>
        </fieldset>

        {state.error && <p className="err" role="alert">{state.error}</p>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : existing ? "Update review" : "Post review"}</button>
        </div>
      </form>

      {existing && (
        <form action={deleteReview} style={{ marginTop: 24 }}>
          <input type="hidden" name="seller_id" value={sellerId} />
          <details>
            <summary className="muted" style={{ cursor: "pointer" }}>Delete my review</summary>
            <p className="muted">This removes your review and its proof from TrustAni.</p>
            <button className="btn danger" type="submit">Delete review</button>
          </details>
        </form>
      )}
    </>
  );
}
