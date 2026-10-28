"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { PROVINCES, normalisePhone } from "@/lib/data";

export type AddState = { error?: string; existingId?: string };

export async function addSeller(_prev: AddState, form: FormData): Promise<AddState> {
  const { sb, user } = await currentUser();
  if (!user) return { error: "Sign in to add a seller." };

  const name = String(form.get("name") || "").trim();
  const province = String(form.get("province") || "");
  const categoryId = String(form.get("category_id") || "");
  const items = form.getAll("items").map(String);
  const rawPhones = String(form.get("phones") || "").split(/[,;/\n]+/).map((p) => p.trim()).filter(Boolean);
  const phones = [...new Set(rawPhones.map(normalisePhone).filter((p): p is string => !!p))];

  if (name.length < 2) return { error: "Enter the seller's name." };
  if (!PROVINCES.includes(province)) return { error: "Choose a province." };
  if (!categoryId) return { error: "Choose what they sell." };
  if (!phones.length) return { error: "Add at least one phone number. It's how buyers match a seller to the number that called them." };
  if (rawPhones.length !== phones.length) return { error: "One of the phone numbers doesn't look right. Use the format +263 77 123 4567." };

  const { data: clash } = await sb.from("seller_phones").select("seller_id").in("phone", phones).limit(1);
  if (clash?.length) return { error: "A seller with this phone number is already listed.", existingId: clash[0].seller_id };

  const { data: seller, error } = await sb.from("sellers").insert({
    name: name.slice(0, 100),
    province,
    town: String(form.get("town") || "").trim().slice(0, 60) || null,
    yard: String(form.get("yard") || "").trim().slice(0, 120) || null,
    delivers_to: String(form.get("delivers_to") || "").trim().slice(0, 120) || null,
    trucks: String(form.get("trucks") || "").trim().slice(0, 60) || null,
    categories: [categoryId],
    items,
  }).select("id").single();
  if (error || !seller) return { error: "The seller couldn't be saved. Try again." };

  const { error: phoneErr } = await sb.from("seller_phones").insert(phones.map((phone) => ({ phone, seller_id: seller.id })));
  if (phoneErr) return { error: "The seller was saved but a phone number wasn't. A moderator will fix it." };

  redirect(`/s/${seller.id}/review?cat=${categoryId}`);
}
