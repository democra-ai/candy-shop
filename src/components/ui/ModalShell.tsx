/**
 * ModalShell — the one shared centered-modal primitive (DESIGN.md §5).
 *
 * Every centered modal (Skill, Docs, Auth, PostCandy, PostCraving) renders
 * through this so the shell feel is identical:
 *   - backdrop  : bg-foreground/40 backdrop-blur-sm  (token-driven, NOT bg-black/40)
 *   - panel     : bg-card rounded-2xl border border-border shadow-xl
 *   - open anim : scale + opacity (animate-zoom-in) — auto-reduced via the global
 *                 prefers-reduced-motion rule in index.css
 *   - close     : ESC + backdrop click + a top-right X button
 *   - a11y      : role="dialog" aria-modal, focus trap, body-scroll lock
 *
 * The side drawer (CartDrawer) is a different geometry, so it matches the §5
 * spec by hand rather than using this centered shell.
 *
 * Layout: ModalShell owns ONLY the chrome (overlay, panel frame, close button,
 * scroll). Padding/sections are the caller's job — pass `padded` for the simple
 * `p-6` body, or omit it when the modal wants a custom header band + scroll
 * regions (SkillModal) and lay out its own padding.
 */

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { cn } from '../../utils/cn';

export type ModalMaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const MAX_WIDTH: Record<ModalMaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (used as aria-label unless labelledById set) */
  label?: string;
  /** id of an element that labels the dialog (takes precedence over `label`) */
  labelledById?: string;
  /** Max width per content (DESIGN.md: "max-w per content"). Default `lg`. */
  maxWidth?: ModalMaxWidth;
  /** When true, wraps children in the standard `p-6` body. Default true. */
  padded?: boolean;
  /** Hide the built-in top-right close button (caller renders its own). */
  hideClose?: boolean;
  /** z-index layer. Default 100. */
  zClassName?: string;
  /** Extra classes on the panel (e.g. to cap height). */
  className?: string;
  children: ReactNode;
}

export function ModalShell({
  open,
  onClose,
  label,
  labelledById,
  maxWidth = 'lg',
  padded = true,
  hideClose = false,
  zClassName = 'z-[100]',
  className,
  children,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className={cn('fixed inset-0 flex items-center justify-center p-4', zClassName)}
      role="dialog"
      aria-modal="true"
      aria-label={labelledById ? undefined : label}
      aria-labelledby={labelledById}
    >
      {/* Backdrop — token-driven, per §5 */}
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'relative w-full bg-card rounded-3xl border border-border shadow-candy-3',
          'flex flex-col max-h-[90vh] overflow-hidden animate-zoom-in',
          MAX_WIDTH[maxWidth],
          className
        )}
      >
        {!hideClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary/70 text-foreground-secondary hover:bg-secondary hover:text-foreground transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {padded ? <div className="p-6 overflow-y-auto">{children}</div> : children}
      </div>
    </div>
  );
}
