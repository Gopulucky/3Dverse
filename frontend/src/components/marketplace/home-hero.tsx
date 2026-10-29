import Link from "next/link";
import { ProductPrices } from "@/components/shared/product-prices";
import { productImage, type ProductCardData } from "@/lib/marketplace";
import { ProductImage } from "@/components/shared/product-image";

export function HomeHero({ product }: { product?: ProductCardData }) {
  return (
    <section className={`store-hero${product ? "" : " store-hero--type"}`} aria-labelledby="home-title">
      <div className="store-container store-hero-layout">
        <div className="store-hero-copy">
          <h1 id="home-title">
            <span>Buy 3D models</span><span>or finished prints.</span>
          </h1>
          <p>Choose a finished 3D printed product delivered to you in India, or a digital model file to use with your own 3D printer.</p>
          <div className="store-actions">
            <Link href="/marketplace?format=physical" className="store-primary">Shop printed products</Link>
            <Link href="/marketplace?format=digital" className="market-text-link">Browse digital models</Link>
          </div>
          <p className="store-hero-note">Each listing shows the formats its creator offers. No printer needed for a finished print.</p>
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
              <ProductPrices product={product} />
            </figcaption>
          </figure>
        )}
      </div>
    </section>
  );
}
