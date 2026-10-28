"use client";

import { useActionState } from "react";
import { saveQuote, type QuoteState } from "./actions";

type Props = {
  sellerId: string; round: string; profile: string; item: string; qty: number; area: string;
  phone: string | null; saved: { quote_usd: number; delivered: boolean | null; notes: string | null } | null;
};

export default function QuoteForm(p: Props) {
  const [state, action, pending] = useActionState<QuoteState, FormData>(saveQuote, {});
  const id = p.sellerId.slice(0, 8);
  return (
    <form action={action} className="quote-form">
      <input type="hidden" name="seller_id" value={p.sellerId} />
      <input type="hidden" name="round" value={p.round} />
      <input type="hidden" name="profile" value={p.profile} />
      <input type="hidden" name="item" value={p.item} />
      <input type="hidden" name="qty" value={p.qty} />
      <input type="hidden" name="area" value={p.area} />
      <input type="hidden" name="phone_called" value={p.phone ?? ""} />
      <div className="quote-row">
        <label className="field" htmlFor={`q_${id}`} style={{ flex: "1 1 140px" }}>
          <span>Total quoted (US$)</span>
          <input id={`q_${id}`} name="quote" inputMode="decimal" required defaultValue={p.saved?.quote_usd ?? ""} placeholder="e.g. 220" />
        </label>
        <label className="checkline" htmlFor={`d_${id}`}>
          <input id={`d_${id}`} type="checkbox" name="delivered" defaultChecked={p.saved?.delivered ?? true} />
          Includes delivery
        </label>
      </div>
      <label className="field" htmlFor={`n_${id}`}>
        <span>Notes (delivery day, payment terms, anything odd)</span>
        <input id={`n_${id}`} name="notes" maxLength={500} defaultValue={p.saved?.notes ?? ""} />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" disabled={pending}>{pending ? "Saving…" : p.saved ? "Update quote" : "Save quote"}</button>
        {state.ok && <span className="ok" role="status">{state.ok}</span>}
        {state.error && <span className="err" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
