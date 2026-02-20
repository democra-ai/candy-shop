import { ShoppingBag, User as UserIcon, LogOut, Plus, Library } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';

interface HeaderProps {
  onOpenAuth: () => void;
  onOpenCart: () => void;
  user: User | null;
  cartCount: number;
  onNavFind: () => void;
  onNavCd: () => void;
  onNavMan: () => void;
}

export function Header({ onOpenAuth, onOpenCart, user, cartCount, onNavFind, onNavCd, onNavMan }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Logo Area */}
        <div className="flex items-center gap-2 font-mono text-sm md:text-base">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl leading-none animate-candy-float">🍭</span>
            <span className="font-bold text-foreground font-candy text-lg">
              ~/ Candy-Shop
            </span>
          </button>
          <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wider font-mono">Open</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-mono text-foreground-secondary">
          <button onClick={onNavFind} className="hover:text-primary transition-colors flex items-center gap-2 group cursor-pointer rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <span className="text-secondary">$</span>
            <span className="group-hover:translate-x-0.5 transition-transform">find --sweet</span>
          </button>
          <button onClick={onNavCd} className="hover:text-primary transition-colors flex items-center gap-2 group cursor-pointer rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <span className="text-secondary">$</span>
            <span className="group-hover:translate-x-0.5 transition-transform">cd /chocolates</span>
          </button>
          <button onClick={onNavMan} className="hover:text-primary transition-colors flex items-center gap-2 group cursor-pointer rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
            <span className="text-secondary">$</span>
            <span className="group-hover:translate-x-0.5 transition-transform">man recipes</span>
          </button>

          {user && (
            <>
              <button
                onClick={() => navigate('/skills/create')}
                className="hover:text-primary transition-colors flex items-center gap-2 group cursor-pointer rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <Plus className="w-4 h-4" />
                <span className="group-hover:translate-x-0.5 transition-transform">create skills</span>
              </button>
              <button
                onClick={() => navigate('/skills/library')}
                className="hover:text-primary transition-colors flex items-center gap-2 group cursor-pointer rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <Library className="w-4 h-4" />
                <span className="group-hover:translate-x-0.5 transition-transform">my skills</span>
              </button>
            </>
          )}
        </nav>

        {/* Auth / Cart */}
        <div className="flex items-center gap-4 font-mono text-sm">
          <button onClick={onOpenCart} className="flex items-center gap-2 hover:text-primary transition-colors relative">
            <ShoppingBag className="w-4 h-4" />
            <span>[{cartCount}]</span>
          </button>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/5 border border-secondary/20 rounded-full hover:bg-secondary/10 transition-colors">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Avatar"
                    className="w-5 h-5 rounded-full border border-secondary/20"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-secondary" />
                )}
                <span className="font-candy text-secondary text-xs">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Agent'}
                </span>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="p-1.5 text-foreground-secondary hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
                className="flex items-center gap-2 px-4 py-1.5 text-primary border border-primary/20 rounded hover:bg-primary/5 transition-colors"
              >
              <span className="text-secondary">$</span> login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
