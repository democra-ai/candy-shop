import { useState } from 'react';
import { Menu, X, Github, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVersionMode } from '../../contexts/VersionModeContext';

export function NormalLayout({ children, onOpenAuth, onOpenCart, cartCount }: any) {
  const { t } = useLanguage();
  const { toggleMode } = useVersionMode();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleCartClick = () => {
    if (onOpenCart) {
      onOpenCart();
    } else {
      onOpenAuth();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 h-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-foreground">
                Candy Shop
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
                User Mode
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-6">
              <a href="#skills" className="text-muted-foreground hover:text-foreground transition-colors duration-200 text-sm font-medium">
                {t('nav.skills') || 'Skills'}
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <button onClick={toggleMode} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-all duration-200" title="Switch to Pro Mode">
                <Github className="w-3.5 h-3.5" />
                <span>Pro Mode</span>
              </button>

              <button onClick={handleCartClick} className="relative p-2 rounded-md hover:bg-secondary transition-colors duration-200">
                <ShoppingBag className="w-4 h-4 text-foreground" />
                {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">{cartCount}</span>}
              </button>

              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-md hover:bg-secondary transition-colors duration-200" aria-label="Toggle menu">
                {isMobileMenuOpen ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
              </button>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="container max-w-7xl mx-auto px-4 py-3 space-y-2">
              <a href="#skills" className="block py-2 text-muted-foreground hover:text-foreground text-sm font-medium" onClick={() => setIsMobileMenuOpen(false)}>{t('nav.skills') || 'Skills'}</a>
              <button onClick={() => { toggleMode(); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-secondary text-foreground text-sm font-medium">Switch to Pro Mode</button>
            </div>
          </div>
        )}
      </header>

      <main className="pt-14">{children}</main>
    </div>
  );
}
