import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Wordmark } from "@/components/shared/wordmark";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block">
              <Wordmark size="sm" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              The infrastructure connecting digital creators, AI validation,
              distributed manufacturing, and global fulfillment.
            </p>
            <p className="mt-2 text-xs text-primary font-semibold">
              {BRAND.tagline}
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 font-display">
              For Customers
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/marketplace", label: "Browse All" },
                { href: "/marketplace?category=Tabletop", label: "Tabletop" },
                { href: "/marketplace?category=Miniatures", label: "Miniatures" },
                { href: "/marketplace?category=Home+Decor", label: "Home Decor" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Creators */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 font-display">
              For Creators
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/creator/dashboard", label: "Creator Dashboard" },
                { href: "/creator/products/new", label: "Upload a Design" },
                { href: "/register", label: "Become a Creator" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Partners */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 font-display">
              For Print Partners
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/partner", label: "Partner Console" },
                { href: "/register", label: "Become a Partner" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4 font-display">
              Company
            </h4>
            <ul className="space-y-2.5">
              {[
                { href: "/about", label: "About" },
                { href: "/brand", label: "Brand" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} 3DVerse. All rights reserved.
          </p>
          <div className="flex gap-6">
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              Privacy Policy
            </span>
            <span className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              Terms of Service
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
