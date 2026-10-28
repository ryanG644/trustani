export const PROVINCES = [
  "Harare", "Bulawayo", "Manicaland", "Mashonaland Central", "Mashonaland East",
  "Mashonaland West", "Masvingo", "Matabeleland North", "Matabeleland South", "Midlands",
];

export type Dim = { key: string; label: string; hint: string; weight: number };
export type Opt = { key: string; label: string };
export type Category = { id: string; name: string; dims: Dim[]; items: Opt[]; units: Opt[]; sort: number };

export type SellerRow = {
  id: string; name: string; province: string; town: string | null; yard: string | null;
  delivers_to: string | null; trucks: string | null; categories: string[]; items: string[];
  source: string; source_url: string | null; verified: boolean; created_by: string | null;
  created_at: string; phones: string[]; review_count: number; verified_count: number;
  score: number | null; short_count: number; measured_count: number; short_flag: boolean;
  discrim_flag: boolean; max_spread: number | null; signal_count: number;
};

export const TIER_LABEL: Record<number, string> = {
  1: "Unverified",
  2: "Supported",
  3: "Verified purchase",
};

/** Normalise a Zimbabwean or international number to E.164. Returns null if it can't. */
export function normalisePhone(raw: string): string | null {
  let s = (raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) return /^\+\d{8,15}$/.test(s) ? s : null;
  if (s.startsWith("263")) return /^263\d{8,10}$/.test(s) ? "+" + s : null;
  if (s.startsWith("0")) s = s.slice(1);
  // Local mobile (7x xxx xxxx) or fixed line (2x / 8x)
  if (/^\d{8,10}$/.test(s)) return "+263" + s;
  return null;
}

export function formatPhone(e164: string) {
  const m = e164.match(/^\+263(7\d)(\d{3})(\d{4})$/);
  return m ? `+263 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

export function optLabel(list: Opt[] | undefined, key: string | null | undefined) {
  if (!key) return "";
  return list?.find((o) => o.key === key)?.label ?? key;
}

export function money(n: number) {
  return "$" + (n < 100 ? n.toFixed(2).replace(/\.00$/, "") : Math.round(n).toLocaleString("en-US"));
}
