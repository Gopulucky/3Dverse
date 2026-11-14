/**
 * Audience popup: the questions, what each saved step sends, and the admin CSV.
 *
 * Every question exists to settle a business decision (who the audience is, where they are,
 * what to stock, digital or printed, made-to-order, competitors, price level, our edge).
 * Values must match backend/app/schemas/audience.py (scripts/machines/audience.test.mjs fails if they drift).
 */
import { csvCell } from "./waitlist";

export type Option = { value: string; label: string };

export const ROLES: Option[] = [
  { value: "student", label: "School or college student" },
  { value: "hobbyist", label: "Hobbyist or maker" },
  { value: "professional", label: "Working professional" },
  { value: "parent", label: "Parent or family" },
  { value: "business", label: "Small business or brand" },
  { value: "designer", label: "3D designer or artist" },
  { value: "other", label: "Something else" },
];

export const USES: Option[] = [
  { value: "gifts", label: "Gifts for someone" },
  { value: "home_decor", label: "Decorate my home or room" },
  { value: "hobby", label: "Hobby: tabletop, minis, cosplay" },
  { value: "college_project", label: "College or engineering project" },
  { value: "useful_parts", label: "Useful or replacement parts" },
  { value: "my_shop", label: "Products for my own shop" },
  { value: "sell_designs", label: "Sell my own designs" },
  { value: "exploring", label: "Just exploring" },
];

export const OCCASIONS: Option[] = [
  { value: "birthday", label: "Birthdays" },
  { value: "wedding", label: "Anniversary or wedding" },
  { value: "festival", label: "Festivals (Diwali, Rakhi...)" },
  { value: "corporate", label: "Corporate gifts" },
  { value: "none", label: "No particular occasion" },
];

export const PRINTERS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "planning", label: "Planning to" },
];

export const PERSONALISE: Option[] = [
  { value: "always", label: "Always" },
  { value: "sometimes", label: "Sometimes" },
  { value: "no", label: "No" },
];

export const BOUGHT_WHERE: Option[] = [
  { value: "marketplace", label: "Amazon or Flipkart" },
  { value: "etsy_instagram", label: "Etsy or an Instagram seller" },
  { value: "local_shop", label: "A local shop" },
  { value: "made_it", label: "I made it myself" },
  { value: "never", label: "I haven't bought one" },
];

export const SPEND_BANDS: Option[] = [
  { value: "under_500", label: "Under ₹500" },
  { value: "500_1500", label: "₹500–1,500" },
  { value: "1500_3000", label: "₹1,500–3,000" },
  { value: "over_3000", label: "Over ₹3,000" },
];

export const STEP_COUNT = 4;
export const MAX_USES = 2;

export type AudienceForm = {
  role: string; city: string; uses: string[]; occasions: string[]; ownsPrinter: string; personalise: string;
  boughtWhere: string; spendBand: string; missing: string; email: string; whatsapp: string; chatOk: boolean; consent: boolean;
};

export const EMPTY_FORM: AudienceForm = {
  role: "", city: "", uses: [], occasions: [], ownsPrinter: "", personalise: "",
  boughtWhere: "", spendBand: "", missing: "", email: "", whatsapp: "", chatOk: false, consent: false,
};

export const labelOf = (options: Option[], value: string): string => options.find((option) => option.value === value)?.label ?? value;

/** Tap to pick, tap again to remove; a third pick is ignored. */
export function toggleUse(uses: string[], value: string): string[] {
  if (uses.includes(value)) return uses.filter((use) => use !== value);
  return uses.length >= MAX_USES ? uses : [...uses, value];
}

export const showOccasions = (form: Pick<AudienceForm, "uses">): boolean => form.uses.includes("gifts");
export const asksSpend = (form: Pick<AudienceForm, "boughtWhere">): boolean => ["marketplace", "etsy_instagram", "local_shop"].includes(form.boughtWhere);

const tidy = (text: string): string => text.split(/\s+/).filter(Boolean).join(" ");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The 10-digit Indian mobile number in `text`, or null (same rule as the backend). */
export function indianMobile(text: string): string | null {
  let digits = text.replace(/[\s()-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9][0-9]{9}$/.test(digits) ? digits : null;
}

export type ContactErrors = Partial<Record<"email" | "whatsapp" | "consent", string>>;

export function validateContact(form: Pick<AudienceForm, "email" | "whatsapp" | "consent">): ContactErrors {
  const errors: ContactErrors = {};
  const email = form.email.trim();
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";
  if (form.whatsapp.trim() && !indianMobile(form.whatsapp)) errors.whatsapp = "Enter a 10-digit Indian mobile number, or leave this blank.";
  if (!form.consent) errors.consent = "Tick the box so we can contact you.";
  return errors;
}

/** Everything answered so far, with nothing left blank. Contact details go only with the last step, and only once the consent box is ticked. */
export function answersPayload(form: AudienceForm, step: number, ids: { responseId: string; anonId?: string }) {
  const payload: Record<string, unknown> = { response_id: ids.responseId, ...(ids.anonId ? { anon_id: ids.anonId } : {}), step };
  const put = (key: string, value: unknown) => { if (Array.isArray(value) ? value.length : value) payload[key] = value; };
  put("role", form.role);
  put("city", tidy(form.city));
  put("uses", form.uses);
  if (showOccasions(form)) put("occasions", form.occasions);
  put("owns_printer", form.ownsPrinter);
  put("personalise", form.personalise);
  put("bought_where", form.boughtWhere);
  if (asksSpend(form)) put("spend_band", form.spendBand);
  put("missing", tidy(form.missing).slice(0, 280));
  if (step >= STEP_COUNT && form.consent) {  // never send contact details without the tick
    put("email", form.email.trim().toLowerCase());
    put("whatsapp", indianMobile(form.whatsapp));
    payload.chat_ok = form.chatOk;
    payload.consent = true;
  }
  return payload;
}

/** Whether pressing Next on this step has anything worth saving. */
export function stepHasAnswers(form: AudienceForm, step: number): boolean {
  switch (step) {
    case 1: return Boolean(form.role || form.city.trim());
    case 2: return Boolean(form.uses.length || form.occasions.length || form.ownsPrinter || form.personalise);
    case 3: return Boolean(form.boughtWhere || form.spendBand || form.missing.trim());
    default: return false;
  }
}

export interface AudienceRow {
  created_at: string | null; step_reached: number; role: string | null; city: string | null; uses: string[]; occasions: string[];
  owns_printer: string | null; personalise: string | null; bought_where: string | null; spend_band: string | null;
  missing: string | null; email: string | null; whatsapp: string | null; chat_ok: boolean;
}

const CSV_COLUMNS = ["created_at", "step_reached", "role", "city", "uses", "occasions", "owns_printer", "personalise", "bought_where", "spend_band", "missing", "email", "whatsapp", "chat_ok"] as const;

export function audienceCsv(rows: AudienceRow[]): string {
  const cell = (row: AudienceRow, column: (typeof CSV_COLUMNS)[number]): string => {
    const value = row[column];
    if (Array.isArray(value)) return csvCell(value.join("; "));
    if (typeof value === "boolean") return value ? "yes" : "no";
    return csvCell(value == null ? null : String(value));
  };
  return [CSV_COLUMNS.join(","), ...rows.map((row) => CSV_COLUMNS.map((column) => cell(row, column)).join(","))].join("\r\n");
}
