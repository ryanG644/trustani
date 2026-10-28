import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";
import { getCategories } from "@/lib/categories";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write a review" };

export default async function ReviewPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string }> }) {
  const { id } = await params;
  const { cat: catParam } = await searchParams;
  const { sb, user } = await currentUser();
  if (!user) redirect(`/login?next=/s/${id}/review`);

  const [{ data: seller }, { data: existing }, cats] = await Promise.all([
    sb.from("sellers").select("id, name, categories, items").eq("id", id).maybeSingle(),
    sb.from("reviews").select("*").eq("seller_id", id).eq("author_id", user.id).maybeSingle(),
    getCategories(),
  ]);
  if (!seller) notFound();

  const catId = catParam || existing?.category_id || seller.categories?.[0] || cats[0]?.id;
  const cat = cats.find((c) => c.id === catId) ?? cats[0];

  return (
    <>
      <p style={{ margin: "0 0 12px" }}><Link href={`/s/${id}`} className="muted">← {seller.name}</Link></p>
      <h1 className="page-title">Review {seller.name}</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "62ch" }}>
        Say what happened, plainly. Reviews with proof of payment or delivery count more in the score.
        Don&apos;t include anyone&apos;s home address or ID numbers.
      </p>

      <nav className="chips" aria-label="What did you buy?" style={{ margin: "8px 0 16px" }}>
        {cats.map((c) => (
          <Link key={c.id} href={`/s/${id}/review?cat=${c.id}`} className={`chip ${c.id === cat.id ? "trust" : ""}`} style={{ textDecoration: "none", fontSize: 13, padding: "4px 10px" }}>
            {c.name}
          </Link>
        ))}
      </nav>

      <ReviewForm sellerId={id} cat={cat} existing={existing ?? null} />
    </>
  );
}
