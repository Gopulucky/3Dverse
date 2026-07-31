/**
 * 3DVerse brand system — single source of truth.
 *
 * Full brand book: docs/brand/ at the repo root. This file mirrors that
 * document — colour and type values here must match the tokens defined
 * in globals.css (docs/brand/04-technical.md is the canonical token
 * table). Every public-facing surface (about page, footer, metadata)
 * reads its copy from here, so the brand voice stays consistent instead of
 * being retyped slightly differently on each page.
 */

export const BRAND = {
  name: "3DVerse",
  /** Wordmark split — the two halves are styled differently everywhere. */
  wordmark: { lead: "3D", tail: "Verse" },
  tagline: "Upload Once. Sell Forever. Print Anywhere.",
  positioning: "The Operating System for 3D Commerce",
  /** One sentence. Used for metadata and the about hero. */
  oneLiner:
    "3DVerse is the infrastructure layer for physical creation — a marketplace, an AI manufacturing assistant, and a distributed print network operating as one system.",
} as const;

/* ================================================================
   Visual identity — docs/brand/03-visual.md / 04-technical.md.

   Anchor hexes only (step 9 of each 12-step OKLCH scale). The full
   scales live as CSS custom properties in globals.css
   (--color-violet-1..12, --color-ember-1..12, --color-moss-1..12,
   --color-slate-1..12) — reference those in CSS/Tailwind classes.
   This object exists so brand-adjacent copy (docs, decks, external
   partners) has a single place to read the anchor values from.
   ================================================================ */

export const BRAND_COLORS = {
  violet: { hex: "#6366F1", name: "Cure Violet", role: "Primary — customers" },
  ember: { hex: "#EA580C", name: "Nozzle Orange", role: "Creators" },
  moss: { hex: "#059669", name: "Calibration Green", role: "Print partners" },
  slate: { hex: "#64748B", name: "Slate", role: "Neutral — most of the UI" },
} as const;

/** Audience → accent hue. A platform-wide rule, not a one-off constant —
 *  see docs/brand/01-strategy.md. Wherever the UI signals which side of
 *  the network something belongs to, use this mapping. */
export const AUDIENCE_ACCENT_HUE = {
  creators: "ember",
  customers: "violet",
  partners: "moss",
} as const;

export const BRAND_TYPE = {
  display: { name: "Space Grotesk", cssVar: "--font-display", use: "Headlines, the wordmark" },
  sans: { name: "IBM Plex Sans", cssVar: "--font-sans", use: "Body copy, UI labels" },
  mono: { name: "IBM Plex Mono", cssVar: "--font-mono", use: "Currency, dimensions, IDs — always tabular figures" },
} as const;

export const LOGO_RULES = [
  "The name is always 3DVerse — capital 3, capital D, no space, capital V, lowercase erse. Never 3Dverse, 3D-Verse, 3DVERSE, or 3dverse.",
  "Do not rewrite the wordmark in a different typeface if Space Grotesk isn't loaded yet on some surface — fix the font loading instead.",
  "Keep the 3D / Verse split — the gradient half (3D) always leads; it does not move to Verse.",
  "Minimum size: wordmark not smaller than 16px cap-height in UI contexts.",
  "Clear space: padding equal to the cap-height of the '3', on all sides, before any other element.",
] as const;

/* ================================================================
   Mission & principles — the "how an organization works" material
   ================================================================ */

export const MISSION = {
  statement:
    "Make manufacturing as accessible as publishing.",
  body:
    "Publishing a book, a song, or a piece of software costs almost nothing today. Manufacturing a physical object still demands machines, materials, logistics, and capital. That gap is why most good designs never become real things. We are closing it — so that a designer with a file and an idea can reach a customer anywhere, without owning a single printer.",
};

export const PRINCIPLES = [
  {
    title: "Creators come first",
    body:
      "The platform is worth exactly what creators can earn on it. Pricing, payouts, and product decisions get judged against that before anything else.",
  },
  {
    title: "Ship the whole loop",
    body:
      "A marketplace without fulfilment is a catalogue. We take responsibility for the entire path — upload, validation, sale, print, delivery, payout — rather than the convenient half.",
  },
  {
    title: "Trust is a product feature",
    body:
      "Every model is checked before it is sold. Every print partner is vetted. Buyers should never have to gamble on whether a file will actually print.",
  },
  {
    title: "Automate the tedious, never the taste",
    body:
      "AI handles printability, pricing signals, and routing. It does not decide what is worth making. That stays with the people who design.",
  },
  {
    title: "Local by default",
    body:
      "The nearest capable printer wins the job. Shorter routes mean faster delivery, lower cost, and less freight burned moving plastic across the world.",
  },
  {
    title: "Say the real number",
    body:
      "Take rates, print success rates, delivery estimates and payout timing are published plainly. If a number is bad, we show the bad number.",
  },
];

/* ================================================================
   How the organization works — the three sides of the network
   ================================================================ */

export type Audience = {
  key: "creators" | "customers" | "partners";
  label: string;
  headline: string;
  summary: string;
  /** Concrete capabilities — "what they can do" */
  capabilities: string[];
  cta: { label: string; href: string };
};

export const AUDIENCES: Audience[] = [
  {
    key: "creators",
    label: "Creators",
    headline: "Designers who turn files into a business.",
    summary:
      "Creators are the supply side of 3DVerse. They upload the models, set the terms, and own the customer relationship. A creator can run the whole operation from a laptop and never touch a printer — or plug in their own machines and fulfil their orders themselves.",
    capabilities: [
      "Upload STL, OBJ and GLTF models and get an automated printability report before publishing",
      "Sell the same design as a digital download, a printed product, or both",
      "Set prices, materials, colours and print configurations per product",
      "See revenue, conversion funnels and AI insights in the Creator Studio",
      "Take paid commissions — custom work requested directly by customers",
      "Register their own printers and fulfil orders in-house, or hand them to the print network",
      "Track stock, returns and payouts without leaving the dashboard",
    ],
    cta: { label: "Start creating", href: "/register" },
  },
  {
    key: "customers",
    label: "Customers",
    headline: "Buyers who want the object, not the hassle.",
    summary:
      "Customers browse a catalogue where every listing has already been checked for printability. They do not need a printer, filament, or any knowledge of layer heights. They choose a model, choose how it should be made, and it arrives.",
    capabilities: [
      "Browse and search the full marketplace without an account",
      "Inspect any model in an interactive 3D viewer before buying",
      "Order it printed and shipped, or download the file if the creator allows it",
      "Choose material, colour and finish at checkout",
      "Commission custom work from a creator when nothing in the catalogue fits",
      "Track the order from print queue to doorstep, and return it if it arrives wrong",
    ],
    cta: { label: "Browse the marketplace", href: "/marketplace/home" },
  },
  {
    key: "partners",
    label: "Print Partners",
    headline: "Print shops that turn idle machines into income.",
    summary:
      "Print partners are the manufacturing layer. Most 3D printers on earth sit idle most of the time. Partners connect their capacity to 3DVerse and receive routed, pre-validated jobs with the material and settings already resolved.",
    capabilities: [
      "Receive print jobs routed by location, material and machine capability",
      "Accept or decline each job — capacity stays under the shop's control",
      "Get files that have already passed automated printability checks",
      "Build a public reliability record that earns higher-value work",
      "Manage the queue, mark jobs shipped, and get paid per completed order",
    ],
    cta: { label: "Become a print partner", href: "/register" },
  },
];

/* ================================================================
   What we do — the three systems
   ================================================================ */

export const PILLARS = [
  {
    title: "The Marketplace",
    body:
      "An open catalogue of 3D models, browsable by anyone without an account. Creators list; customers buy digital files, printed goods, or commissioned work.",
  },
  {
    title: "The AI Manufacturing Assistant",
    body:
      "Every upload is analysed for printability, material fit, predicted print success and pricing. Creators get a report instead of a silent 'upload complete'.",
  },
  {
    title: "The Print Network",
    body:
      "A distributed grid of vetted print shops and creator-owned machines. Orders route to the nearest partner that can actually make the thing.",
  },
];

/* ================================================================
   Story — how the platform got here
   ================================================================ */

export const TIMELINE = [
  {
    period: "The problem",
    title: "Files that never became things",
    body:
      "Millions of 3D models exist online. Almost none of them reach anyone who does not already own a printer, know their way around slicer settings, and have the patience for failed prints.",
  },
  {
    period: "The first build",
    title: "A marketplace with fulfilment attached",
    body:
      "We started where every other platform stops: at the point of sale. Instead of handing the buyer a file, we routed the job to someone who could print it.",
  },
  {
    period: "The unlock",
    title: "Validation before publication",
    body:
      "Fulfilment only works when the file is printable. Automated geometry and printability checks moved quality control to upload time, before a customer is ever involved.",
  },
  {
    period: "Now",
    title: "One system, three sides",
    body:
      "Creators, customers and print partners run on the same platform, each portal built for its own job. Every new participant makes the network more useful to the other two.",
  },
];
