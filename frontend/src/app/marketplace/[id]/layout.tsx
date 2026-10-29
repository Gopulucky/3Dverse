import type { Metadata } from "next";
import { API_URL } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

type PublicProduct = {
  id: number;
  title: string;
  description?: string | null;
  price?: number;
  currency?: string;
  avg_rating?: number | null;
  review_count?: number;
  media?: { media_url: string; is_primary?: boolean }[];
};

async function getProduct(id: string): Promise<PublicProduct | undefined> {
  if (!/^\d+$/.test(id)) return undefined;
  try {
    const res = await fetch(`${API_URL}/api/marketplace/products/${id}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

function imageUrl(p: PublicProduct): string | undefined {
  const m = p.media?.find((x) => x.is_primary) ?? p.media?.[0];
  if (!m?.media_url) return undefined;
  return m.media_url.startsWith("http") ? m.media_url : `${API_URL}${m.media_url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: "Model" };

  const description =
    product.description?.replace(/\s+/g, " ").trim().slice(0, 160) ||
    `${product.title} — a printable 3D model on 3DVerse.`;
  const image = imageUrl(product);
  return {
    title: product.title,
    description,
    alternates: { canonical: `/marketplace/${product.id}` },
    openGraph: { title: product.title, description, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.title, description },
  };
}

export default async function ProductLayout({ params, children }: Props) {
  const { id } = await params;
  const product = await getProduct(id);

  // schema.org Product data lets search engines show price and rating in results.
  const jsonLd = product && {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: imageUrl(product),
    offers: {
      "@type": "Offer",
      price: (product.price ?? 0).toFixed(2),
      priceCurrency: product.currency || "INR",
    },
    ...(product.review_count && product.avg_rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.avg_rating,
            reviewCount: product.review_count,
          },
        }
      : {}),
  };

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // "<" is escaped so a title like "</script>" can't break out of the tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
      {children}
    </>
  );
}
