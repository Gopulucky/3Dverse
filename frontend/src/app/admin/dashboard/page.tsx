"use client";

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, Package, Users, Printer, Loader2, ShieldAlert } from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [days]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const res = await fetch(`http://127.0.0.1:8000/api/analytics/admin?days=${days}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) {
           setErrorMsg("Access Denied: You must be logged in as an Admin to view this dashboard.");
           return;
        }
        throw new Error("Failed to fetch analytics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to fetch analytics.");
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg) {
    return (
      <div className="flex h-screen items-center justify-center flex-col">
        <ShieldAlert className="text-red-500 w-16 h-16 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">{errorMsg}</p>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-purple-500 w-8 h-8" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center">
            <ShieldAlert className="mr-3 text-purple-600" />
            Admin Platform Analytics
          </h1>
          <p className="text-slate-500 mt-2">Track global platform health, user base, and total revenue.</p>
        </div>
        <div className="mt-4 md:mt-0">
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 shadow-sm"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mr-4 shrink-0">
            <DollarSign className="text-green-600" size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Platform Revenue</p>
            <h3 className="text-2xl font-bold text-slate-900">${data?.platform_revenue?.toFixed(2) || '0.00'}</h3>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mr-4 shrink-0">
            <Package className="text-blue-600" size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Order Volume</p>
            <h3 className="text-2xl font-bold text-slate-900">{data?.order_volume || 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mr-4 shrink-0">
            <Users className="text-purple-600" size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Users</p>
            <h3 className="text-2xl font-bold text-slate-900">{data?.total_users || 0}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex items-center">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mr-4 shrink-0">
            <Printer className="text-orange-600" size={28} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Physical vs Digital</p>
            <h3 className="text-xl font-bold text-slate-900">{data?.physical_orders || 0} / {data?.digital_orders || 0}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Platform Revenue</h3>
          <div className="h-80 w-full">
            {loading ? (
               <div className="w-full h-full flex justify-center items-center"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.chart_data || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#9333ea" strokeWidth={3} dot={{ r: 4, fill: "#9333ea", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Order Volume</h3>
          <div className="h-80 w-full">
            {loading ? (
               <div className="w-full h-full flex justify-center items-center"><Loader2 className="animate-spin text-slate-400 w-8 h-8" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.chart_data || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
