"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';

interface ItemPolicy {
  order_item_id: number;
  product_id: number;
  quantity: number;
  policy: 'defect_reprint' | 'standard_return' | 'digital_no_return';
}

interface ReturnPolicy {
  policy: 'defect_reprint' | 'standard_return' | 'digital_no_return';
  window_closes_at: string | null;
  window_open: boolean;
  already_reported: boolean;
  items: ItemPolicy[];
}

interface ReturnRequestRow {
  id: number;
  order_item_id: number;
  quantity: number;
  reason: string;
  status: string;
  refund_amount: number | null;
  resolution_note: string | null;
}

const RETURN_REASONS = [
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'arrived_damaged', label: 'Arrived damaged' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'no_longer_needed', label: 'No longer needed' },
  { value: 'other', label: 'Other' },
];

export default function OrderDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);
  const [returnRequests, setReturnRequests] = useState<ReturnRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openReturnFor, setOpenReturnFor] = useState<number | null>(null);
  const [returnForm, setReturnForm] = useState({ reason: 'not_as_described', description: '' });

  const fetchPolicy = async () => {
    try {
      setPolicy(await api.get<ReturnPolicy>(`/api/orders/${id}/return-policy`));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReturnRequests = async () => {
    try {
      setReturnRequests(await api.get<ReturnRequestRow[]>(`/api/orders/${id}/return-requests`));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return router.push('/login');

        setOrder(await api.get<any>(`/api/orders/${id}`));
        await Promise.all([fetchPolicy(), fetchReturnRequests()]);
      } catch (e) {
        console.error(e);
        router.push('/orders');
      }
      setLoading(false);
    };
    fetchOrder();
  }, [id, router]);

  const handleReportDefect = async () => {
    const description = window.prompt('Briefly describe the defect:');
    if (!description?.trim()) return;
    try {
      await api.post(`/api/orders/${id}/defect-report`, { description });
      await fetchPolicy();
    } catch (e: any) {
      alert(e.message || 'Failed to report defect');
    }
  };

  const handleSubmitReturn = async (orderItemId: number, quantity: number) => {
    try {
      await api.post(`/api/orders/${id}/return-requests`, {
        order_item_id: orderItemId,
        quantity,
        reason: returnForm.reason,
        description: returnForm.description || null,
      });
      setOpenReturnFor(null);
      setReturnForm({ reason: 'not_as_described', description: '' });
      await fetchReturnRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to submit return request');
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-primary-foreground flex justify-center pt-24">Loading order details...</div>;
  if (!order) return <div className="min-h-screen bg-slate-950 text-primary-foreground flex justify-center pt-24">Order not found</div>;

  const STATUS_FLOW = ["paid", "queued", "printing", "qc", "packed", "shipped", "delivered"];
  const currentStepIndex = STATUS_FLOW.indexOf(order.status);

  const itemPolicy = (itemId: number) => policy?.items.find((i) => i.order_item_id === itemId);
  const requestsFor = (itemId: number) => returnRequests.filter((r) => r.order_item_id === itemId);
  const returnedQty = (itemId: number) =>
    requestsFor(itemId)
      .filter((r) => r.status !== 'rejected')
      .reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-primary-foreground pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center">
            <Package className="mr-3 text-primary" /> Order #{order.id}
          </h1>
          {order.invoice_url && (
            <button
              onClick={() => api.download(`/api/downloads/orders/${order.id}/invoice`, `invoice_${order.id}.pdf`).catch((e) => alert(e.message))}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm font-medium transition-colors border border-slate-700"
            >
              Download Invoice
            </button>
          )}
        </div>

        {/* Timeline Component */}
        <div className="bg-card border border-slate-800 rounded-xl p-8 mb-8">
          <h2 className="text-lg font-semibold mb-8 text-slate-300">Order Status Timeline</h2>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute top-5 left-8 bottom-5 w-0.5 bg-slate-800" />

            <div className="space-y-8 relative">
              {STATUS_FLOW.map((status, idx) => {
                const isPast = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isFuture = idx > currentStepIndex;

                let Icon = Clock;
                if (status === "delivered") Icon = CheckCircle;
                if (status === "shipped") Icon = Truck;
                if (status === "packed") Icon = Package;

                return (
                  <div key={status} className={`flex items-start ${isFuture ? "opacity-40" : ""}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-4 border-slate-900 z-10 ${
                      isPast ? "bg-success text-foreground" :
                      isCurrent ? "bg-primary text-primary-foreground" :
                      "bg-slate-800 text-muted-foreground"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="ml-6 pt-2">
                      <h3 className={`font-semibold capitalize ${isCurrent ? "text-primary" : "text-primary-foreground"}`}>
                        {status.replace('qc', 'Quality Control')}
                      </h3>
                      {isCurrent && status === "packed" && (
                        <p className="text-sm text-muted-foreground mt-1">Your order is packed and awaiting courier pickup.</p>
                      )}
                      {isPast && status === "shipped" && order.tracking_url && (
                        <div className="mt-2 inline-block">
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary/20 text-primary rounded text-xs border border-blue-500/30 flex items-center">
                            <Truck size={12} className="mr-2" /> Track on Shiprocket
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-card border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-300 border-b border-slate-800 pb-4">Order Summary</h2>
          <div className="space-y-4">
            {order.items?.map((item: any) => {
              const p = itemPolicy(item.id);
              const alreadyReturned = returnedQty(item.id);
              const canReturn =
                p?.policy === 'standard_return' &&
                policy?.window_open &&
                alreadyReturned < item.quantity;
              const existing = requestsFor(item.id);

              return (
                <div key={item.id} className="py-2 border-b border-slate-800/50 last:border-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.product?.title || `Product #${item.product_id}`}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-slate-300">${(item.price_at_purchase * item.quantity).toFixed(2)}</p>
                  </div>

                  {existing.map((r) => (
                    <p key={r.id} className="text-xs text-muted-foreground mt-1">
                      Return ({r.quantity}) — <span className="capitalize">{r.status}</span>
                      {r.resolution_note ? `: ${r.resolution_note}` : ''}
                    </p>
                  ))}

                  {canReturn && openReturnFor !== item.id && (
                    <button
                      onClick={() => setOpenReturnFor(item.id)}
                      className="text-xs text-primary hover:underline mt-2"
                    >
                      Request a return
                    </button>
                  )}

                  {openReturnFor === item.id && (
                    <div className="mt-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                      <select
                        value={returnForm.reason}
                        onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                        className="w-full bg-card border border-slate-700 rounded px-2 py-1.5 text-sm"
                      >
                        {RETURN_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <textarea
                        placeholder="Details (optional)"
                        value={returnForm.description}
                        onChange={(e) => setReturnForm({ ...returnForm, description: e.target.value })}
                        className="w-full bg-card border border-slate-700 rounded px-2 py-1.5 text-sm"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitReturn(item.id, item.quantity - alreadyReturned)}
                          className="px-3 py-1.5 bg-primary hover:bg-primary rounded text-xs font-medium"
                        >
                          Submit return request
                        </button>
                        <button
                          onClick={() => setOpenReturnFor(null)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground text-sm">
              <span>Shipping</span>
              <span>${order.shipping_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-primary-foreground font-bold text-lg pt-2 mt-2 border-t border-slate-800/50">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {policy && policy.policy !== 'digital_no_return' && (
          <div className="bg-card border border-slate-800 rounded-xl p-6 mt-8">
            <h2 className="text-lg font-semibold mb-2 text-slate-300">
              {policy.policy === 'defect_reprint' ? 'Something wrong with your print?' : 'Returns'}
            </h2>
            {policy.policy === 'defect_reprint' ? (
              <p className="text-sm text-muted-foreground mb-4">
                This item was printed to order, so it isn&apos;t eligible for a general return. If it
                arrived with a defect, report it within 48 hours of delivery and we&apos;ll print you a
                free replacement.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                This item ships from existing stock, so you can return it within 7 days for a refund
                if it&apos;s unused and in its original condition — use &quot;Request a return&quot; on
                the line item above.
              </p>
            )}

            {policy.already_reported ? (
              <p className="text-sm text-success">
                Reported — we&apos;re reviewing it and will arrange your reprint.
              </p>
            ) : !policy.window_open ? (
              <p className="text-sm text-muted-foreground">
                This window has closed{policy.window_closes_at ? ` (${new Date(policy.window_closes_at).toLocaleDateString()})` : ''}.
              </p>
            ) : policy.policy === 'defect_reprint' ? (
              <button
                onClick={handleReportDefect}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm font-medium transition-colors border border-slate-700"
              >
                Report a defect
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Window closes {policy.window_closes_at ? new Date(policy.window_closes_at).toLocaleDateString() : '—'}.
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
