"use client";

import Link from 'next/link';
import { ShoppingBag, Palette, Printer } from 'lucide-react';

export default function PortalSelection() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none"></div>
      
      <div className="z-10 text-center max-w-4xl mx-auto w-full">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">3DVerse</span>
        </h1>
        <p className="text-xl text-slate-400 mb-16">Choose your portal to get started.</p>

        <div className="grid md:grid-cols-3 gap-8">
          
          <Link href="/marketplace/home" className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl p-8 hover:bg-slate-800 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:border-blue-500/50 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShoppingBag className="text-blue-400" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Marketplace</h2>
            <p className="text-slate-400">I am a customer looking to discover, download, and purchase 3D models.</p>
          </Link>

          <Link href="/creator/products" className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl p-8 hover:bg-slate-800 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:border-purple-500/50 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Palette className="text-purple-400" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Creator Portal</h2>
            <p className="text-slate-400">I am a creator looking to upload designs, manage products, and track sales.</p>
          </Link>

          <Link href="/partner" className="group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl p-8 hover:bg-slate-800 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:border-green-500/50 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Printer className="text-green-400" size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Print Partner</h2>
            <p className="text-slate-400">I am a print facility managing incoming physical print orders.</p>
          </Link>

          <Link href="/admin/dashboard" className="md:col-span-3 lg:col-span-1 lg:col-start-2 group relative bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-3xl p-8 hover:bg-slate-800 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:border-orange-500/50 text-center flex flex-col items-center mt-4 lg:mt-0">
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <span className="text-orange-400 font-bold text-xl">A</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Admin Platform</h2>
            <p className="text-sm text-slate-400">Manage the platform, view analytics, and track revenue.</p>
          </Link>

        </div>
      </div>
    </div>
  );
}
