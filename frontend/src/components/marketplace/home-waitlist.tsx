"use client";

import { useId, useReducer, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/track-client";
import { initialWaitlistState, waitlistReducer } from "@/lib/machines/waitlist";
import { INTERESTS, PRICE_CHOICES, validateWaitlist, waitlistPayload, type WaitlistErrors, type WaitlistForm, type WaitlistSource } from "@/lib/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY: WaitlistForm = { email: "", interest: "", priceChoice: "", city: "", consent: false };
const selectClass = "mt-1.5 w-full min-h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Pre-launch "notify me" form for printed products. Shown only while printing isn't open. */
export function HomeWaitlist({ source = "home" }: { source?: WaitlistSource }) {
  const id = useId();
  const [state, dispatch] = useReducer(waitlistReducer, initialWaitlistState);
  const [form, setForm] = useState<WaitlistForm>(EMPTY);
  const [errors, setErrors] = useState<WaitlistErrors>({});
  const set = <K extends keyof WaitlistForm>(key: K, value: WaitlistForm[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    // A corrected field drops its message; the rest stay until the next submit.
    if (key in errors) setErrors(current => {
      const next = { ...current };
      delete next[key as keyof WaitlistErrors];
      return next;
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateWaitlist(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    dispatch({ type: "SUBMIT" });
    try {
      await api.post("/api/waitlist", waitlistPayload(form, source));
      dispatch({ type: "JOINED" });
      track("waitlist_joined");
    } catch (error) {
      const message = error instanceof ApiError && error.status === 429
        ? "Too many tries from this connection. Please wait a while and try again."
        : "We couldn’t save that. Please try again.";
      dispatch({ type: "FAILED", message });
    }
  };

  const submitting = state.status === "submitting";
  const describedBy = (key: keyof WaitlistErrors) => (errors[key] ? `${id}-${key}-error` : undefined);
  const errorText = (key: keyof WaitlistErrors) =>
    errors[key] ? <p id={`${id}-${key}-error`} className="mt-1 text-sm text-danger-ink">{errors[key]}</p> : null;

  return (
    <section id="waitlist" className="store-section scroll-mt-20" aria-labelledby={`${id}-title`} data-flow="waitlist" data-state={state.status}>
      <div className="store-container">
        <div className="grid gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-[2fr_3fr] lg:gap-12">
          <div>
            <p className="text-sm font-medium text-ember-ink">Coming soon</p>
            <h2 id={`${id}-title`} className="mt-1 font-display text-2xl sm:text-3xl font-semibold">Finished prints, delivered to you</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              We’re getting printing and delivery ready. Tell us what you’d buy and we’ll email you the day it opens.
              Your answers decide what we make first.
            </p>
          </div>

          {state.status === "joined" ? (
            <div role="status" className="flex items-start gap-3 self-center">
              <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success-ink" aria-hidden="true" />
              <div>
                <p className="font-semibold">You’re on the list.</p>
                <p className="mt-1 text-muted-foreground">We’ll email you when printed products launch. Thank you for helping us decide what to make.</p>
              </div>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="grid gap-5">
              <div>
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input id={`${id}-email`} type="email" autoComplete="email" inputMode="email" value={form.email}
                  onChange={event => set("email", event.target.value)} aria-invalid={Boolean(errors.email)}
                  aria-describedby={describedBy("email")} className="mt-1.5 min-h-11" />
                {errorText("email")}
              </div>

              <div>
                <Label htmlFor={`${id}-interest`}>What would you buy first?</Label>
                <select id={`${id}-interest`} value={form.interest} onChange={event => set("interest", event.target.value)}
                  aria-invalid={Boolean(errors.interest)} aria-describedby={describedBy("interest")} className={selectClass}>
                  <option value="">Choose one</option>
                  {INTERESTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {errorText("interest")}
              </div>

              <fieldset>
                <legend className="text-sm font-medium">
                  What would you pay for a personalised name stand? <span className="font-normal text-muted-foreground">(optional)</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRICE_CHOICES.map(option => (
                    <label key={option.value}
                      className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-input px-4 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary">
                      <input type="radio" name={`${id}-price`} value={option.value} checked={form.priceChoice === option.value}
                        onChange={() => set("priceChoice", option.value)} className="h-4 w-4 accent-[var(--store-action)]" />
                      <span className={option.value === "unsure" ? undefined : "font-data"}>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <Label htmlFor={`${id}-city`}>City <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input id={`${id}-city`} autoComplete="address-level2" maxLength={80} value={form.city}
                  onChange={event => set("city", event.target.value)} className="mt-1.5 min-h-11" />
              </div>

              <div>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={form.consent} onChange={event => set("consent", event.target.checked)}
                    aria-invalid={Boolean(errors.consent)} aria-describedby={describedBy("consent")}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--store-action)]" />
                  <span>
                    Email me when printed products launch. We use your email only for this, and you can ask us to delete it at any time.
                    See our <Link href="/privacy" className="underline">privacy policy</Link>.
                  </span>
                </label>
                {errorText("consent")}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button type="submit" size="lg" className="min-h-12" disabled={submitting} aria-busy={submitting}>
                  {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {submitting ? "Saving…" : "Notify me"}
                </Button>
                {state.status === "error" && <p role="alert" className="text-sm text-danger-ink">{state.message}</p>}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
