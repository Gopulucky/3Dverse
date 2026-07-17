"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Package, Edit, Loader2 } from 'lucide-react';

interface Product {
  id: number;
  title: string;
  status: string;
  price: number;
  created_at: string;
}

export default function CreatorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const res = await fetch('http://127.0.0.1:8000/api/products/creator', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: You must be a Creator to view this page. If you recently registered, please sign up again and select the Creator role.');
        }
        throw new Error('Failed to fetch products');
      }

      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Package className="mr-3 text-blue-500" />
          My Products
        </h1>
        <Link href="/creator/products/new" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center transition-colors">
          <Plus size={20} className="mr-1" />
          New Product
        </Link>
      </div>

      {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-6 border border-red-500/20">{error}</div>}

      {products.length === 0 ? (
        <div className="bg-slate-900 rounded-lg p-12 text-center border border-slate-800">
          <Package size={48} className="mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">No products yet</h2>
          <p className="text-slate-400 mb-6">Start building your portfolio by creating your first 3D model product.</p>
          <Link href="/creator/products/new" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded inline-flex items-center transition-colors">
            <Plus size={20} className="mr-1" />
            Create Product
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map(product => (
            <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-600 transition-all flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white line-clamp-1">{product.title}</h3>
                <span className={`px-2 py-1 text-xs rounded font-medium uppercase tracking-wider ${
                  product.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'
                }`}>
                  {product.status}
                </span>
              </div>
              <div className="mt-auto pt-4 flex justify-between items-center border-t border-slate-800">
                <span className="text-lg font-semibold text-blue-400">${product.price.toFixed(2)}</span>
                <Link href={`/creator/products/${product.id}`} className="text-slate-400 hover:text-white transition-colors flex items-center text-sm font-medium">
                  <Edit size={16} className="mr-1" />
                  Edit Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
