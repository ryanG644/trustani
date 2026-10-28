import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

async function saveName(form: FormData) {
  "use server";
  const { sb, user } = await currentUser();
  if (!user) return;
  const name = String(form.get("display_name") || "").trim().slice(0, 60);
  await sb.from("profiles").update({ display_name: name || "Buyer" }).eq("id", user.id);
  revalidatePath("/account");
}

export default async function Account() {
  const { user, profile } = await currentUser();
  if (!user) redirect("/login?next=/account");
  return (
    <>
      <h1 className="page-title">Account</h1>
      <p className="muted" style={{ marginTop: 0 }}>Signed in as {user.email ?? user.phone}.</p>
      <form action={saveName} className="stack">
        <div className="field">
          <label htmlFor="display_name">Name shown on your reviews</label>
          <input id="display_name" name="display_name" defaultValue={profile?.display_name ?? ""} maxLength={60} />
          <span className="hint">A first name or initials is fine.</span>
        </div>
        <div><button className="btn primary">Save name</button></div>
      </form>
      <form action={signOut} style={{ marginTop: 24 }}><button className="btn">Sign out</button></form>
    </>
  );
}
