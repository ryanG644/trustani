"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/supabase/server";

export type QuoteState = { ok?: string; error?: string };

const PROFILES = ["local_shona", "local_ndebele", "local_english", "foreign", "diaspora"];

export async function saveQuote(_prev: QuoteState, form: FormData): Promise<QuoteState> {
  const { sb, user, profile } = await currentUser();
  if (!user) return { error: "Sign in first." };
  if (!["shopper", "moderator", "admin"].includes(profile?.role ?? "")) return { error: "Your account isn't set up as a shopper yet." };

  const seller_id = String(form.get("seller_id") || "");
  const round = String(form.get("round") || "").slice(0, 60);
  const shopProfile = String(form.get("profile") || "");
  const item = String(form.get("item") || "");
  const qty = Number(form.get("qty") || 0);
  const area = String(form.get("area") || "").slice(0, 60);
  const quote = Number(String(form.get("quote") || "").replace(/[^\d.]/g, ""));
  const delivered = form.get("delivered") === "on";
  const notes = String(form.get("notes") || "").trim().slice(0, 500) || null;
  const phone_called = String(form.get("phone_called") || "") || null;

  if (!PROFILES.includes(shopProfile)) return { error: "Pick which caller you are at the top of the page." };
  if (!(qty > 0)) return { error: "Set the quantity at the top of the page." };
  if (!(quote > 0)) return { error: "Enter the total price they quoted, in US dollars." };

  const row = {
    round, seller_id, item, qty, unit: "m3", area, profile: shopProfile, quote_usd: quote,
    delivered, notes, phone_called, shopper: profile?.display_name ?? null, quoted_at: new Date().toISOString(),
  };
  const { data: existing } = await sb.from("shop_quotes").select("id")
    .eq("round", round).eq("seller_id", seller_id).eq("profile", shopProfile).eq("created_by", user.id).maybeSingle();
  const { error } = existing
    ? await sb.from("shop_quotes").update(row).eq("id", existing.id)
    : await sb.from("shop_quotes").insert(row);
  if (error) return { error: "That quote didn't save. Check your connection and tap Save again." };
  revalidatePath("/shop");
  return { ok: `Saved $${quote}` };
}
