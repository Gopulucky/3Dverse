"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // Determine which portal we are in
  const isCreator = pathname.startsWith('/creator');
  const isPartner = pathname.startsWith('/partner');
  const isAdmin = pathname.startsWith('/admin');
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isRoot = pathname === '/';
  
  // By default, if not in creator, partner, admin, or root, we assume Customer Marketplace
  const isMarketplace = !isCreator && !isPartner && !isAdmin && !isRoot && !isAuth;

  return (
    <html lang="en">
      <title>3DVerse</title>
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 flex flex-col`}>
        {/* Only show navbar if not on root landing page */}
        {!isRoot && (
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                
                {/* Logo */}
                <div className="flex items-center">
                  <Link href="/" className="flex items-center text-2xl font-black text-blue-600 tracking-tighter">
                    3D<span className="text-gray-900">Verse</span>
                  </Link>

                  {/* Dynamic Navigation Links */}
                  <div className="hidden md:ml-10 md:flex md:space-x-8">
                    
                    {/* Marketplace / Customer Links */}
                    {isMarketplace && (
                      <>
                        <Link href="/marketplace/home" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Home</Link>
                        <Link href="/marketplace" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Browse</Link>
                        <Link href="/wishlist" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Wishlist</Link>
                        <Link href="/cart" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Cart</Link>
                        <Link href="/orders" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">My Orders</Link>
                      </>
                    )}

                    {/* Creator Links */}
                    {isCreator && (
                      <>
                        <Link href="/creator/dashboard" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Dashboard</Link>
                        <Link href="/creator/products" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">My Products</Link>
                        <Link href="/creator/products/new" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Upload New Product</Link>
                      </>
                    )}

                    {/* Partner Links */}
                    {isPartner && (
                      <>
                        <Link href="/partner" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Print Queue</Link>
                      </>
                    )}

                    {/* Admin Links */}
                    {isAdmin && (
                      <>
                        <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors">Platform Analytics</Link>
                      </>
                    )}

                  </div>
                </div>

                {/* Auth Buttons */}
                {!isAuth && (
                  <div className="flex items-center space-x-4">
                    <Link href="/login" className="text-gray-600 hover:text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      Log in
                    </Link>
                    <Link href="/register" className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </nav>
        )}

        <main className={`flex-1 w-full ${isRoot ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
          {children}
        </main>
      </body>
    </html>
  );
}
