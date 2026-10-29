import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { productImage, type ProductCardData } from "@/lib/marketplace";
import { ProductImage } from "@/components/shared/product-image";

export function HomeHero({ product }: { product?: ProductCardData }) {
  return (
    <section className={`store-hero${product ? "" : " store-hero--type"}`} aria-labelledby="home-title">
      <div className="store-container store-hero-layout">
        <div className="store-hero-copy">
          <h1 id="home-title">
            {BRAND.tagline.split(". ").map((line, index, lines) => (
              <span key={line}>{line}{index < lines.length - 1 ? "." : ""}</span>
            ))}
          </h1>
          <p>Discover 3D designs, download a model, or order a physical print.</p>
          <div className="store-actions">
            <a href="#featured" className="store-primary">Browse the marketplace</a>
            <Link href="/creator" className="market-text-link">Sell with 3DVerse</Link>
          </div>
        </div>
        {product && (
          <figure className="store-hero-product">
            <Link href={`/marketplace/${product.id}`} className="store-hero-image" aria-label={`Explore ${product.title}`}>
              <ProductImage src={productImage(product)} title={product.title} priority />
            </Link>
            <figcaption className="store-hero-caption">
              <div>
                <h2><Link href={`/marketplace/${product.id}`}>{product.title}</Link></h2>
                {product.creator_name && <p>By {product.creator_name}</p>}
              </div>
              {product.price != null && <span className="market-price">${product.price.toFixed(2)}</span>}
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
