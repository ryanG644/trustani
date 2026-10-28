import type { Category } from "./data";
import { supabaseServer } from "./supabase/server";

export async function getCategories(): Promise<Category[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("categories").select("*").order("sort");
  return (data ?? []) as Category[];
}

/** item key -> label across all categories */
export function itemLabels(cats: Category[]) {
  const m: Record<string, string> = {};
  for (const c of cats) for (const i of c.items) m[i.key] = i.label;
  return m;
}
export function unitLabels(cats: Category[]) {
  const m: Record<string, string> = {};
  for (const c of cats) for (const u of c.units) m[u.key] = u.label;
  return m;
}
