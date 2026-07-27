'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ExplainerModal from '@/components/collaboration/ExplainerModal';
import { StudioShell } from '@/components/layout/studio-shell';
import { useCreatorType } from '@/lib/creator-nav';
import { api } from '@/lib/api';
import { Ban } from 'lucide-react';

interface PrintPartner {
  id: number;
  name: string;
  region: string;
  cost_tier: number;
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
  const { creatorType, path: creatorPath } = useCreatorType();
  const [partners, setPartners] = useState<PrintPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [overflowReason, setOverflowReason] = useState('');

  useEffect(() => {
    api.get<PrintPartner[]>('/api/collaboration/partners')
      .then(data => {
        if (Array.isArray(data)) {
          setPartners(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
              Find a Print Partner
            </h1>
            <p className="text-muted-foreground mt-2">
              Browse certified partners, compare capabilities, and start collaborating.
            </p>
          </div>
        </div>

        {creatorType === 'studio' && (
          <div className="mb-8 bg-card border border-zinc-800 rounded-2xl p-6">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Why route this to a print partner?
            </label>
            <p className="text-muted-foreground text-xs mb-3">
              You already print your own work — a partner only makes sense as an overflow valve. This is logged on the ticket.
            </p>
            <select
              value={overflowReason}
              onChange={(e) => setOverflowReason(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-primary-foreground"
            >
              <option value="">Select a reason…</option>
              {OVERFLOW_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading partners...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map(partner => (
              <div key={partner.id} className="bg-card border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-primary-foreground">{partner.name}</h3>
                  <div className="flex text-warning text-sm">
                    {Array(partner.cost_tier).fill('⭐').join('')}
                  </div>
                </div>
                
                <div className="text-muted-foreground text-sm mb-4 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {partner.region || 'Global'}
                </div>

                <div className="flex-grow mb-6">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {partner.capabilities.map((cap, idx) => (
                      <span key={idx} className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-md">
                        {cap.technology.toUpperCase()} - {cap.material_type}
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => handlePurchaseTicket(partner.id)}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-primary-foreground rounded-xl font-medium transition-colors border border-zinc-700 hover:border-zinc-500"
                >
                  Buy Evaluation Ticket ($50)
                </button>
              </div>
            ))}
            
            {partners.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground bg-card/50 rounded-2xl border border-zinc-800 border-dashed">
                No print partners found matching your criteria.
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </StudioShell>
  );
}
