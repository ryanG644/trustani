import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes the session instead.
          }
        },
      },
    }
  );
}

export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { sb, user: null, profile: null };
  const { data: profile } = await sb
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", data.user.id)
    .maybeSingle();
  return { sb, user: data.user, profile };
}
