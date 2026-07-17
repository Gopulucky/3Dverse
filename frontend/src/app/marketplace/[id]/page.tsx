"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Star, Heart, ShoppingCart, User as UserIcon } from 'lucide-react';

function Model({ url }: { url: string }) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | THREE.Group | null>(null);

  useEffect(() => {
    if (!url) return;
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (extension === 'stl') {
      const loader = new STLLoader();
      loader.load(url, (geo) => {
        geo.center();
        setGeometry(geo);
      });
    } else if (extension === 'obj') {
      const loader = new OBJLoader();
      loader.load(url, (group) => {
        setGeometry(group);
      });
    }
  }, [url]);

  if (!geometry) return null;

  if (geometry instanceof THREE.BufferGeometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#94a3b8" metalness={0.2} roughness={0.8} />
      </mesh>
    );
  } else {
    return <primitive object={geometry} />;
  }
}

function ModelViewer({ url }: { url: string }) {
  return (
    <div className="w-full h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
      <Canvas camera={{ position: [0, 0, 150], fov: 50 }}>
        <Stage environment="city" intensity={0.5}>
          <Model url={url} />
        </Stage>
        <OrbitControls makeDefault autoRotate autoRotateSpeed={2} />
      </Canvas>
    </div>
  );
}

export default function CustomerProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);

  useEffect(() => {
    if (!id) return;
    
    const fetchAll = async () => {
      try {
        const [prodRes, revRes, similarRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/marketplace/products/${id}`),
          fetch(`http://127.0.0.1:8000/api/reviews/${id}`),
          fetch(`http://127.0.0.1:8000/api/marketplace/products/${id}/similar`)
        ]);
        
        if (prodRes.ok) setProduct(await prodRes.json());
        if (revRes.ok) setReviews(await revRes.json());
        if (similarRes.ok) setSimilarProducts(await similarRes.json());
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };

    fetchAll();
  }, [id]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) return alert("Please login to leave a review.");

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/reviews/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating: reviewRating, text: reviewText })
      });

      if (res.ok) {
        const newRev = await res.json();
        setReviews([...reviews, newRev]);
        setReviewText('');
      } else {
        alert("Failed to submit review");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToWishlist = async () => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to add to wishlist');

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/wishlist/${id}`, {
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

  const handleAddToCart = async () => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login to add to cart');

    // Collect configurations (simplified)
    const selectedConfig: any = {};
    // ... we would normally collect state from the selects/inputs above

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: Number(id),
          quantity: 1,
          selected_config: selectedConfig
        })
      });
      if (res.ok) {
        alert('Added to cart!');
      } else {
        alert('Failed to add to cart');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center pt-24">Loading product...</div>;
  if (!product) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center pt-24">Product not found</div>;

  const latestVersion = product.versions && product.versions.length > 0 ? product.versions[product.versions.length - 1] : null;
  const modelUrl = latestVersion?.file_url ? `http://127.0.0.1:8000${latestVersion.file_url}` : null;
  
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "New";

  return (
    <div className="bg-slate-950 min-h-screen text-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          {/* Left: 3D Viewer & Media */}
          <div className="space-y-4">
            {modelUrl ? (
              <div className="h-[500px]">
                <ModelViewer url={modelUrl} />
              </div>
            ) : (
              <div className="h-[500px] bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                No 3D Model Available
              </div>
            )}
            
            {/* Gallery thumbnails */}
            {product.media && product.media.length > 0 && (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {product.media.map((m: any) => (
                  <img key={m.id} src={`http://127.0.0.1:8000${m.media_url}`} className="w-20 h-20 object-cover rounded-lg border border-slate-800" alt="thumbnail" />
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details & Purchase Form */}
          <div>
            <div className="flex items-center space-x-2 text-sm text-blue-400 font-semibold mb-2">
              <span>{product.category}</span>
              <span>•</span>
              <span className="flex items-center text-yellow-400"><Star size={14} className="mr-1 inline" /> {avgRating} ({reviews.length} reviews)</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">{product.title}</h1>
            <p className="text-3xl font-light text-slate-300 mb-6">${product.price.toFixed(2)}</p>
            
            <p className="text-slate-400 mb-8 whitespace-pre-line leading-relaxed">{product.description}</p>

            {/* Mock Order Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 space-y-6">
              
              {product.is_mode_3_active && (
                <div className="space-y-4 border-b border-slate-800 pb-6">
                  <h3 className="font-semibold text-lg text-white">Physical Print Options</h3>
                  {product.available_materials?.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Material</label>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2">
                        {product.available_materials.map((m: string) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  )}
                  {product.available_colors?.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Color</label>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2">
                        {product.available_colors.map((c: string) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                  {product.available_sizes?.length > 0 && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Size</label>
                      <select className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2">
                        {product.available_sizes.map((s: string) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {product.is_mode_4_active && product.mode_4_config && Object.keys(product.mode_4_config).length > 0 && (
                <div className="space-y-4 border-b border-slate-800 pb-6">
                  <h3 className="font-semibold text-lg text-white">Customization</h3>
                  {Object.entries(product.mode_4_config).map(([key, config]: [string, any]) => (
                    <div key={key}>
                      <label className="block text-sm text-slate-400 mb-2 capitalize">{key.replace('_', ' ')}</label>
                      <input type="text" placeholder={config.description || ""} maxLength={config.maxLength} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2" />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={handleAddToCart} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors">
                  <ShoppingCart size={18} className="mr-2" /> Add to Cart
                </button>
                <button onClick={handleAddToWishlist} className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center transition-colors border border-slate-700">
                  <Heart size={20} />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Similar Products Section */}
        {similarProducts.length > 0 && (
          <div className="border-t border-slate-800 pt-16 mb-16">
            <h2 className="text-2xl font-bold mb-8">Similar Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {similarProducts.map((p: any) => (
                <a key={p.id} href={`/marketplace/${p.id}`} className="block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
                  <div className="aspect-square bg-slate-800 relative">
                    {p.media && p.media.length > 0 ? (
                      <img src={`http://127.0.0.1:8000${p.media[0].media_url}`} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-200 truncate">{p.title}</h3>
                    <p className="text-blue-400 font-medium mt-1">${p.price.toFixed(2)}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="border-t border-slate-800 pt-16">
          <h2 className="text-2xl font-bold mb-8">Customer Reviews</h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            
            {/* Submit Review */}
            <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 h-fit">
              <h3 className="text-lg font-semibold mb-4">Write a Review</h3>
              <form onSubmit={submitReview} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Rating</label>
                  <select value={reviewRating} onChange={e => setReviewRating(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-yellow-400">
                    <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                    <option value={3}>⭐⭐⭐ (3/5)</option>
                    <option value={2}>⭐⭐ (2/5)</option>
                    <option value={1}>⭐ (1/5)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Review</label>
                  <textarea 
                    required
                    rows={4}
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2"
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors">
                  Submit Review
                </button>
              </form>
            </div>

            {/* List Reviews */}
            <div className="md:col-span-2 space-y-6">
              {reviews.length === 0 ? (
                <p className="text-slate-500 italic">No reviews yet. Be the first!</p>
              ) : (
                reviews.map(r => (
                  <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex gap-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center shrink-0">
                      <UserIcon size={20} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold">{r.user?.full_name || "User"}</span>
                        <span className="text-yellow-400 text-sm">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{new Date(r.created_at).toLocaleDateString()}</p>
                      <p className="text-slate-300">{r.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
