'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExplainerModal from '@/components/collaboration/ExplainerModal';
import { StudioShell } from '@/components/layout/studio-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreatorType } from '@/lib/creator-nav';
import { useRequireAuth } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { Ban } from 'lucide-react';

interface PrintPartner {
  id: number;
  name: string;
  region: string | null;
  cost_tier: number | null;
  bio?: string | null;
  lead_time_days?: number | null;
  price_per_gram_inr?: number | null;
  min_order_inr?: number | null;
  build_x_mm?: number | null;
  build_y_mm?: number | null;
  build_z_mm?: number | null;
  capabilities: { technology: string; material_type: string }[];
}

/**
 * Self-fulfilling (studio) creators already print/pack/ship themselves -- a
 * partner is only an overflow valve, so the backend requires a self-declared
 * reason on every ticket they open. Designer-only creators have no printer at
 * all, so a partner is always their sole path and no reason is required.
 */
const OVERFLOW_REASONS = [
  { value: 'shipping_difficulty', label: "Shipping difficulty (this order's region is hard for me to cover)" },
  { value: 'overflow_capacity', label: 'Overflow capacity (more orders than my own printer(s) can handle)' },
];

export default function CollaborationPage() {
  const router = useRouter();
  const { ready: isAuthenticated } = useRequireAuth();
  const { creatorType, path: creatorPath } = useCreatorType();
  const [partners, setPartners] = useState<PrintPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [overflowReason, setOverflowReason] = useState('');
  const [technology, setTechnology] = useState('');
  const [material, setMaterial] = useState('');
  const [minBuild, setMinBuild] = useState('');
  const [loadError, setLoadError] = useState(false);
  const filtered = Boolean(technology || material.trim() || minBuild);

  useEffect(() => {
    if (!isAuthenticated) return;

    const params: Record<string, string> = {};
    if (technology) params.technology = technology;
    if (material.trim()) params.material_type = material.trim();
    const build = Number(minBuild);
    if (minBuild && Number.isInteger(build) && build >= 1 && build <= 2000) params.min_build_mm = String(build);
    let cancelled = false;   // a slower, older request must not overwrite a newer one
    const timer = setTimeout(() => {
      api.get<PrintPartner[]>('/api/collaboration/partners', params)
        .then(data => {
          if (cancelled) return;
          setLoadError(false);
          setPartners(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (cancelled) return;
          setPartners([]);       // never leave the previous, unfiltered list on screen
          setLoadError(true);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, material ? 250 : 0);   // wait for a pause while typing a material
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isAuthenticated, technology, material, minBuild]);

  const handlePurchaseTicket = async (partnerId: number) => {
    if (creatorType === 'studio' && !overflowReason) {
      alert('Select a reason for routing this job to a print partner first.');
      return;
    }
    try {
      // 1. Create Ticket
      const ticket = await api.post<{ id: number }>('/api/collaboration/tickets', {
        print_partner_id: partnerId,
        product_reference: 'Eval Design',
        ...(creatorType === 'studio' ? { overflow_reason: overflowReason } : {}),
      });

      // 2. Mock Payment
      await api.post(`/api/collaboration/tickets/${ticket.id}/pay`);

      // 3. Redirect to ticket chat page
      router.push(`/collaboration/${ticket.id}`);
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      alert(`Failed to purchase ticket: ${error.message}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <StudioShell>
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </StudioShell>
    );
  }

  // Seller accounts sell designs directly and never use print partners. The nav
  // link is hidden for them; this covers a direct visit to the URL.
  if (creatorPath && !creatorPath.canCollaborate) {
    return (
      <StudioShell>
        <div className="min-h-screen flex items-center justify-center flex-col px-6 text-center">
          <Ban className="text-muted-foreground w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold mb-2 font-display">Not part of your path</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Your account is set up as <strong>{creatorPath.label}</strong> — you sell your
            designs directly, so print partner collaboration isn&apos;t included.
          </p>
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <div className="min-h-screen bg-background text-foreground p-8">
        <ExplainerModal />
        
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-extrabold text-gradient-accent">
              Find a Print Partner
            </h1>
            <p className="text-muted-foreground mt-2">
              Browse certified partners, compare capabilities, and start collaborating.
            </p>
          </div>
        </div>

        {creatorType === 'studio' && (
          <div className="mb-8 bg-card border border-border rounded-2xl p-6">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Why route this to a print partner?
            </label>
            <p className="text-muted-foreground text-xs mb-3">
              You already print your own work — a partner only makes sense as an overflow valve. This is logged on the ticket.
            </p>
            <select
              value={overflowReason}
              onChange={(e) => setOverflowReason(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select a reason…</option>
              {OVERFLOW_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        <div role="group" aria-label="Partner filters" className="mb-6 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="partner-tech" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technology</label>
            <select id="partner-tech" value={technology} onChange={e => setTechnology(e.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm">
              <option value="">Any technology</option>
              {['fdm', 'sla', 'sls', 'slm', 'dmls', 'mjf'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="partner-material" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Material</label>
            <input id="partner-material" value={material} onChange={e => setMaterial(e.target.value)} placeholder="For example PLA" className="min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm" />
          </div>
          <div>
            <label htmlFor="partner-build" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Smallest build size (mm)</label>
            <input id="partner-build" type="number" min="1" max="2000" step="1" value={minBuild} onChange={e => setMinBuild(e.target.value)} placeholder="For example 200" className="min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading partners...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map(partner => (
              <div key={partner.id} className="bg-card border border-border rounded-2xl p-6 hover:border-moss/40 transition-all hover:shadow-2xl hover:shadow-moss/10 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-foreground">{partner.name}</h3>
                  {partner.cost_tier ? <div className="flex text-warning-ink text-sm">{Array(partner.cost_tier).fill('⭐').join('')}</div> : null}
                </div>
                
                <div className="text-muted-foreground text-sm mb-4 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {partner.region || 'Global'}
                </div>

                {partner.bio && <p className="mb-4 text-sm text-foreground">{partner.bio}</p>}
                <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {partner.lead_time_days != null && <div><dt className="text-xs text-muted-foreground">Lead time</dt><dd>{partner.lead_time_days} {partner.lead_time_days === 1 ? 'day' : 'days'}</dd></div>}
                  {partner.price_per_gram_inr != null && <div><dt className="text-xs text-muted-foreground">Price</dt><dd>₹{partner.price_per_gram_inr} per gram</dd></div>}
                  {partner.min_order_inr != null && <div><dt className="text-xs text-muted-foreground">Minimum order</dt><dd>₹{partner.min_order_inr}</dd></div>}
                  {partner.build_x_mm != null && partner.build_y_mm != null && partner.build_z_mm != null && <div><dt className="text-xs text-muted-foreground">Largest print</dt><dd>{partner.build_x_mm} × {partner.build_y_mm} × {partner.build_z_mm} mm</dd></div>}
                </dl>

                <div className="flex-grow mb-6">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {partner.capabilities.map((cap, idx) => (
                      <span key={idx} className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded-md">
                        {cap.technology.toUpperCase()} - {cap.material_type}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handlePurchaseTicket(partner.id)}
                  className="w-full min-h-11 py-3 bg-secondary hover:bg-accent text-foreground rounded-xl font-medium transition-colors border border-border hover:border-moss/40"
                >
                  Buy Evaluation Ticket ($50)
                </button>
              </div>
            ))}

            {partners.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-border border-dashed">
                {loadError ? "Couldn't load print partners. Try again in a moment." : filtered ? 'No print partners match these filters. Try fewer filters.' : 'No print partners are taking work right now.'}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
