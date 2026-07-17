"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, CheckCircle, PackageSearch, PackageCheck, Truck } from 'lucide-react';

export default function PartnerDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      const res = await fetch('http://127.0.0.1:8000/api/partner/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setJobs(await res.json());
      } else {
        router.push('/');
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const updateStatus = async (orderId: int, status: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://127.0.0.1:8000/api/partner/jobs/${orderId}/status`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      fetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex justify-center pt-24">Loading jobs...</div>;

  const STATUS_FLOW = ["queued", "printing", "qc", "packed", "shipped", "delivered"];

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-8 flex items-center">
          <Settings className="mr-3 text-purple-500" /> Print Partner Dashboard
        </h1>

        {jobs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            You currently have no print jobs assigned.
          </div>
        ) : (
          <div className="space-y-6">
            {jobs.map(job => {
              const currentStepIndex = STATUS_FLOW.indexOf(job.status);
              
              return (
                <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Job ID</p>
                      <p className="text-sm font-mono text-slate-300">#{job.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Date Assigned</p>
                      <p className="text-sm">{new Date(job.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">Status</p>
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold uppercase rounded-full border border-purple-500/30">
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                      {/* Job Details */}
                      <div>
                        <h3 className="font-semibold mb-4 text-slate-300">Items to Print</h3>
                        <div className="space-y-3">
                          {job.items?.map((item: any) => (
                            <div key={item.id} className="flex gap-4 border border-slate-800 p-3 rounded">
                              <div className="flex-1">
                                <p className="font-bold">{item.product?.title || `Product #${item.product_id}`}</p>
                                {item.selected_config && (
                                  <p className="text-xs text-slate-500 font-mono mt-1">{JSON.stringify(item.selected_config)}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Panel */}
                      <div>
                        <h3 className="font-semibold mb-4 text-slate-300">Update Status</h3>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_FLOW.map((status, idx) => {
                            const isPast = idx < currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            const isNext = idx === currentStepIndex + 1;
                            
                            return (
                              <button
                                key={status}
                                disabled={!isNext}
                                onClick={() => updateStatus(job.id, status)}
                                className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                                  isPast ? "bg-green-500/20 border-green-500/50 text-green-400 opacity-50 cursor-not-allowed" :
                                  isCurrent ? "bg-purple-600 border-purple-500 text-white cursor-default" :
                                  isNext ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white" :
                                  "bg-slate-950 border-slate-900 text-slate-600 cursor-not-allowed"
                                }`}
                              >
                                {status.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                        
                        {job.tracking_url && (
                          <div className="mt-6 p-4 bg-slate-950 border border-slate-800 rounded">
                            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Shiprocket Info</p>
                            <a href={job.tracking_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center text-sm">
                              <Truck size={14} className="mr-2" /> Track Shipment
                            </a>
                            <p className="text-xs text-slate-500 mt-2 font-mono">AWB / Order: {job.shiprocket_order_id}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
