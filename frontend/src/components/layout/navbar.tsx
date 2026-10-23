"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
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
  Search,
  MapPin,
  BarChart3,
  ClipboardList,
  Image,
  Settings,
  Users,
  Upload,
  Tag,
  Clock,
  Wand2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useCreatorType } from "@/lib/creator-nav";
import { SellWith3DverseLink } from "@/components/creator/sell-with-3dverse";
import { Wordmark } from "@/components/shared/wordmark";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [suggestions, setSuggestions] = useState<{ products: any[]; categories: string[] }>({ products: [], categories: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    setShowSuggestions(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (searchCategory) params.set("category", searchCategory);
    router.push(`/marketplace?${params.toString()}`);
  };

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 2) {
      setSuggestions({ products: [], categories: [] });
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.get<any>("/api/marketplace/suggestions", { q: value.trim() });
        setSuggestions(data);
        setShowSuggestions(true);
        setActiveIdx(-1);
      } catch {
        // silently fail
      }
    }, 220);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSuggestions = [
    ...suggestions.categories.map((c) => ({ type: "category", label: c })),
    ...suggestions.products.map((p) => ({ type: "product", label: p.title, sub: p.category, price: p.price, id: p.id })),
  ];

  // Determine portal context — /collaboration is a Creator Studio surface
  const isCreator = pathname.startsWith("/creator") || pathname.startsWith("/collaboration");
  const isPartner = pathname.startsWith("/partner");
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isMarketplace = !isCreator && !isPartner && !isAdmin && !isAuth;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Re-read on pathname change so the seller/designer nav stays in sync
  const { path: creatorPath, links: creatorLinks, topBarLinks } = useCreatorType([pathname]);

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

  // Hide navbar on auth pages
  if (isAuth) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getInitials = (email: string) => {
    return email?.slice(0, 2).toUpperCase() || "U";
  };

  const portalLabel = isCreator
    ? // Name the locked creator path alongside the portal, so it is always
      // clear which of the three the account is on.
      creatorPath
      ? `Creator Studio · ${creatorPath.label}`
      : "Creator Studio"
    : isPartner
    ? "Print Partner"
    : isAdmin
    ? "Admin"
    : "Marketplace";

  // Portal switcher — every portal the role allows, minus the one we're already in
  const portals = [
    {
      key: "marketplace",
      href: "/marketplace/home",
      label: "Marketplace",
      description: "Browse and buy prints",
      icon: Store,
      iconClass: "text-primary",
      active: isMarketplace,
      allowed: true,
    },
    {
      key: "creator",
      href: "/creator/dashboard",
      label: "Creator Studio",
      description: "Sell your designs",
      icon: Palette,
      iconClass: "text-ember",
      active: isCreator,
      allowed: user?.role === "creator" || user?.role === "admin",
    },
    {
      key: "partner",
      href: "/partner",
      label: "Print Partner Hub",
      description: "Manage print orders",
      icon: Printer,
      iconClass: "text-moss",
      active: isPartner,
      allowed: user?.role === "print_partner" || user?.role === "admin",
    },
    {
      key: "admin",
      href: "/admin/dashboard",
      label: "Admin Console",
      description: "Platform management",
      icon: Shield,
      iconClass: "text-destructive",
      active: isAdmin,
      allowed: user?.role === "admin",
    },
  ];

  const switchablePortals = portals.filter((p) => p.allowed && !p.active);

  // Settings are portal-specific — each portal has its own settings page
  const settingsHref = isCreator
    ? "/creator/settings"
    : isPartner
    ? "/partner/settings"
    : isAdmin
    ? "/admin/settings"
    : "/settings";

  // Studio/Console/Admin don't show nav links in the top bar (they use sidebar)
  const navLinks = [];

  // Accent color logic per portal — docs/brand/05-applications.md:
  // marketplace/customers→violet (primary), creator studio→ember, partner
  // console→moss, admin→neutral (no identity accent; colour there is status
  // only). Creator studio further refines by sub-path (studio/seller/
  // designer) via creatorPath — fall back to ember when that isn't known yet.
  const accentClass = isCreator
    ? creatorPath?.accent || "text-ember"
    : isPartner
    ? "text-moss"
    : isAdmin
    ? "text-foreground"
    : "text-primary";
  const accentBgClass = isCreator
    ? creatorPath?.accentBg || "bg-ember/10"
    : isPartner
    ? "bg-moss/10"
    : isAdmin
    ? "bg-secondary"
    : "bg-primary/10";

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
            {/* Left Section: Logo & Location */}
            <div className="flex items-center gap-4">
              <Link
                href={isAuthenticated ? "/marketplace/home" : "/"}
                className="flex items-center gap-1 group"
              >
                <Wordmark className="group-hover:opacity-80 transition-opacity" />
              </Link>

              {/* Creator path badge — the locked sub-role, shown across the Studio */}
              {isCreator && creatorPath && (
                <div
                  className={cn(
                    "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                    creatorPath.accentBg,
                    creatorPath.accent,
                    "border-current/20"
                  )}
                  title={creatorPath.tagline}
                >
                  <creatorPath.icon size={13} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {creatorPath.label}
                  </span>
                </div>
              )}

            </div>

            {/* Central Search Bar (Marketplace only) */}
            {isMarketplace && (
              <div ref={searchRef} className="hidden md:flex flex-1 max-w-4xl px-4 lg:px-8 relative">
                <div className="relative w-full shadow-sm rounded-md flex focus-within:ring-2 focus-within:ring-primary/80 transition-shadow bg-card overflow-hidden h-10">
                  <select
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="hidden sm:flex items-center h-full px-3 bg-muted border-r border-border hover:bg-muted/80 cursor-pointer transition-colors text-[13px] font-medium text-foreground appearance-none pr-6 focus:outline-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                  >
                    <option value="">All</option>
                    <option value="Tabletop">Tabletop</option>
                    <option value="Jewelry">Jewelry</option>
                    <option value="Cosplay">Cosplay</option>
                    <option value="Miniatures">Miniatures</option>
                    <option value="Home Decor">Home Decor</option>
                    <option value="Gadgets">Gadgets</option>
                    <option value="Architecture">Architecture</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Medical">Medical</option>
                    <option value="Gaming">Gaming</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Search 3DVerse"
                    className="flex-1 h-full pl-4 pr-4 bg-transparent text-[15px] focus:outline-none focus:ring-0"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      fetchSuggestions(e.target.value);
                    }}
                    onFocus={() => { if (searchQuery.length >= 2) setShowSuggestions(true); }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIdx((i) => Math.min(i + 1, allSuggestions.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIdx((i) => Math.max(i - 1, -1));
                      } else if (e.key === "Escape") {
                        setShowSuggestions(false);
                      } else if (e.key === "Enter") {
                        if (activeIdx >= 0 && allSuggestions[activeIdx]) {
                          const s = allSuggestions[activeIdx];
                          if (s.type === "category") {
                            setSearchCategory(s.label);
                            handleSearch("");
                          } else {
                            handleSearch(s.label);
                          }
                        } else {
                          handleSearch();
                        }
                      }
                    }}
                  />
                  <div
                    onClick={() => handleSearch()}
                    className="w-12 h-full flex items-center justify-center bg-ember hover:bg-ember-10 cursor-pointer text-foreground transition-colors"
                  >
                    <Search size={20} />
                  </div>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && allSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                    {suggestions.categories.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categories</div>
                        {suggestions.categories.map((cat, i) => {
                          const idx = i;
                          return (
                            <button
                              key={cat}
                              onMouseDown={() => { setSearchCategory(cat); setSearchQuery(""); setSuggestions({ products: [], categories: [] }); setShowSuggestions(false); router.push(`/marketplace?category=${encodeURIComponent(cat)}`); }}
                              className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/60 transition-colors", activeIdx === idx && "bg-muted")} 
                            >
                              <Tag size={13} className="text-primary shrink-0" />
                              <span className="font-medium">{cat}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {suggestions.products.length > 0 && (
                      <div>
                        <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Products</div>
                        {suggestions.products.map((p, i) => {
                          const idx = suggestions.categories.length + i;
                          return (
                            <button
                              key={p.id}
                              onMouseDown={() => { setShowSuggestions(false); router.push(`/marketplace/${p.id}`); }}
                              className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 transition-colors", activeIdx === idx && "bg-muted")}
                            >
                              <Search size={13} className="text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate block">{p.title}</span>
                                <span className="text-[11px] text-muted-foreground">{p.category}</span>
                              </div>
                              <span className="text-sm font-bold text-primary shrink-0">${p.price.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="border-t border-border px-4 py-2.5">
                      <button
                        onMouseDown={() => handleSearch()}
                        className="w-full flex items-center gap-2 text-[13px] text-primary font-semibold hover:underline"
                      >
                        <Search size={13} />
                        Search for &ldquo;{searchQuery}&rdquo;
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Central Navigation (Creator Studio only) */}
            {isCreator && (
              <div className="hidden lg:flex flex-1 items-center justify-center gap-1 px-4 overflow-x-auto no-scrollbar">
                {topBarLinks.map(link => {
                  const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== "/creator/dashboard");
                  return (
                    <Link 
                      key={link.href} 
                      href={link.href}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-colors whitespace-nowrap",
                        isActive
                          ? cn(creatorPath?.accentBg || "bg-ember/10", creatorPath?.accent || "text-ember")
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <link.icon size={16} className={cn(isActive ? "opacity-100" : "opacity-70")} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-4">
              {/* Creator Orders (Creator only) */}
              {isCreator && isAuthenticated && (
                <Link href="/creator/orders" className="hidden lg:flex flex-col leading-none hover:border-border border border-transparent px-2 py-1 rounded transition-colors cursor-pointer">
                  <span className="text-[10px] text-muted-foreground font-medium">Customer</span>
                  <span className="text-xs font-bold text-foreground">Orders</span>
                </Link>
              )}

              {/* Returns & Orders (Marketplace only) */}
              {isMarketplace && isAuthenticated && (
                <Link href="/orders" className="hidden lg:flex flex-col leading-none hover:border-border border border-transparent px-2 py-1 rounded transition-colors cursor-pointer">
                  <span className="text-[10px] text-muted-foreground font-medium">Returns</span>
                  <span className="text-xs font-bold text-foreground">& Orders</span>
                </Link>
              )}

              {/* Cart (marketplace only) */}
              {isMarketplace && (
                <Link href="/cart" className="relative group flex items-end gap-1 hover:border-border border border-transparent px-2 py-1 rounded transition-colors cursor-pointer">
                  <div className="relative">
                    <ShoppingCart size={24} />
                    {itemCount > 0 && (
                      <span className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-scale-in">
                        {itemCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-foreground hidden sm:block mb-0.5">Cart</span>
                </Link>
              )}

              {/* Auth */}
              {isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-2 hover:border-border border border-transparent px-2 py-1 rounded transition-colors cursor-pointer select-none">
                      <div className="flex flex-col items-start leading-none hidden sm:flex">
                        <span className="text-[10px] text-muted-foreground font-medium">Hello, {user.email?.split('@')[0]}</span>
                        <span className="text-xs font-bold text-foreground flex items-center gap-1">
                          Account & Portals <ChevronDown size={12} className="text-muted-foreground" />
                        </span>
                      </div>
                      <Avatar className="h-8 w-8 sm:hidden">
                        <AvatarFallback className={cn(accentBgClass, accentClass, "text-xs font-semibold")}>
                          {getInitials(user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-2 rounded-xl border border-border shadow-2xl">
                    {/* Active Account Card */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 mb-2 border border-border/50">
                      <Avatar className="h-10 w-10 shadow-sm border border-border">
                        <AvatarFallback className={cn(accentBgClass, accentClass, "font-bold")}>
                          {getInitials(user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <p className="text-sm font-bold truncate text-foreground">{user.email?.split('@')[0]}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        <p className={cn("text-[10px] uppercase font-bold mt-0.5 tracking-wider", accentClass)}>{portalLabel} (Active)</p>
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator />
                    
                      {/* Switcher Links — every portal the role allows, except the current one */}
                    {switchablePortals.length > 0 && (
                    <>
                    <div className="py-1">
                      <p className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase tracking-wider">Switch Portal</p>

                      {switchablePortals.map((portal) => (
                      <DropdownMenuItem key={portal.key} onClick={() => router.push(portal.href)} className="rounded-lg cursor-pointer py-2">
                        <portal.icon size={18} className={cn("mr-3", portal.iconClass)} />
                        <div className="flex flex-col">
                          <span className="font-medium">{portal.label}</span>
                          <span className="text-[10px] text-muted-foreground">{portal.description}</span>
                        </div>
                      </DropdownMenuItem>
                      ))}
                    </div>

                    <DropdownMenuSeparator />
                    </>
                    )}
                    
                    {!isCreator && (
                      <DropdownMenuItem onClick={() => router.push("/creator")} className="rounded-lg cursor-pointer py-2 text-ember focus:text-ember bg-ember/5 focus:bg-ember/10 mb-1 font-medium">
                        <Store size={16} className="mr-3" />
                        Sell with 3DVerse
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={() => router.push(settingsHref)} className="rounded-lg cursor-pointer py-2">
                      <Settings size={16} className="mr-3" />
                      Settings
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => router.push("/orders")} className="rounded-lg cursor-pointer py-2">
                      <Package size={16} className="mr-3" />
                      My Orders
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => router.push("/commissions")} className="rounded-lg cursor-pointer py-2">
                      <Wand2 size={16} className="mr-3" />
                      My Commissions
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive rounded-lg cursor-pointer py-2 mt-1">
                      <LogOut size={16} className="mr-3" />
                      Sign out
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
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Secondary Nav Tier Removed for cleaner aesthetic */}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-72 bg-card border-l border-border p-6 pt-20 animate-slide-in-from-right">
            <nav className="space-y-1">
              {(isMarketplace ? [
                { href: "/marketplace?category=All", label: "All", icon: Search },
                { href: "/marketplace?category=Deals", label: "Today's Deals", icon: Package },
                { href: "/marketplace?category=CustomerService", label: "Customer Service", icon: Shield },
              ] : [
                ...(isCreator ? creatorLinks : []),
                ...(isPartner ? [
                  { href: "/partner", label: "Print Queue", icon: Printer },
                  { href: "/partner/settings", label: "Settings", icon: Settings },
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
