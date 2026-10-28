"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PROVINCES, type Category } from "@/lib/data";
import { addSeller, type AddState } from "./actions";

export default function AddForm({ cats, category, phone }: { cats: Category[]; category: Category; phone: string }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addSeller, {});
  const [catId, setCatId] = useState(category.id);
  const cat = cats.find((c) => c.id === catId) ?? category;

  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="name">Business or trading name</label>
        <input id="name" name="name" required maxLength={100} />
      </div>
      <div className="field">
        <label htmlFor="phones">Phone / WhatsApp numbers</label>
        <input id="phones" name="phones" required defaultValue={phone} placeholder="+263 77 123 4567, 0712 345 678" />
        <span className="hint">Separate several numbers with commas.</span>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="province">Province</label>
          <select id="province" name="province" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {PROVINCES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="town">Town or suburb</label>
          <input id="town" name="town" maxLength={60} placeholder="e.g. Ruwa, Pumula, Mutare CBD" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="category_id">What they sell</label>
        <select id="category_id" name="category_id" value={catId} onChange={(e) => setCatId(e.target.value)}>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <fieldset className="field">
        <legend>Products</legend>
        <div className="checks">
          {cat.items.map((i) => (
            <label key={i.key}><input type="checkbox" name="items" value={i.key} />{i.label}</label>
          ))}
        </div>
      </fieldset>
      <div className="grid2">
        <div className="field">
          <label htmlFor="yard">Yard, shop or pit location</label>
          <input id="yard" name="yard" maxLength={120} placeholder="Landmark or road" />
        </div>
        <div className="field">
          <label htmlFor="delivers_to">Delivers to</label>
          <input id="delivers_to" name="delivers_to" maxLength={120} placeholder="Areas covered" />
        </div>
      </div>
      {cat.id === "aggregates" && (
        <div className="field">
          <label htmlFor="trucks">Truck sizes</label>
          <input id="trucks" name="trucks" maxLength={60} placeholder="e.g. 7t tipper, 30t" />
        </div>
      )}
      {state.error && (
        <p className="err" role="alert">
          {state.error} {state.existingId && <Link href={`/s/${state.existingId}`}>Open that listing</Link>}
        </p>
      )}
      <div><button className="btn primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save and review"}</button></div>
    </form>
  );
}
