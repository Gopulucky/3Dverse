"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star, Tag, Clock } from 'lucide-react';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/marketplace/homepage')
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        // Fallback or empty data if fetch fails
        setData({ featured: [], trending: [], new_arrivals: [], categories: [] });
        setLoading(false);
      });
  }, []);

  const ProductCard = ({ p }: { p: any }) => {
    const mainImg = p.media?.find((m: any) => m.is_primary)?.media_url || p.media?.[0]?.media_url;
    return (
      <Link href={`/marketplace/${p.id}`} className="group block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-blue-500 transition-colors">
        <div className="aspect-square bg-slate-950 relative overflow-hidden">
          {mainImg ? (
             <img src={`http://127.0.0.1:8000${mainImg}`} alt={p.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
          ) : (
             <div className="w-full h-full flex items-center justify-center text-slate-700">No Image</div>
          )}
          {p.is_featured && <span className="absolute top-2 left-2 bg-blue-600 text-xs px-2 py-1 rounded-md text-white shadow-md">Featured</span>}
        </div>
        <div className="p-4">
          <p className="text-sm text-blue-400 mb-1 font-medium">{p.category}</p>
          <h3 className="text-white font-bold mb-2 truncate">{p.title}</h3>
          <p className="text-slate-400 text-sm font-semibold">${p.price.toFixed(2)}</p>
        </div>
      </Link>
    );
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="bg-slate-950 min-h-screen text-white pb-20">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Discover <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Extraordinary</span> 3D Assets
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            The premium marketplace for digital downloads, physical prints, and customizable 3D merchandise.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/marketplace" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-full transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)]">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {data.featured?.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-20">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold flex items-center"><Star className="text-yellow-400 mr-3" /> Featured Products</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {data.featured.map((p: any) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Trending */}
      {data.trending?.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-20">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold flex items-center"><Tag className="text-green-400 mr-3" /> Trending Now</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {data.trending.map((p: any) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* New Arrivals */}
      {data.new_arrivals?.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 mt-20">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-3xl font-bold flex items-center"><Clock className="text-blue-400 mr-3" /> New Arrivals</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {data.new_arrivals.map((p: any) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-6 mt-20">
        <h2 className="text-3xl font-bold mb-8 text-center">Shop by Category</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {data.categories.map((c: string) => (
            <Link key={c} href={`/marketplace?category=${encodeURIComponent(c)}`} className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-full hover:bg-slate-800 hover:border-blue-500 transition-colors">
              {c}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
