import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../utils/cn';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  count?: number;
}

const sizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showValue = false,
  count,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={cn(
              'transition-colors duration-150',
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'
            )}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onMouseLeave={() => !readonly && setHoverValue(0)}
          >
            <Star
              className={cn(
                sizes[size],
                star <= displayValue
                  ? 'fill-warning text-warning'
                  : 'text-foreground-muted'
              )}
            />
          </button>
        ))}
      </div>
      {showValue && (
        <span className="text-sm text-foreground-secondary ml-1">
          {value > 0 ? value.toFixed(1) : '—'}
          {count !== undefined && <span className="text-foreground-tertiary"> ({count})</span>}
        </span>
      )}
    </div>
  );
}
