"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';

export default function OrderDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return router.push('/login');

        const res = await fetch(`http://127.0.0.1:8000/api/orders/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
          setOrder(await res.json());
        } else {
          router.push('/orders');
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchOrder();
  }, [id, router]);

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex justify-center pt-24">Loading order details...</div>;
  if (!order) return <div className="min-h-screen bg-slate-950 text-white flex justify-center pt-24">Order not found</div>;

  const STATUS_FLOW = ["paid", "queued", "printing", "qc", "packed", "shipped", "delivered"];
  const currentStepIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center">
            <Package className="mr-3 text-blue-500" /> Order #{order.id}
          </h1>
          {order.invoice_url && (
            <a href={`http://127.0.0.1:8000${order.invoice_url}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm font-medium transition-colors border border-slate-700">
              Download Invoice
            </a>
          )}
        </div>

        {/* Timeline Component */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 mb-8">
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
                      isPast ? "bg-green-500 text-slate-900" :
                      isCurrent ? "bg-blue-500 text-white" :
                      "bg-slate-800 text-slate-500"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="ml-6 pt-2">
                      <h3 className={`font-semibold capitalize ${isCurrent ? "text-blue-400" : "text-white"}`}>
                        {status.replace('qc', 'Quality Control')}
                      </h3>
                      {isCurrent && status === "packed" && (
                        <p className="text-sm text-slate-400 mt-1">Your order is packed and awaiting courier pickup.</p>
                      )}
                      {isPast && status === "shipped" && order.tracking_url && (
                        <div className="mt-2 inline-block">
                          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-xs border border-blue-500/30 flex items-center">
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
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4 text-slate-300 border-b border-slate-800 pb-4">Order Summary</h2>
          <div className="space-y-4">
            {order.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-800/50 last:border-0">
                <div>
                  <p className="font-medium">{item.product?.title || `Product #${item.product_id}`}</p>
                  <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                </div>
                <p className="text-slate-300">${(item.price_at_purchase * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Subtotal</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Shipping</span>
              <span>${order.shipping_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg pt-2 mt-2 border-t border-slate-800/50">
              <span>Total</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
