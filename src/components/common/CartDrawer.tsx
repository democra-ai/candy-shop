import { X, Trash2, Download, Copy, Check, Terminal, ShoppingBag, PackageX, CreditCard, Zap, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { SKILLS_DATA } from '../../data/skillsData';
import { formatPrice } from '../../lib/payment/payment-client';
import { toast } from 'sonner';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartIds: Set<string>;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPurchase: () => void;
  /** Payment loading state */
  paymentLoading?: boolean;
  /** Whether Stripe is available */
  stripeAvailable?: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  cartIds,
  onRemove,
  onClear,
  onPurchase,
  paymentLoading = false,
  stripeAvailable = false,
}: CartDrawerProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get full skill objects from IDs
  const cartItems = SKILLS_DATA.filter(skill => cartIds.has(skill.id));

  // Separate free and paid items
  const freeItems = cartItems.filter(item => !item.price || item.price === 0);
  const paidItems = cartItems.filter(item => item.price && item.price > 0);
  const totalPrice = paidItems.reduce((sum, item) => sum + (item.price || 0), 0);

  // Merge configurations
  const mergedConfig = {
    mcpServers: cartItems.reduce((acc, skill) => {
      return { ...acc, ...skill.config };
    }, {})
  };

  const configString = JSON.stringify(mergedConfig, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(configString);
    setCopied(true);
    toast.success('Configuration copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity z-[100] ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-card shadow-2xl transform transition-transform duration-300 z-[101] flex flex-col border-l border-border ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >

        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-secondary/50">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-candy font-bold text-foreground">Your Bag</h2>
            <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
              {cartItems.length} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-secondary rounded-full transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Close bag"
          >
            <X className="w-5 h-5 text-foreground-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 opacity-50">
              <PackageX className="w-16 h-16 text-foreground-secondary mx-auto mb-4" />
              <p className="font-mono text-foreground-secondary">Your bag is empty.</p>
              <button
                onClick={onClose}
                className="mt-4 text-primary hover:underline font-bold text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-2 py-1"
              >
                Browse Treats
              </button>
            </div>
          ) : (
            <>
              {/* List */}
              <div className="space-y-3">
                {cartItems.map(item => (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-secondary/50 border border-border rounded-xl group hover:border-primary/20 transition-colors duration-200">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${item.color}`} aria-hidden="true">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-sm truncate">{item.name}</h4>
                      <p className="font-mono text-xs text-foreground-tertiary truncate">{item.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.price && item.price > 0 ? (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {formatPrice(item.price)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-foreground-tertiary">Free</span>
                      )}
                      <button
                        onClick={() => onRemove(item.id)}
                        className="p-2.5 text-foreground-tertiary hover:text-error hover:bg-error/10 rounded-lg transition-colors duration-200 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-error/30"
                        aria-label={`Remove ${item.name} from bag`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Summary */}
              {paidItems.length > 0 && (
                <div className="bg-secondary/50 rounded-xl p-4 border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Free skills ({freeItems.length})</span>
                    <span className="text-foreground-tertiary">$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Premium skills ({paidItems.length})</span>
                    <span className="font-bold text-foreground">{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="font-bold text-lg text-primary">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              )}

              {/* Config Builder Preview */}
              <div className="bg-zinc-900 rounded-xl overflow-hidden mt-4 shadow-lg">
                <div className="bg-zinc-800 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
                    <Terminal className="w-3 h-3" />
                    claude_desktop_config.json
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-white/80 hover:text-white flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label={copied ? 'Configuration copied' : 'Copy configuration'}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-xs text-green-400 font-mono">
                    {configString}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-border bg-secondary/50 space-y-3">
            {/* Copy config button */}
            <button
              onClick={handleCopy}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold font-candy text-lg shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Copy merged configuration"
            >
              <Download className="w-5 h-5" />
              checkout --merge
            </button>

            {/* Purchase / Pay button */}
            <button
              onClick={onPurchase}
              disabled={paymentLoading}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold font-candy text-lg shadow-lg shadow-green-500/20 hover:from-green-600 hover:to-emerald-600 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={totalPrice > 0 ? `Pay ${formatPrice(totalPrice)}` : 'Complete purchase'}
            >
              {paymentLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : totalPrice > 0 ? (
                <CreditCard className="w-5 h-5" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              {paymentLoading
                ? 'Processing...'
                : totalPrice > 0
                  ? `Pay ${formatPrice(totalPrice)}`
                  : 'Install Free Skills'}
            </button>

            {/* Payment method indicators */}
            {totalPrice > 0 && (
              <div className="flex items-center justify-center gap-4 text-xs text-foreground-tertiary">
                {stripeAvailable && (
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Stripe
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" /> x402-ready
                </span>
              </div>
            )}

            <button
              onClick={onClear}
              className="w-full py-2 text-foreground-tertiary text-xs font-mono hover:text-error transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-error/30 rounded-lg"
              aria-label="Clear all items from bag"
            >
              $ rm -rf ./bag/*
            </button>
          </div>
        )}
      </div>
    </>
  );
}
