// Import a lead file (data/leads/*.json) into Supabase as unrated seller listings.
// Usage: node --env-file=.env.local scripts/import-leads.mjs data/leads/harare-aggregates.json
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Safe to re-run: sellers are matched by phone.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) {
  console.error("Pass a lead file, e.g. data/leads/harare-aggregates.json");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const lead = JSON.parse(readFileSync(file, "utf8"));
const observed = lead.collected_on;

let created = 0, matched = 0, prices = 0;
for (const s of lead.sellers) {
  const { data: existing } = await sb.from("seller_phones").select("seller_id").in("phone", s.phones).limit(1);
  let sellerId = existing?.[0]?.seller_id;

  if (!sellerId) {
    const { data, error } = await sb.from("sellers").insert({
      name: s.aka?.length ? `${s.name}` : s.name,
      province: s.province ?? lead.area ?? "Harare",
      town: s.town ?? null,
      yard: s.yard ?? null,
      delivers_to: s.delivers_to ?? null,
      categories: [lead.category],
      items: s.items,
      source: "lead",
      source_url: s.source_url,
    }).select("id").single();
    if (error) { console.error(s.name, error.message); continue; }
    sellerId = data.id;
    created++;
  } else {
    matched++;
  }

  const phoneRows = s.phones.map((phone) => ({ phone, seller_id: sellerId }));
  await sb.from("seller_phones").upsert(phoneRows, { onConflict: "phone", ignoreDuplicates: true });

  // Only add advertised prices for newly created sellers, so re-runs don't double count.
  if (!existing?.length && s.prices?.length) {
    const rows = s.prices.map(([item, usd]) => ({
      seller_id: sellerId, category_id: lead.category, item, unit: "m3", price_usd: usd,
      province: s.province ?? lead.area ?? "Harare", town: s.town ?? null,
      source: "listing", source_url: s.source_url, observed_on: observed,
    }));
    const { error } = await sb.from("price_reports").insert(rows);
    if (!error) prices += rows.length;
  }
}
console.log(`Sellers created: ${created}, already listed: ${matched}, advertised prices: ${prices}`);
