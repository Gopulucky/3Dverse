"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, Download, ExternalLink } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://127.0.0.1:8000/api/orders/', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setOrders(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchOrders();
  }, []);

  if (loading) return <div className="min-h-screen bg-slate-950 text-white pt-24 flex justify-center">Loading orders...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8 flex items-center">
          <Package className="mr-3 text-blue-500" /> Order History
        </h1>

        {orders.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 mb-6">You haven't placed any orders yet.</p>
            <Link href="/marketplace" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Order Placed</p>
                    <p className="text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Total</p>
                    <p className="text-sm">${order.total.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Order #</p>
                    <p className="text-sm font-mono text-slate-300">{order.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold uppercase rounded-full border border-green-500/30">
                      {order.status}
                    </span>
                    {order.invoice_url && (
                      <a 
                        href={`http://127.0.0.1:8000${order.invoice_url}`} 
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Download size={14} className="mr-1" /> Invoice
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-4">
                    {order.items?.map((item: any) => (
                      <div key={item.id} className="flex gap-4 border-b border-slate-800/50 pb-4 last:border-0 last:pb-0">
                        <div className="w-16 h-16 bg-slate-950 rounded flex-shrink-0 flex items-center justify-center text-xs text-slate-500">Image</div>
                        <div className="flex-1">
                          <Link href={`/marketplace/${item.product_id}`} className="font-bold hover:text-blue-400 transition-colors inline-flex items-center">
                            {item.product?.title || `Product #${item.product_id}`} <ExternalLink size={12} className="ml-1 opacity-50" />
                          </Link>
                          {item.selected_config && (
                            <p className="text-xs text-slate-500 mt-1">{JSON.stringify(item.selected_config)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${item.price_at_purchase.toFixed(2)}</p>
                          <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
