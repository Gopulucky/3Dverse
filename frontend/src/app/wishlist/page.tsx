"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';

export default function WishlistPage() {
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        setLoading(false);
        return;
    }
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/wishlist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWishlist(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const handleRemove = async (productId: number) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWishlist(wishlist.filter(w => w.product_id !== productId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center pt-24">Loading...</div>;

  return (
    <div className="bg-slate-950 min-h-screen text-white pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        
        {wishlist.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
            <p className="text-slate-400 mb-4">Your wishlist is empty.</p>
            <Link href="/marketplace" className="text-blue-500 hover:underline">Explore the Marketplace</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {wishlist.map(item => {
              const p = item.product;
              const mainImg = p.media?.find((m: any) => m.is_primary)?.media_url || p.media?.[0]?.media_url;
              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-6 items-center">
                  <div className="w-24 h-24 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-slate-800">
                    {mainImg ? (
                       <img src={`http://127.0.0.1:8000${mainImg}`} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">No Image</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-blue-400 mb-1">{p.category}</p>
                    <h3 className="font-bold text-lg"><Link href={`/marketplace/${p.id}`}>{p.title}</Link></h3>
                    <p className="text-slate-400 font-semibold mt-1">${p.price.toFixed(2)}</p>
                  </div>
                  <button onClick={() => handleRemove(p.id)} className="p-3 text-slate-500 hover:text-red-400 bg-slate-950 rounded-lg border border-slate-800 transition-colors">
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
