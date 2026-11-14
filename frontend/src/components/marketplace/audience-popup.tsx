"use client";

import { useCallback, useEffect, useId, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  BOUGHT_WHERE, EMPTY_FORM, OCCASIONS, PERSONALISE, PRINTERS, ROLES, SPEND_BANDS, STEP_COUNT, USES,
  answersPayload, asksSpend, showOccasions, stepHasAnswers, toggleUse, validateContact,
  type AudienceForm, type ContactErrors, type Option,
} from "@/lib/audience";
import {
  OPEN_DELAY_MS, OPEN_EVENT, SNOOZE_DAYS_CLOSED, SNOOZE_DAYS_DONE, addProductView, isSnoozed, shouldOpen, snooze,
} from "@/lib/audience-schedule";
import { audiencePopupReducer, initialAudiencePopupState } from "@/lib/machines/audience-popup";
import { newAnonId } from "@/lib/track";
import { checkoutVisitor, track } from "@/lib/track-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESPONSE_KEY = "3dv_audience_response";
const START_KEY = "3dv_session_start";
const pill = "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-input px-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary";

function read(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}
function write(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value); } catch { /* best effort */ }
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{title}{hint && <span className="font-normal text-muted-foreground"> {hint}</span>}</legend>
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({ name, option, type, checked, disabled, onChange }: {
  name: string; option: Option; type: "radio" | "checkbox"; checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return (
    <label className={`${pill} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <input type={type} name={name} value={option.value} checked={checked} disabled={disabled} onChange={onChange}
        className="h-4 w-4 accent-[var(--store-action)]" />
      <span>{option.label}</span>
    </label>
  );
}

/**
 * The "help us build 3DVerse around you" questions. Opens once on the storefront (after a short
 * while, or on a second product page), then stays away. Each step saves when the visitor presses
 * Next, so partial answers still count; only the email at the end is awaited.
 */
export function AudiencePopup() {
  const id = useId();
  const pathname = usePathname();
  const [state, dispatch] = useReducer(audiencePopupReducer, initialAudiencePopupState);
  const [form, setForm] = useState<AudienceForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<ContactErrors>({});
  const shown = useRef(false);

  const open = useCallback(() => {
    dispatch({ type: "OPEN" });
  }, []);

  // Opening rules: a second product page, or a short while on the storefront; never while snoozed.
  useEffect(() => {
    if (!read(window.sessionStorage, START_KEY)) write(window.sessionStorage, START_KEY, String(Date.now()));
    const productViews = addProductView(window.sessionStorage, pathname);
    const started = Number(read(window.sessionStorage, START_KEY)) || Date.now();
    const check = () => shouldOpen({
      pathname, productViews, elapsedMs: Date.now() - started, snoozed: isSnoozed(window.localStorage, Date.now()),
    });
    const delay = productViews >= 2 ? 0 : Math.max(0, started + OPEN_DELAY_MS - Date.now());
    const timer = setTimeout(() => { if (check()) open(); }, delay);
    return () => clearTimeout(timer);
  }, [pathname, open]);

  // On purpose: a button elsewhere on the page can ask for the popup.
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [open]);

  useEffect(() => {
    if (state.status === "open" && !shown.current) {
      shown.current = true;
      track("audience_shown");
    }
    if (state.status === "closed") shown.current = false;
  }, [state.status]);

  const responseId = () => {
    const saved = read(window.sessionStorage, RESPONSE_KEY);
    if (saved) return saved;
    const made = newAnonId();
    write(window.sessionStorage, RESPONSE_KEY, made);
    return made;
  };
  const payload = (step: number) => answersPayload(form, step, { responseId: responseId(), anonId: checkoutVisitor()?.anon_id });

  const next = () => {
    if (state.status !== "open") return;
    if (stepHasAnswers(form, state.step)) void api.post("/api/audience", payload(state.step)).catch(() => { /* saved again with the next step */ });
    dispatch({ type: "NEXT" });
  };

  const submit = async () => {
    const found = validateContact(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    dispatch({ type: "SUBMIT" });
    try {
      await api.post("/api/audience", payload(STEP_COUNT));
      snooze(window.localStorage, Date.now(), SNOOZE_DAYS_DONE);
      track("waitlist_joined");
      dispatch({ type: "SUBMITTED" });
    } catch (error) {
      dispatch({ type: "SUBMIT_FAILED", error: error instanceof ApiError && error.status === 429
        ? "Too many tries from this connection. Please wait a while and try again."
        : "We couldn’t save that. Please try again." });
    }
  };

  const onOpenChange = (isOpen: boolean) => {
    if (isOpen || state.status === "submitting") return;
    if (state.status === "open") {
      // Answers from earlier steps are already saved; a refusal is remembered for two weeks.
      // Closing never sends contact details, so save as of the last answer step.
      if ([1, 2, 3].some((earlier) => stepHasAnswers(form, earlier))) void api.post("/api/audience", payload(Math.min(state.step, STEP_COUNT - 1))).catch(() => {});
      snooze(window.localStorage, Date.now(), SNOOZE_DAYS_CLOSED);
    }
    dispatch({ type: "CLOSE" });
  };

  const set = <K extends keyof AudienceForm>(key: K, value: AudienceForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // A corrected field drops its message; the rest stay until the next try.
    if (key === "email" || key === "whatsapp" || key === "consent") {
      const field: keyof ContactErrors = key;
      setErrors((current) => {
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };
  const step = state.status === "open" ? state.step : 0;
  const submitting = state.status === "submitting";

  return (
    <Dialog open={state.status !== "closed"} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" aria-describedby={`${id}-desc`}>
        <div data-flow="audience" data-state={state.status} data-step={step || undefined} className="grid gap-5">
          {state.status === "done" ? (
            <div role="status" className="grid gap-3 py-2">
              <CheckCircle2 size={28} className="text-success-ink" aria-hidden="true" />
              <DialogTitle className="font-display text-xl">Thank you. You’re on the list.</DialogTitle>
              <DialogDescription id={`${id}-desc`}>We’ll email you when printed products launch. Your answers help us decide what to make first.</DialogDescription>
              <Button onClick={() => onOpenChange(false)} className="min-h-11 justify-self-start">Close</Button>
            </div>
          ) : (
            <>
              <div>
                <DialogTitle className="font-display text-xl">Help us build 3DVerse around you</DialogTitle>
                <DialogDescription id={`${id}-desc`}>About a minute. Your answers decide what we make first.</DialogDescription>
                <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">Step {step || STEP_COUNT} of {STEP_COUNT}</p>
                <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${((step || STEP_COUNT) / STEP_COUNT) * 100}%` }} />
                </div>
              </div>

              {step === 1 && (
                <div className="grid gap-5">
                  <Question title="Which describes you best?">
                    {ROLES.map((option) => <Choice key={option.value} name={`${id}-role`} type="radio" option={option}
                      checked={form.role === option.value} onChange={() => set("role", option.value)} />)}
                  </Question>
                  <div>
                    <Label htmlFor={`${id}-city`}>Your city <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id={`${id}-city`} autoComplete="address-level2" maxLength={80} value={form.city}
                      onChange={(event) => set("city", event.target.value)} className="mt-1.5 min-h-11" />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <Question title="What would you mainly use 3DVerse for?" hint="(pick up to two)">
                    {USES.map((option) => <Choice key={option.value} name={`${id}-use`} type="checkbox" option={option}
                      checked={form.uses.includes(option.value)} onChange={() => set("uses", toggleUse(form.uses, option.value))}
                      disabled={!form.uses.includes(option.value) && form.uses.length >= 2} />)}
                  </Question>
                  {showOccasions(form) && (
                    <Question title="For which occasions?" hint="(any)">
                      {OCCASIONS.map((option) => <Choice key={option.value} name={`${id}-occasion`} type="checkbox" option={option}
                        checked={form.occasions.includes(option.value)}
                        onChange={() => set("occasions", form.occasions.includes(option.value) ? form.occasions.filter((x) => x !== option.value) : [...form.occasions, option.value])} />)}
                    </Question>
                  )}
                  <Question title="Do you own a 3D printer?">
                    {PRINTERS.map((option) => <Choice key={option.value} name={`${id}-printer`} type="radio" option={option}
                      checked={form.ownsPrinter === option.value} onChange={() => set("ownsPrinter", option.value)} />)}
                  </Question>
                  <Question title="Would you want it personalised (name, photo, logo)?">
                    {PERSONALISE.map((option) => <Choice key={option.value} name={`${id}-personalise`} type="radio" option={option}
                      checked={form.personalise === option.value} onChange={() => set("personalise", option.value)} />)}
                  </Question>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5">
                  <Question title="Last time you bought a gift, decor or custom item, where was it from?">
                    {BOUGHT_WHERE.map((option) => <Choice key={option.value} name={`${id}-bought`} type="radio" option={option}
                      checked={form.boughtWhere === option.value} onChange={() => set("boughtWhere", option.value)} />)}
                  </Question>
                  {asksSpend(form) && (
                    <Question title="About how much did it cost?">
                      {SPEND_BANDS.map((option) => <Choice key={option.value} name={`${id}-spend`} type="radio" option={option}
                        checked={form.spendBand === option.value} onChange={() => set("spendBand", option.value)} />)}
                    </Question>
                  )}
                  <div>
                    <Label htmlFor={`${id}-missing`}>What’s missing or annoying when you look for this today? <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Textarea id={`${id}-missing`} maxLength={280} rows={3} value={form.missing}
                      onChange={(event) => set("missing", event.target.value)} className="mt-1.5" />
                  </div>
                </div>
              )}

              {step === STEP_COUNT && (
                <form noValidate className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                  <div>
                    <Label htmlFor={`${id}-email`}>Email, so we can tell you when we launch</Label>
                    <Input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" value={form.email}
                      onChange={(event) => set("email", event.target.value)} aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? `${id}-email-error` : undefined} className="mt-1.5 min-h-11" />
                    {errors.email && <p id={`${id}-email-error`} className="mt-1 text-sm text-danger-ink">{errors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`${id}-whatsapp`}>WhatsApp number <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id={`${id}-whatsapp`} type="tel" autoComplete="tel-national" inputMode="tel" value={form.whatsapp}
                      onChange={(event) => set("whatsapp", event.target.value)} aria-invalid={Boolean(errors.whatsapp)}
                      aria-describedby={errors.whatsapp ? `${id}-whatsapp-error` : undefined} className="mt-1.5 min-h-11" />
                    {errors.whatsapp && <p id={`${id}-whatsapp-error`} className="mt-1 text-sm text-danger-ink">{errors.whatsapp}</p>}
                  </div>
                  <label className="flex items-start gap-3 text-sm">
                    <input type="checkbox" checked={form.chatOk} onChange={(event) => set("chatOk", event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--store-action)]" />
                    <span>I’m happy to answer 2–3 quick questions by chat.</span>
                  </label>
                  <div>
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" checked={form.consent} onChange={(event) => set("consent", event.target.checked)}
                        aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? `${id}-consent-error` : undefined}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--store-action)]" />
                      <span>
                        Contact me about 3DVerse. We use your details only for this, and you can ask us to delete them at any time.
                        See our <Link href="/privacy" className="underline">privacy policy</Link>.
                      </span>
                    </label>
                    {errors.consent && <p id={`${id}-consent-error`} className="mt-1 text-sm text-danger-ink">{errors.consent}</p>}
                  </div>
                  {state.status === "open" && state.error && <p role="alert" className="text-sm text-danger-ink">{state.error}</p>}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="lg" className="min-h-12" disabled={submitting} aria-busy={submitting}>
                      {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                      {submitting ? "Saving…" : "Notify me"}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11" disabled={submitting} onClick={() => onOpenChange(false)}>No thanks</Button>
                  </div>
                </form>
              )}

              {step > 0 && step < STEP_COUNT && (
                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => dispatch({ type: "BACK" })} disabled={step === 1}>Back</Button>
                  <Button type="button" size="lg" className="min-h-12" onClick={next}>Next</Button>
                </div>
              )}
              {step === STEP_COUNT && (
                <Button type="button" variant="ghost" className="min-h-11 justify-self-start" onClick={() => dispatch({ type: "BACK" })} disabled={submitting}>Back</Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
