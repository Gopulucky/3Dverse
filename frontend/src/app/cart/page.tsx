"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, ShoppingCart, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  const [error, setError] = useState('');

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('http://127.0.0.1:8000/api/cart/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCart(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (itemId: number, newQty: number) => {
    const token = localStorage.getItem('token');
    await fetch(`http://127.0.0.1:8000/api/cart/items/${itemId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ quantity: newQty })
    });
    fetchCart();
  };

  const removeItem = async (itemId: number) => {
    const token = localStorage.getItem('token');
    await fetch(`http://127.0.0.1:8000/api/cart/items/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchCart();
  };

  const applyCoupon = async () => {
    setError('');
    setDiscountInfo(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/api/cart/apply-coupon`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: couponCode })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail);
      }
      setDiscountInfo(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
  };

  const subtotal = cart?.items?.reduce((acc: number, item: any) => acc + (item.product.price * item.quantity), 0) || 0;
  
  let discountAmount = 0;
  if (discountInfo) {
    if (discountInfo.percent_off) {
      discountAmount = subtotal * (discountInfo.percent_off / 100);
    } else if (discountInfo.flat_off) {
      discountAmount = discountInfo.flat_off;
    }
  }

  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    if (discountInfo) {
      sessionStorage.setItem('coupon', discountInfo.code);
    } else {
      sessionStorage.removeItem('coupon');
    }
    router.push('/checkout');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white pt-24 flex justify-center">Loading cart...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8 flex items-center">
          <ShoppingCart className="mr-3 text-blue-500" /> Your Cart
        </h1>

        {!cart || !cart.items || cart.items.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 mb-6">Your cart is empty.</p>
            <Link href="/marketplace" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {cart.items.map((item: any) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-20 h-20 bg-slate-950 rounded-lg shrink-0 overflow-hidden">
                    {/* Simplified Image display */}
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">Image</div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{item.product.title}</h3>
                    <p className="text-slate-400 text-sm mb-2">${item.product.price.toFixed(2)}</p>
                    {item.selected_config && (
                      <div className="text-xs text-slate-500 font-mono bg-slate-950 p-2 rounded">
                        {JSON.stringify(item.selected_config)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto mt-4 sm:mt-0 justify-between">
                    <div className="flex items-center bg-slate-950 rounded border border-slate-800">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1 hover:bg-slate-800">-</button>
                      <span className="px-3 py-1 border-x border-slate-800">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1 hover:bg-slate-800">+</button>
                    </div>
                    <p className="font-bold w-20 text-right">${(item.product.price * item.quantity).toFixed(2)}</p>
                    <button onClick={() => removeItem(item.id)} className="text-slate-500 hover:text-red-400 p-2">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-bold text-xl mb-4">Order Summary</h3>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount ({discountInfo.code})</span>
                      <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-800 pt-3 flex justify-between text-lg font-bold">
                    <span>Total (excl. shipping)</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mb-6 space-y-2">
                  <label className="text-sm text-slate-400">Have a coupon code?</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={couponCode} 
                      onChange={e => setCouponCode(e.target.value)}
                      placeholder="Code"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm uppercase"
                    />
                    <button onClick={applyCoupon} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded text-sm transition-colors border border-slate-700">
                      Apply
                    </button>
                  </div>
                  {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                </div>

                <button 
                  onClick={handleCheckout}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center transition-colors"
                >
                  Proceed to Checkout <ArrowRight size={18} className="ml-2" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
