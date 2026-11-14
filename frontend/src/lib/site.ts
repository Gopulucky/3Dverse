/** Public contact + business details shown on legal pages. Set these in the host's env. */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "gopuhardik@gmail.com";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://3dverse.com";
export const LEGAL_LAST_UPDATED = "14 November 2026";

/**
 * Consumer Protection (E-Commerce) Rules, 2020: the platform must show its
 * grievance officer's name and its legal business details. Set these in the
 * host's env; anything unset is simply left off the page.
 */
export const GRIEVANCE_OFFICER = process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER?.trim() || "";
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || "";
export const BUSINESS_ADDRESS = process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "";
export const GSTIN = process.env.NEXT_PUBLIC_GSTIN?.trim() || "";
