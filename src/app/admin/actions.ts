"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/supabase/server";

async function mod() {
  const ctx = await currentUser();
  if (!ctx.user || !["moderator", "admin"].includes(ctx.profile?.role ?? "")) throw new Error("Moderators only");
  return ctx;
}

export async function decideEvidence(form: FormData) {
  const { sb, user } = await mod();
  const id = String(form.get("id"));
  const decision = String(form.get("decision"));
  const tier = decision === "t3" ? 3 : decision === "t2" ? 2 : null;
  await sb.from("evidence").update({
    status: tier ? "accepted" : "rejected", granted_tier: tier, reviewed_by: user!.id,
  }).eq("id", id);
  revalidatePath("/admin");
}

export async function addSignal(form: FormData) {
  const { sb } = await mod();
  const seller_id = String(form.get("seller_id"));
  const url = String(form.get("url") || "").trim();
  if (!/^https?:\/\//.test(url)) return;
  await sb.from("signals").insert({ seller_id, url, note: String(form.get("note") || "").slice(0, 300) || null });
  revalidatePath("/admin");
}

export async function setVerified(form: FormData) {
  const { sb } = await mod();
  await sb.from("sellers").update({ verified: form.get("verified") === "1" }).eq("id", String(form.get("seller_id")));
  revalidatePath("/admin");
}

export async function removeReview(form: FormData) {
  const { sb } = await mod();
  await sb.from("reviews").update({ status: "removed" }).eq("id", String(form.get("id")));
  revalidatePath("/admin");
}

const PROFILES = ["local_shona", "local_ndebele", "local_english", "foreign", "diaspora"];

/** Paste CSV: phone,item,qty,unit,area,profile,quote_usd,shopper,notes */
export async function importQuotes(form: FormData) {
  const { sb } = await mod();
  const round = String(form.get("round") || "").trim();
  const lines = String(form.get("csv") || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: Record<string, unknown>[] = [];
  for (const line of lines) {
    if (/^phone,/i.test(line)) continue;
    const [phone, item, qty, unit, area, profile, quote, shopper, ...notes] = line.split(",").map((s) => s.trim());
    if (!PROFILES.includes(profile)) continue;
    const { data } = await sb.from("seller_phones").select("seller_id").eq("phone", phone).maybeSingle();
    if (!data) continue;
    out.push({ round, seller_id: data.seller_id, item, qty: Number(qty) || 1, unit, area, profile, quote_usd: Number(quote), shopper, notes: notes.join(",") || null });
  }
  if (out.length) await sb.from("shop_quotes").insert(out);
  revalidatePath("/admin");
}
