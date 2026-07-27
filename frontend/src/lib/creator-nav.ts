"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  Package,
  Palette,
  ClipboardList,
  Image,
  Settings,
  Users,
  Upload,
  Factory,
  Store,
  Boxes,
  Wand2,
  type LucideIcon,
} from "lucide-react";

/**
 * Account-level creator path, chosen once on entering the Creator Studio and
 * locked afterwards. Mirrors the `creatortype` enum on the backend.
 */
export type CreatorType = "studio" | "seller" | "designer";

export interface CreatorPath {
  type: CreatorType;
  label: string;
  tagline: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  /** Collaborate is for the two designer paths; the seller never prints. */
  canCollaborate: boolean;
}

export const CREATOR_PATHS: CreatorPath[] = [
  {
    type: "studio",
    label: "Studio",
    tagline: "I design and print my own work",
    description:
      "You own a printer. Design, print and ship your products yourself — and when orders outgrow your machines, hand the overflow to a print partner.",
    bullets: [
      "Design and print in-house",
      "Manage your own inventory and orders",
      "Offload overflow to print partners",
    ],
    icon: Factory,
    accent: "text-ember",
    accentBg: "bg-ember/10",
    canCollaborate: true,
  },
  {
    type: "seller",
    label: "Seller",
    tagline: "I just want to sell my designs",
    description:
      "Sell your designs directly on the 3DVerse marketplace. No printer, no partners, no logistics — you list, customers buy.",
    bullets: [
      "List and sell designs directly",
      "No hardware required",
      "No collaboration overhead",
    ],
    icon: Store,
    accent: "text-primary",
    accentBg: "bg-primary/10",
    canCollaborate: false,
  },
  {
    type: "designer",
    label: "Designer",
    tagline: "I design; partners print for me",
    description:
      "You design but don't own a printer. Team up with certified print partners who manufacture and ship your designs for you.",
    bullets: [
      "Design without owning hardware",
      "Collaborate with certified print partners",
      "Partners handle printing and shipping",
    ],
    icon: Palette,
    accent: "text-moss",
    accentBg: "bg-moss/10",
    canCollaborate: true,
  },
];

export function getCreatorPath(type: CreatorType | null | undefined) {
  return CREATOR_PATHS.find((p) => p.type === type) || null;
}

export interface CreatorNavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Kept out of the desktop top bar to keep it short. Orders and Settings are
   * already in the desktop chrome (the "Customer Orders" quick link and the
   * Account & Portals dropdown); Analytics is not. All of them still appear in
   * the mobile menu, which has no such shortcuts.
   */
  secondary?: boolean;
}

const DASHBOARD: CreatorNavLink = {
  href: "/creator/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};
const ANALYTICS: CreatorNavLink = {
  href: "/creator/analytics",
  label: "Analytics",
  icon: BarChart3,
  secondary: true,
};
const ORDERS: CreatorNavLink = {
  href: "/creator/orders",
  label: "Orders",
  icon: ClipboardList,
  secondary: true,
};
const COLLABORATE: CreatorNavLink = {
  href: "/collaboration",
  label: "Collaborate",
  icon: Users,
};
const PORTFOLIO: CreatorNavLink = {
  href: "/creator/portfolio",
  label: "Portfolio",
  icon: Image,
};
const SETTINGS: CreatorNavLink = {
  href: "/creator/settings",
  label: "Settings",
  icon: Settings,
  secondary: true,
};
const STOCK: CreatorNavLink = {
  href: "/creator/stock",
  label: "Stock",
  icon: Boxes,
};
/** Customer-commissioned custom design work — open to all three creator
 * paths, unlike Collaborate (print-partner overflow), which the Seller path
 * never uses. */
const COMMISSIONS: CreatorNavLink = {
  href: "/commissions",
  label: "Commissions",
  icon: Wand2,
  secondary: true,
};

/** Studio — owns a printer: full seller tooling plus overflow collaboration. */
export const studioLinks: CreatorNavLink[] = [
  DASHBOARD,
  ANALYTICS,
  { href: "/creator/products", label: "Inventory", icon: Package },
  { href: "/creator/products/new", label: "Add Product", icon: Upload },
  ORDERS,
  COLLABORATE,
  COMMISSIONS,
  SETTINGS,
];

/** Seller — sells designs directly; deliberately no Collaborate, but tracks
 * real stock-on-hand since these are pre-made units, not print-on-demand. */
export const sellerLinks: CreatorNavLink[] = [
  DASHBOARD,
  ANALYTICS,
  { href: "/creator/products", label: "Inventory", icon: Package },
  { href: "/creator/products/new", label: "Add Product", icon: Upload },
  STOCK,
  ORDERS,
  COMMISSIONS,
  SETTINGS,
];

/** Designer — no printer: portfolio-led, partners do the printing. */
export const designerLinks: CreatorNavLink[] = [
  DASHBOARD,
  ANALYTICS,
  { href: "/creator/products", label: "Design Library", icon: Package },
  { href: "/creator/products/new", label: "Upload Design", icon: Palette },
  COLLABORATE,
  COMMISSIONS,
  PORTFOLIO,
  SETTINGS,
];

const LINKS_BY_TYPE: Record<CreatorType, CreatorNavLink[]> = {
  studio: studioLinks,
  seller: sellerLinks,
  designer: designerLinks,
};

export function linksForCreatorType(type: CreatorType | null | undefined) {
  return type ? LINKS_BY_TYPE[type] : [];
}

export const CREATOR_TYPE_KEY = "creator_type";
/** Pre-migration key; read once so existing prototype sessions keep working. */
const LEGACY_KEY = "prototype_creator_type";

const LEGACY_MAP: Record<string, CreatorType> = {
  designer_only: "designer",
  sell_on_3dverse: "seller",
  self_fulfilling: "studio",
};

/** Normalise anything we might find in storage or the API into a CreatorType. */
export function normaliseCreatorType(value: string | null | undefined): CreatorType | null {
  if (!value) return null;
  if (value === "studio" || value === "seller" || value === "designer") return value;
  return LEGACY_MAP[value] || null;
}

export function readStoredCreatorType(): CreatorType | null {
  if (typeof window === "undefined") return null;
  return (
    normaliseCreatorType(localStorage.getItem(CREATOR_TYPE_KEY)) ??
    normaliseCreatorType(localStorage.getItem(LEGACY_KEY))
  );
}

export function storeCreatorType(type: CreatorType) {
  localStorage.setItem(CREATOR_TYPE_KEY, type);
  localStorage.removeItem(LEGACY_KEY);
}

/**
 * Creator path for navigation purposes. Reads the locally cached value so the
 * navbar renders without waiting on a request; the dashboard is the component
 * that reconciles this against the server and caches the authoritative answer.
 */
export function useCreatorType(deps: unknown[] = []) {
  const [creatorType, setCreatorType] = useState<CreatorType | null>(null);

  useEffect(() => {
    setCreatorType(readStoredCreatorType());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const links = linksForCreatorType(creatorType);
  return {
    creatorType,
    path: getCreatorPath(creatorType),
    links,
    topBarLinks: links.filter((l) => !l.secondary),
  };
}
