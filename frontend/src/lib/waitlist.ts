/**
 * Pre-launch waitlist answers. Values must match backend/app/schemas/waitlist.py
 * (scripts/machines/waitlist.test.mjs fails if they drift).
 */
export const INTERESTS = [
  { value: "personalised_gifts", label: "Personalised gifts (name stands, keychains)" },
  { value: "tabletop", label: "Tabletop and gaming" },
  { value: "home_decor", label: "Home decor" },
  { value: "cosplay", label: "Cosplay" },
  { value: "other", label: "Something else" },
] as const;

export const PRICE_CHOICES = [
  { value: "299", label: "₹299" },
  { value: "499", label: "₹499" },
  { value: "799", label: "₹799" },
  { value: "unsure", label: "Not sure" },
] as const;

export type WaitlistSource = "home" | "printed_catalogue";

export interface WaitlistForm {
  email: string;
  interest: string;
  priceChoice: string;
  city: string;
  consent: boolean;
}

export type WaitlistErrors = Partial<Record<"email" | "interest" | "consent", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWaitlist(form: Pick<WaitlistForm, "email" | "interest" | "consent">): WaitlistErrors {
  const errors: WaitlistErrors = {};
  const email = form.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (!form.interest) errors.interest = "Choose what you would buy.";
  if (!form.consent) errors.consent = "Tick the box so we can email you at launch.";
  return errors;
}

export function waitlistPayload(form: WaitlistForm, source: WaitlistSource) {
  const city = form.city.trim().replace(/\s+/g, " ");
  return {
    email: form.email.trim().toLowerCase(),
    interest: form.interest,
    price_choice: form.priceChoice || null,
    city: city || null,
    consent: true as const,
    source,
  };
}

export interface WaitlistSignupRow {
  email: string;
  interest: string;
  price_choice: string | null;
  city: string | null;
  source: string;
  created_at: string | null;
}

const CSV_COLUMNS = ["email", "interest", "price_choice", "city", "source", "created_at"] as const;

function csvCell(value: string | null): string {
  let text = value ?? "";
  // A leading = + - @ makes spreadsheets run the cell as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text.startsWith("'") ? `"${text.replace(/"/g, '""')}"` : text;
}

export function waitlistCsv(rows: WaitlistSignupRow[]): string {
  return [CSV_COLUMNS.join(","), ...rows.map(row => CSV_COLUMNS.map(column => csvCell(row[column])).join(","))].join("\r\n");
}
