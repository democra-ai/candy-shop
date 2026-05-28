import { X, Trash2, Copy, Check, Terminal, ShoppingBag, CreditCard, Zap, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SKILLS_DATA } from '../../data/skillsData';
import { formatPrice } from '../../lib/payment/payment-client';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useIsDark } from '../../hooks/useIsDark';
import { getFlavor } from '../../utils/candyShells';
import { EmptyJar, getCandyIcon } from '../illustrations';

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
  const isDark = useIsDark();
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

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

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const cartItems = SKILLS_DATA.filter(skill => cartIds.has(skill.id));
  const freeItems = cartItems.filter(item => !item.price || item.price === 0);
  const paidItems = cartItems.filter(item => item.price && item.price > 0);
  const totalPrice = paidItems.reduce((sum, item) => sum + (item.price || 0), 0);

  const mergedConfig = {
    mcpServers: cartItems.reduce((acc, skill) => ({ ...acc, ...skill.config }), {}),
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
      {/* Backdrop — token-driven per §5 */}
      <div
        className={cn(
          'fixed inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 z-[100]',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        className={cn(
          'fixed inset-y-0 right-0 w-full max-w-md bg-card shadow-candy-3 border-l border-border',
          'transform transition-transform duration-300 ease-out z-[101] flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-candy font-bold text-foreground">Your Bag</h2>
            <span className="bg-primary/10 text-primary text-[11px] font-mono font-bold px-2 py-0.5 rounded-full">
              {cartItems.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-full text-foreground-secondary hover:bg-secondary hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <EmptyJar size={96} className="mb-4" />
              <p className="font-candy text-lg font-bold text-foreground">Your bag is empty</p>
              <p className="text-sm text-foreground-secondary mt-1">Add a treat or two from the shop.</p>
              <button
                onClick={onClose}
                className="mt-5 inline-flex items-center justify-center h-10 px-5 rounded-2xl border border-border bg-card text-foreground text-sm font-semibold hover:border-border-hover hover:shadow-candy-1 transition-all focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Browse treats
              </button>
            </div>
          ) : (
            <>
              {/* Line items */}
              <div className="space-y-3">
                {cartItems.map(item => {
                  const f = getFlavor(item.category, isDark);
                  const Candy = getCandyIcon(item.category, isDark);
                  return (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-secondary/40 border border-border rounded-xl hover:border-border-hover transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.tint }} aria-hidden="true">
                      <Candy size={24} color={f.base} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-sm truncate">{item.name}</h4>
                      <p className="font-mono text-xs text-foreground-tertiary truncate">{item.id}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.price && item.price > 0 ? (
                        <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {formatPrice(item.price)}
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-foreground-tertiary">free</span>
                      )}
                      <button
                        onClick={() => onRemove(item.id)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-foreground-tertiary hover:text-error hover:bg-error/10 transition-colors focus:outline-none focus:ring-2 focus:ring-error/30"
                        aria-label={`Remove ${item.name} from bag`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Price summary */}
              {paidItems.length > 0 && (
                <div className="bg-secondary/40 rounded-xl p-4 border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Free skills ({freeItems.length})</span>
                    <span className="text-foreground-tertiary font-mono">$0.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground-secondary">Premium skills ({paidItems.length})</span>
                    <span className="font-bold text-foreground font-mono">{formatPrice(totalPrice)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-center">
                    <span className="font-bold text-foreground">Subtotal</span>
                    <span className="font-bold text-lg text-primary font-mono">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              )}

              {/* Config preview */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-secondary/60 border-b border-border px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-foreground-secondary font-mono">
                    <Terminal className="w-3 h-3" />
                    claude_desktop_config.json
                  </div>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-foreground-secondary hover:text-foreground flex items-center gap-1.5 hover:bg-card px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label={copied ? 'Configuration copied' : 'Copy configuration'}
                  >
                    {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto bg-secondary/30 max-h-48">
                  <pre className="text-xs text-foreground-secondary font-mono">{configString}</pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-border space-y-3 shrink-0">
            {/* Checkout — primary pill */}
            <button
              onClick={onPurchase}
              disabled={paymentLoading}
              className="candy-btn btn-press w-full h-12 rounded-2xl font-semibold flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
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
                ? 'Processing…'
                : totalPrice > 0
                  ? `Checkout · ${formatPrice(totalPrice)}`
                  : 'Install free skills'}
            </button>

            {/* Copy merged config — secondary */}
            <button
              onClick={handleCopy}
              className="w-full h-10 rounded-full border border-border bg-card text-foreground text-sm font-semibold hover:border-border-hover hover:bg-secondary transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Copy merged configuration"
            >
              <Copy className="w-4 h-4" />
              Copy merged config
            </button>

            {/* Payment method indicators */}
            {totalPrice > 0 && (
              <div className="flex items-center justify-center gap-4 text-xs text-foreground-tertiary">
                {stripeAvailable && (
                  <span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Stripe</span>
                )}
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> x402-ready</span>
              </div>
            )}

            <button
              onClick={onClear}
              className="w-full h-9 text-foreground-tertiary text-xs font-medium hover:text-error transition-colors focus:outline-none focus:ring-2 focus:ring-error/30 rounded-lg"
              aria-label="Clear all items from bag"
            >
              Clear bag
            </button>
          </div>
        )}
      </div>
    </>
  );
}
