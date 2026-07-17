"use client";

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_fake");

function CheckoutForm({ clientSecret, shippingMethod, address, couponCode }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    // Wait, since we are doing it manually to have our own orders endpoint:
    // In a production app, we should use stripe webhooks to confirm the order.
    // For this prototype, we'll confirm the payment, then call our own backend to finalize the order.
    
    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/orders`,
      },
      redirect: 'if_required'
    });

    if (submitError) {
      setError(submitError.message || "An error occurred during payment.");
      setLoading(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment successful! Tell backend to create order and clear cart.
      const token = localStorage.getItem('token');
      try {
        const res = await fetch('http://127.0.0.1:8000/api/orders/confirm', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            shipping_address: address,
            coupon_code: couponCode
          })
        });
        
        if (res.ok) {
          sessionStorage.removeItem('coupon');
          router.push('/orders');
        } else {
          setError("Payment succeeded, but order creation failed. Please contact support.");
        }
      } catch (err) {
        setError("Error finalizing order.");
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded">{error}</div>}
      <button 
        disabled={!stripe || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold flex items-center justify-center transition-colors mt-6"
      >
        {loading ? "Processing..." : <><Lock size={16} className="mr-2" /> Pay Now</>}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [address, setAddress] = useState({
    name: '',
    street: '',
    city: '',
    zip: '',
    country: 'US'
  });

  const couponCode = typeof window !== 'undefined' ? sessionStorage.getItem('coupon') : null;

  useEffect(() => {
    // Generate intent initially
    initializeCheckout();
  }, [shippingMethod]); // Re-run if shipping changes

  const initializeCheckout = async () => {
    const token = localStorage.getItem('token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch('http://127.0.0.1:8000/api/checkout/create-payment-intent', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipping_method: shippingMethod, coupon_code: couponCode })
      });
      
      if (res.ok) {
        const data = await res.json();
        setClientSecret(data.client_secret);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!clientSecret) return <div className="min-h-screen bg-slate-950 text-white pt-24 text-center">Loading checkout...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-8">
            {/* Shipping Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-800 pb-2">Shipping Details</h2>
              <div className="space-y-4">
                <input 
                  type="text" placeholder="Full Name" 
                  value={address.name} onChange={e => setAddress({...address, name: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                />
                <input 
                  type="text" placeholder="Street Address" 
                  value={address.street} onChange={e => setAddress({...address, street: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="text" placeholder="City" 
                    value={address.city} onChange={e => setAddress({...address, city: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                  />
                  <input 
                    type="text" placeholder="Zip / Postal" 
                    value={address.zip} onChange={e => setAddress({...address, zip: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Method */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-800 pb-2">Shipping Method</h2>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border border-slate-800 rounded hover:border-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="shipping" 
                    value="standard" 
                    checked={shippingMethod === 'standard'} 
                    onChange={() => setShippingMethod('standard')} 
                    className="accent-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Standard Shipping</p>
                    <p className="text-xs text-slate-400">3-5 business days</p>
                  </div>
                  <span className="font-bold">$5.00</span>
                </label>
                <label className="flex items-center space-x-3 p-3 border border-slate-800 rounded hover:border-slate-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="shipping" 
                    value="express" 
                    checked={shippingMethod === 'express'} 
                    onChange={() => setShippingMethod('express')}
                    className="accent-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Express Shipping</p>
                    <p className="text-xs text-slate-400">1-2 business days</p>
                  </div>
                  <span className="font-bold">$15.00</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sticky top-24">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-800 pb-2">Payment</h2>
              <p className="mb-6 font-bold text-lg">Total to pay: <span className="text-blue-400">${total.toFixed(2)}</span></p>
              
              <div className="bg-white p-4 rounded-lg text-slate-900">
                {clientSecret === 'mock_client_secret' ? (
                  <div className="text-center py-6">
                    <p className="mb-4 text-slate-600">Test Mode: No Stripe keys provided. Click below to simulate a successful payment.</p>
                    <button 
                      onClick={async () => {
                        const token = localStorage.getItem('token');
                        try {
                          const res = await fetch('http://127.0.0.1:8000/api/orders/confirm', {
                            method: 'POST',
                            headers: { 
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ shipping_address: address, coupon_code: couponCode })
                          });
                          if (res.ok) {
                            sessionStorage.removeItem('coupon');
                            router.push('/orders');
                          } else {
                            alert('Mock payment succeeded, but order creation failed.');
                          }
                        } catch (err) {
                          alert('Error confirming mock order.');
                        }
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center transition-colors"
                    >
                      Simulate Payment
                    </button>
                  </div>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                    <CheckoutForm 
                      clientSecret={clientSecret} 
                      shippingMethod={shippingMethod} 
                      address={address} 
                      couponCode={couponCode} 
                    />
                  </Elements>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
