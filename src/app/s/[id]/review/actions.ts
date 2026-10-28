"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";

export type ReviewState = { error?: string };

const LOADS = ["full", "slightly_short", "clearly_short", "not_measured"];
const EVIDENCE_KINDS = ["payment_ref", "receipt", "delivery_photo", "chat", "other"];
const MAX_FILE = 5 * 1024 * 1024;

export async function saveReview(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const { sb, user } = await currentUser();
  if (!user) return { error: "Sign in to post a review." };

  const sellerId = String(form.get("seller_id") || "");
  const categoryId = String(form.get("category_id") || "");
  const cat = (await getCategories()).find((c) => c.id === categoryId);
  if (!cat) return { error: "Choose what you bought." };

  const ratings: Record<string, number> = {};
  for (const d of cat.dims) {
    const v = Number(form.get(`r_${d.key}`) || 0);
    if (v >= 1 && v <= 5) ratings[d.key] = v;
  }
  if (!ratings.overall) return { error: "Give an overall rating from 1 to 5." };

  const item = String(form.get("item") || "") || null;
  const qty = Number(form.get("qty") || 0) || null;
  const unit = String(form.get("unit") || "") || null;
  const paid = Number(form.get("paid") || 0) || null;
  if (paid && !qty) return { error: "Add the quantity so the price per unit can be worked out." };
  const month = String(form.get("month") || "");
  const load = String(form.get("load") || "");
  const body = String(form.get("body") || "").trim().slice(0, 2000) || null;

  const row = {
    seller_id: sellerId,
    category_id: cat.id,
    ratings,
    load_status: LOADS.includes(load) ? load : null,
    item, qty, unit, paid_usd: paid,
    purchase_month: /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : null,
    body,
  };

  const { data: existing } = await sb.from("reviews").select("id").eq("seller_id", sellerId).eq("author_id", user.id).maybeSingle();
  let reviewId = existing?.id as string | undefined;
  if (reviewId) {
    const { error } = await sb.from("reviews").update(row).eq("id", reviewId);
    if (error) return { error: "Your review couldn't be saved. Try again." };
  } else {
    const { data, error } = await sb.from("reviews").insert(row).select("id").single();
    if (error) return { error: "Your review couldn't be saved. Try again." };
    reviewId = data.id;
  }

  // Optional evidence: a payment reference and/or a file. Moderators decide the tier.
  const kind = String(form.get("evidence_kind") || "");
  const txn = String(form.get("txn_ref") || "").trim().slice(0, 80);
  const file = form.get("evidence_file");
  const hasFile = file instanceof File && file.size > 0;
  if ((txn || hasFile) && EVIDENCE_KINDS.includes(kind)) {
    let storagePath: string | null = null;
    if (hasFile) {
      if (file.size > MAX_FILE) return { error: "Evidence files must be under 5 MB. Your review was saved; add a smaller file." };
      if (!/^(image\/|application\/pdf)/.test(file.type)) return { error: "Upload a photo or PDF. Your review was saved." };
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
      storagePath = `${user.id}/${reviewId}/${Date.now()}_${safe}`;
      const { error } = await sb.storage.from("evidence").upload(storagePath, file, { contentType: file.type });
      if (error) return { error: "The evidence file didn't upload. Your review was saved; try the file again." };
    }
    await sb.from("evidence").insert({ review_id: reviewId, kind, txn_ref: txn || null, storage_path: storagePath });
  }

  revalidatePath(`/s/${sellerId}`);
  redirect(`/s/${sellerId}?posted=1`);
}

export async function deleteReview(form: FormData) {
  const { sb, user } = await currentUser();
  if (!user) return;
  const sellerId = String(form.get("seller_id") || "");
  await sb.from("reviews").delete().eq("seller_id", sellerId).eq("author_id", user.id);
  revalidatePath(`/s/${sellerId}`);
  redirect(`/s/${sellerId}`);
}
