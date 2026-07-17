"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: 0,
    license_type: 'standard',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let value: any = e.target.value;
    if (e.target.type === 'number') {
      value = e.target.value === '' ? '' : parseFloat(e.target.value);
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('http://127.0.0.1:8000/api/products/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          status: 'draft',
          tags: []
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to create product');
      }

      const product = await res.json();
      router.push(`/creator/products/${product.id}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link href="/creator/products" className="text-slate-400 hover:text-white flex items-center mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-2" />
        Back to Products
      </Link>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
        <h1 className="text-2xl font-bold text-white mb-6 border-b border-slate-800 pb-4">Create New Product</h1>

        {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-6 border border-red-500/20">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Title *</label>
            <input 
              type="text" 
              name="title" 
              required 
              value={formData.title} 
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g., Cyberpunk Character Model"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea 
              name="description" 
              rows={4}
              value={formData.description} 
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Describe your model..."
            ></textarea>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select 
                name="category"
                value={formData.category} 
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                <option value="characters">Characters</option>
                <option value="environments">Environments</option>
                <option value="props">Props</option>
                <option value="vehicles">Vehicles</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Price ($)</label>
              <input 
                type="number" 
                name="price"
                min="0"
                step="0.01"
                required
                value={formData.price} 
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <button 
              type="submit" 
              disabled={loading || !formData.title}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-lg flex items-center transition-colors"
            >
              {loading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Save size={20} className="mr-2" />}
              Save Draft & Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
