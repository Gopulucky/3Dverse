"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Menu,
  X,
  LogOut,
  Package,
  Palette,
  LayoutDashboard,
  Store,
  Heart,
  ChevronDown,
  Printer,
  Shield,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { api } from "@/lib/api";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout, hydrate } = useAuthStore();
  const { itemCount, setItemCount } = useCartStore();

  // Determine portal context
  const isCreator = pathname.startsWith("/creator");
  const isPartner = pathname.startsWith("/partner");
  const isAdmin = pathname.startsWith("/admin");
  const isRoot = pathname === "/";
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isMarketplace = !isCreator && !isPartner && !isAdmin && !isRoot && !isAuth;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Fetch cart count
  useEffect(() => {
    if (isAuthenticated) {
      api.get<{ items?: unknown[] }>("/api/cart/")
        .then((cart) => setItemCount(cart?.items?.length || 0))
        .catch(() => {});
    }
  }, [isAuthenticated, setItemCount]);

  // Scroll handler
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (isRoot || isAuth) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getInitials = (email: string) => {
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  const portalLabel = isCreator
    ? "Creator Studio"
    : isPartner
    ? "Print Partner"
    : isAdmin
    ? "Admin"
    : "Marketplace";

  // Marketplace nav links (shown in top nav since marketplace has no sidebar)
  const marketplaceLinks = [
    { href: "/marketplace/home", label: "Home", icon: Store },
    { href: "/marketplace", label: "Browse", icon: Package },
    { href: "/wishlist", label: "Wishlist", icon: Heart },
    { href: "/orders", label: "Orders", icon: Package },
  ];

  // Studio/Console/Admin don't show nav links in the top bar (they use sidebar)
  const navLinks = isMarketplace ? marketplaceLinks : [];

  // Accent color logic per portal
  const accentClass = isPartner ? "text-calibration-cyan" : "text-primary";
  const accentBgClass = isPartner ? "bg-calibration-cyan/10" : "bg-primary/10";

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-200",
          scrolled
            ? "glass-strong shadow-lg shadow-black/5"
            : "bg-background/80 backdrop-blur-md border-b border-border/50"
        )}
      >
        <div className="h-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-full items-center">
            {/* Logo + Portal label */}
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center gap-1 group"
              >
                <span className="text-2xl font-bold tracking-tight font-display">
                  <span className="text-gradient-primary">3D</span>
                  <span className="text-foreground group-hover:text-foreground/80 transition-colors">
                    Verse
                  </span>
                </span>
              </Link>

              {/* Portal badge */}
              <Badge variant="secondary" className="hidden sm:flex text-xs font-medium">
                {portalLabel}
              </Badge>

              {/* Desktop navigation (marketplace only — Studio/Console use sidebar) */}
              {navLinks.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                          isActive
                            ? cn(accentBgClass, accentClass)
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        <link.icon size={16} />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Cart (marketplace only) */}
              {isMarketplace && (
                <Link href="/cart" className="relative group">
                  <Button variant="ghost" size="icon" className="relative">
                    <ShoppingCart size={20} />
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-scale-in">
                        {itemCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )}

              {/* Auth */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 px-2"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={cn(accentBgClass, accentClass, "text-xs font-semibold")}>
                          {getInitials(user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium">{user.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {user.role?.replace("_", " ")}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* Role switcher */}
                    <DropdownMenuItem onClick={() => router.push("/marketplace/home")}>
                      <Store size={16} />
                      Marketplace
                    </DropdownMenuItem>
                    {(user.role === "creator" || user.role === "admin") && (
                      <DropdownMenuItem onClick={() => router.push("/creator/dashboard")}>
                        <Palette size={16} />
                        Creator Studio
                      </DropdownMenuItem>
                    )}
                    {(user.role === "print_partner" || user.role === "admin") && (
                      <DropdownMenuItem onClick={() => router.push("/partner")}>
                        <Printer size={16} />
                        Print Partner
                      </DropdownMenuItem>
                    )}
                    {user.role === "admin" && (
                      <DropdownMenuItem onClick={() => router.push("/admin/dashboard")}>
                        <Shield size={16} />
                        Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/orders")}>
                      <Package size={16} />
                      My Orders
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut size={16} />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/login")}
                  >
                    Log in
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => router.push("/register")}
                  >
                    Sign up
                  </Button>
                </div>
              )}

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-72 bg-card border-l border-border p-6 pt-20 animate-slide-in-from-right">
            <nav className="space-y-1">
              {(isMarketplace ? marketplaceLinks : [
                ...(isCreator ? [
                  { href: "/creator/dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { href: "/creator/products", label: "My Products", icon: Package },
                  { href: "/creator/products/new", label: "Upload", icon: Palette },
                ] : []),
                ...(isPartner ? [
                  { href: "/partner", label: "Print Queue", icon: Printer },
                ] : []),
                ...(isAdmin ? [
                  { href: "/admin/dashboard", label: "Analytics", icon: Shield },
                ] : []),
              ]).map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? cn(accentBgClass, accentClass)
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <link.icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
