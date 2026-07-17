"use client";

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, Filter, SlidersHorizontal, Heart } from 'lucide-react';

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/marketplace/products?${params.toString()}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (e) {
      console.error(e);
      setProducts([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleAddToWishlist = async (productId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to add to wishlist');

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/wishlist/${productId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert('Added to wishlist!');
      } else {
        alert('Failed to add to wishlist');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-950 min-h-screen text-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className="w-full md:w-64 shrink-0 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-lg flex items-center mb-4"><SlidersHorizontal size={18} className="mr-2"/> Filters</h3>
            
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                <option value="">All Categories</option>
                <option value="Tabletop">Tabletop</option>
                <option value="Jewelry">Jewelry</option>
                <option value="Cosplay">Cosplay</option>
                <option value="Miniatures">Miniatures</option>
                <option value="Home Decor">Home Decor</option>
                <option value="Gadgets">Gadgets</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Price Range</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm" />
                <input type="number" placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>

            <button onClick={fetchProducts} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors">
              Apply Filters
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <form onSubmit={handleSearch} className="relative mb-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by title, description, or tags..." 
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-full pl-12 pr-4 py-4 focus:outline-none focus:border-blue-500 transition-colors text-lg"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors">
              Search
            </button>
          </form>

          {loading ? (
            <div className="flex justify-center py-20 text-slate-400">Loading products...</div>
          ) : (
            <>
              <p className="text-slate-400 mb-4">{products.length} product(s) found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map(p => {
                  const mainImg = p.media?.find((m: any) => m.is_primary)?.media_url || p.media?.[0]?.media_url;
                  return (
                    <div key={p.id} className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-blue-500 transition-colors flex flex-col">
                      <Link href={`/marketplace/${p.id}`} className="block aspect-square bg-slate-950 relative overflow-hidden">
                        {mainImg ? (
                           <img src={`http://127.0.0.1:8000${mainImg}`} alt={p.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-slate-700">No Image</div>
                        )}
                      </Link>
                      
                      <button 
                        onClick={() => handleAddToWishlist(p.id)}
                        className="absolute top-3 right-3 bg-slate-900/80 p-2 rounded-full hover:text-red-400 transition-colors shadow-lg z-10 border border-slate-700"
                      >
                        <Heart size={18} />
                      </button>

                      <div className="p-4 flex-1 flex flex-col">
                        <p className="text-sm text-blue-400 mb-1 font-medium">{p.category}</p>
                        <h3 className="text-white font-bold mb-2 truncate"><Link href={`/marketplace/${p.id}`}>{p.title}</Link></h3>
                        <div className="mt-auto flex justify-between items-center pt-2">
                          <p className="text-slate-300 font-semibold">${p.price.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center pt-24">Loading marketplace...</div>}>
      <MarketplaceContent />
    </Suspense>
  );
}
