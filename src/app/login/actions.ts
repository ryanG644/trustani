"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { normalisePhone } from "@/lib/data";

export type LoginState = { error?: string; sent?: "email" | "phone"; phone?: string; next?: string };

const site = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/");

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const sb = await supabaseServer();
  const next = safeNext(String(form.get("next") || "/"));
  const email = String(form.get("email") || "").trim();
  const rawPhone = String(form.get("phone") || "").trim();

  if (rawPhone) {
    const phone = normalisePhone(rawPhone);
    if (!phone) return { error: "That number doesn't look right. Use the format +263 77 123 4567.", next };
    const { error } = await sb.auth.signInWithOtp({ phone });
    if (error) return { error: "We couldn't send a code to that number. Try email instead.", next };
    return { sent: "phone", phone, next };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address.", next };
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${site()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: "We couldn't send the sign-in link. Check the address and try again.", next };
  return { sent: "email", next };
}

export async function verifyPhone(_prev: LoginState, form: FormData): Promise<LoginState> {
  const sb = await supabaseServer();
  const phone = String(form.get("phone") || "");
  const token = String(form.get("token") || "").replace(/\D/g, "");
  const next = safeNext(String(form.get("next") || "/"));
  const { error } = await sb.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { error: "That code didn't work. Check it and try again.", sent: "phone", phone, next };
  redirect(next);
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}
