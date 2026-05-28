import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 btn-press',
  {
    variants: {
      variant: {
        // Primary CTA — Duolingo-style pressable candy button (DESIGN.md §5).
        // `default` and `candy` share the same physical press so every primary
        // action across the app feels consistent.
        default: 'candy-btn',
        candy: 'candy-btn',
        // Secondary — neutral card surface that lifts on hover.
        secondary: 'bg-card border border-border text-foreground hover:border-border-hover hover:shadow-candy-1',
        outline: 'border border-border bg-transparent hover:bg-secondary hover:border-border-hover text-foreground',
        ghost: 'hover:bg-secondary text-foreground-secondary hover:text-foreground font-medium',
        destructive: 'bg-error text-error-foreground hover:bg-error/90 shadow-sm',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto font-medium',
      },
      size: {
        sm: 'h-8 px-3.5 text-xs rounded-xl',
        md: 'h-10 px-4 text-sm rounded-2xl',
        lg: 'h-12 px-6 text-base rounded-2xl',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
export type { ButtonProps };
