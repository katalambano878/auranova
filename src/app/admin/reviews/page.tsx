import { moderateReview } from "@/server/actions/admin";
import { supabaseAdmin, throwIf } from "@/server/db";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const { data: reviews, error } = await supabaseAdmin().from("Review").select("*, product:Product(name)").order("createdAt", { ascending: false }).limit(80);
  throwIf(error);
  return (
    <main>
      <h1 className="font-serif text-4xl">Reviews</h1>
      <p className="mt-2 text-sm text-stone">Sample reviews stay labelled and are never marked as verified purchases.</p>
      <ul className="mt-6 space-y-4">
        {(reviews || []).map((review) => (
          <li key={review.id} className="border border-line p-4 text-sm">
            <p className="font-medium">{review.product?.name} · {review.rating}/5 · {review.status.toLowerCase()}{review.isSample ? " · sample" : ""}</p>
            <p className="mt-2">{review.body}</p>
            <p className="mt-1 text-stone">{review.authorName}</p>
            <div className="mt-3 flex gap-2">
              {(["PUBLISHED", "HIDDEN", "REJECTED"] as const).map((status) => (
                <form key={status} action={async () => { "use server"; await moderateReview(review.id, status); }}>
                  <Button type="submit" variant="line" size="sm">{status.toLowerCase()}</Button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
