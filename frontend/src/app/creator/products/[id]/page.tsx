"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileBox, Save, Loader2, Image as ImageIcon } from 'lucide-react';
import ModelViewer from '@/components/ModelViewer';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const productId = unwrappedParams.id;
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('http://127.0.0.1:8000/api/products/creator', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch products');

      const products = await res.json();
      const p = products.find((x: any) => x.id === parseInt(productId));
      if (!p) throw new Error('Product not found');
      setProduct(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e?: React.FormEvent, statusOverride?: string) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const payload = {
          title: product.title,
          description: product.description,
          price: product.price,
          category: product.category,
          status: statusOverride || product.status,
          is_mode_2_active: product.is_mode_2_active,
          is_mode_3_active: product.is_mode_3_active,
          is_mode_4_active: product.is_mode_4_active,
          digital_download_enabled: product.digital_download_enabled,
          watermark_enabled: product.watermark_enabled,
          available_materials: product.available_materials || [],
          available_colors: product.available_colors || [],
          available_sizes: product.available_sizes || [],
          base_print_price: product.base_print_price,
          mode_4_config: typeof product.mode_4_config === 'string' ? JSON.parse(product.mode_4_config) : (product.mode_4_config || {}),
      };
      
      const res = await fetch(`http://127.0.0.1:8000/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update product');
      }
      alert(statusOverride === 'published' ? 'Product published successfully!' : statusOverride === 'draft' ? 'Product unpublished.' : 'Product saved successfully');
      await fetchProduct();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = () => {
    if (product.status === 'published') {
      handleUpdate(undefined, 'draft');
    } else {
      handleUpdate(undefined, 'published');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'model' | 'media') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    if (type === 'media') {
      formData.append('is_primary', 'true');
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/api/products/${productId}/upload-${type}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Failed to upload ${type}`);
      }

      await fetchProduct();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  if (!product) return <div className="text-center p-8 text-red-500">{error || 'Product not found'}</div>;

  const latestVersion = product.versions?.find((v: any) => v.is_latest);

  return (
    <div className="max-w-6xl mx-auto p-8">
      <Link href="/creator/products" className="text-slate-400 hover:text-white flex items-center mb-6 transition-colors">
        <ArrowLeft size={16} className="mr-2" /> Back to Products
      </Link>

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          Edit Product: {product.title}
        </h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase tracking-wider ${
          product.status === 'published' ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-300'
        }`}>
          {product.status}
        </span>
      </div>

      {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-6 border border-red-500/20">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Product Details</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={product.title} 
                  onChange={e => setProduct({...product, title: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white" 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea 
                  rows={4}
                  value={product.description || ''} 
                  onChange={e => setProduct({...product, description: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white resize-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Price</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={product.price} 
                    onChange={e => setProduct({...product, price: parseFloat(e.target.value)})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white" 
                  />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center">
                  {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Publishing & Modes</h2>
              <button 
                onClick={handlePublishToggle}
                disabled={saving}
                className={`px-4 py-2 rounded font-medium ${product.status === 'published' ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-green-600 text-white hover:bg-green-700'} disabled:opacity-50 flex items-center transition-colors`}
              >
                {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                {product.status === 'published' ? 'Unpublish' : 'Publish Product'}
              </button>
            </div>
            
            <div className="space-y-6 mt-6">
              {/* Mode 2 */}
              <div className="border border-slate-700 rounded-lg p-4 bg-slate-950">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={product.is_mode_2_active} onChange={e => setProduct({...product, is_mode_2_active: e.target.checked})} className="w-5 h-5 rounded border-slate-700 text-blue-600 bg-slate-900" />
                  <span className="text-white font-medium">Mode 2: Digital Asset Sales</span>
                </label>
                {product.is_mode_2_active && (
                  <div className="mt-4 pl-8 space-y-3">
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input type="checkbox" checked={product.digital_download_enabled} onChange={e => setProduct({...product, digital_download_enabled: e.target.checked})} />
                      <span>Enable Digital Downloads</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input type="checkbox" checked={product.watermark_enabled} onChange={e => setProduct({...product, watermark_enabled: e.target.checked})} />
                      <span>Apply Watermarks to Preview Images on Publish</span>
                    </label>
                  </div>
                )}
              </div>
              
              {/* Mode 3 */}
              <div className="border border-slate-700 rounded-lg p-4 bg-slate-950">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={product.is_mode_3_active} onChange={e => setProduct({...product, is_mode_3_active: e.target.checked})} className="w-5 h-5 rounded border-slate-700 text-blue-600 bg-slate-900" />
                  <span className="text-white font-medium">Mode 3: Physical Prints</span>
                </label>
                {product.is_mode_3_active && (
                  <div className="mt-4 pl-8 space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Base Print Price ($)</label>
                      <input type="number" step="0.01" value={product.base_print_price} onChange={e => setProduct({...product, base_print_price: parseFloat(e.target.value)})} className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Materials (comma separated)</label>
                      <input type="text" value={(product.available_materials || []).join(', ')} onChange={e => setProduct({...product, available_materials: e.target.value.split(',').map((s: string)=>s.trim()).filter(Boolean)})} placeholder="e.g. PLA, ABS, Resin" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Colors (comma separated)</label>
                        <input type="text" value={(product.available_colors || []).join(', ')} onChange={e => setProduct({...product, available_colors: e.target.value.split(',').map((s: string)=>s.trim()).filter(Boolean)})} placeholder="e.g. Red, Blue" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Sizes (comma separated)</label>
                        <input type="text" value={(product.available_sizes || []).join(', ')} onChange={e => setProduct({...product, available_sizes: e.target.value.split(',').map((s: string)=>s.trim()).filter(Boolean)})} placeholder="e.g. Small, Large" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Mode 4 */}
              <div className="border border-slate-700 rounded-lg p-4 bg-slate-950">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={product.is_mode_4_active} onChange={e => setProduct({...product, is_mode_4_active: e.target.checked})} className="w-5 h-5 rounded border-slate-700 text-blue-600 bg-slate-900" />
                  <span className="text-white font-medium">Mode 4: Customizable Merchandise</span>
                </label>
                {product.is_mode_4_active && (
                  <div className="mt-4 pl-8">
                    <label className="block text-sm text-slate-400 mb-1">JSON Configuration Schema</label>
                    <textarea 
                      rows={6}
                      value={typeof product.mode_4_config === 'string' ? product.mode_4_config : JSON.stringify(product.mode_4_config || {}, null, 2)}
                      onChange={e => {
                        try {
                           const parsed = JSON.parse(e.target.value);
                           setProduct({...product, mode_4_config: parsed});
                        } catch {
                           setProduct({...product, mode_4_config: e.target.value});
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm"
                      placeholder='{"custom_text": {"type": "string", "maxLength": 10}}'
                    />
                    <p className="text-xs text-slate-500 mt-1">Provide a JSON schema defining customizable fields.</p>
                  </div>
                )}
              </div>
              
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">3D Model Files</h2>
            
            <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center mb-6">
              <FileBox size={40} className="mx-auto text-slate-500 mb-3" />
              <p className="text-slate-300 mb-4">Upload a new version of your 3D model.</p>
              <p className="text-xs text-slate-500 mb-4">Supported formats: .stl, .obj, .3mf, .step, .fbx, .blend</p>
              
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded inline-flex items-center transition-colors">
                {uploading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Upload size={16} className="mr-2" />}
                {uploading ? 'Uploading...' : 'Select File'}
                <input type="file" className="hidden" accept=".stl,.obj,.3mf,.step,.fbx,.blend" onChange={(e) => handleFileUpload(e, 'model')} disabled={uploading} />
              </label>
            </div>

            {product.versions && product.versions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Version History</h3>
                <div className="space-y-3">
                  {product.versions.sort((a: any, b: any) => b.version_number - a.version_number).map((v: any) => {
                    const report = v.printability_report;
                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'pass': return 'bg-green-500/20 text-green-400 border-green-500/30';
                        case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                        case 'fail': return 'bg-red-500/20 text-red-400 border-red-500/30';
                        case 'needs-manual-review': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
                        default: return 'bg-slate-700 text-slate-300 border-slate-600';
                      }
                    };

                    return (
                      <div key={v.id} className={`flex flex-col p-3 rounded-lg border ${v.is_latest ? 'bg-blue-900/20 border-blue-800/50' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-white font-medium">Version {v.version_number} {v.is_latest && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded ml-2">Latest</span>}</span>
                            <span className="text-xs text-slate-500">{v.file_name} ({(v.file_size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <span className="text-xs text-slate-500">{new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {/* Printability Report Section */}
                        <div className="mt-3 pt-3 border-t border-slate-800/50">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-slate-400 font-medium">Printability Analysis:</span>
                            {report ? (
                              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${getStatusColor(report.status)}`}>
                                {report.status}
                              </span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border bg-slate-800 text-slate-400 border-slate-700">
                                None
                              </span>
                            )}
                          </div>
                          
                          {report && report.issues && report.issues.length > 0 && (
                            <div className="mt-2 text-xs text-slate-300 bg-slate-900 rounded p-2 border border-slate-800">
                              <span className="font-semibold text-slate-400 mb-1 block">Issues found:</span>
                              <ul className="list-disc pl-4 space-y-1">
                                {report.issues.map((issue: string, idx: number) => (
                                  <li key={idx}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {report && report.volume_mm3 && (
                            <div className="mt-2 text-xs text-slate-500">
                              Volume: {(report.volume_mm3 / 1000).toFixed(2)} cm³
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Model Preview</h2>
            {latestVersion ? (
              <ModelViewer 
                url={`http://127.0.0.1:8000${latestVersion.file_url}`} 
                extension={latestVersion.file_name.split('.').pop() || ''} 
              />
            ) : (
              <div className="bg-slate-950 rounded-lg h-48 flex items-center justify-center text-slate-500 border border-slate-800">
                <p>No model uploaded yet</p>
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Product Images</h2>
            <div className="space-y-4">
              {product.media?.filter((m: any) => m.media_type === 'image').map((m: any) => (
                <div key={m.id} className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                  <img src={`http://127.0.0.1:8000${m.media_url}`} alt="Product preview" className="w-full h-auto object-cover" />
                  {m.is_primary && <span className="absolute top-2 right-2 bg-blue-600 text-xs px-2 py-1 rounded shadow">Primary</span>}
                </div>
              ))}

              <label className="flex items-center justify-center p-4 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors">
                <ImageIcon size={20} className="mr-2" />
                <span>Upload Image</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'media')} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
