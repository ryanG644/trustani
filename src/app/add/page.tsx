import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import AddForm from "./AddForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a seller" };

export default async function AddPage({ searchParams }: { searchParams: Promise<{ phone?: string; cat?: string }> }) {
  const { phone = "", cat = "" } = await searchParams;
  const { user } = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/add${phone ? `?phone=${phone}` : ""}`)}`);
  const cats = await getCategories();
  const category = cats.find((c) => c.id === cat) ?? cats[0];

  return (
    <>
      <h1 className="page-title">Add a seller</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "62ch" }}>
        List a business you bought from. Next you&apos;ll be asked to review them. Search first to make sure they aren&apos;t already listed.
      </p>
      <AddForm cats={cats} category={category} phone={phone} />
    </>
  );
}
