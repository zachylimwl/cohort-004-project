import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

const STARS = [1, 2, 3, 4, 5];

/**
 * Read-only display of an average rating: 5 stars with fractional fill,
 * followed by the numeric average and the rating count.
 * Renders a muted "No ratings yet" when there are no ratings.
 */
export function StarRating({
  average,
  count,
  size = "sm",
  className,
}: {
  average: number;
  count: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const starSize = size === "md" ? "size-5" : "size-4";
  const textSize = size === "md" ? "text-sm" : "text-xs";

  if (count === 0) {
    return (
      <span className={cn("text-muted-foreground", textSize, className)}>
        No ratings yet
      </span>
    );
  }

  const fillPercent = (average / 5) * 100;

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className="relative inline-flex">
        {/* Empty stars (background) */}
        <span className="flex">
          {STARS.map((star) => (
            <Star
              key={star}
              className={cn(starSize, "text-muted-foreground/40")}
            />
          ))}
        </span>
        {/* Filled stars, clipped to the average */}
        <span
          className="absolute inset-0 flex overflow-hidden"
          style={{ width: `${fillPercent}%` }}
        >
          {STARS.map((star) => (
            <Star
              key={star}
              className={cn(starSize, "shrink-0 fill-yellow-400 text-yellow-400")}
            />
          ))}
        </span>
      </span>
      <span className={cn("font-medium text-foreground", textSize)}>
        {average.toFixed(1)}
      </span>
      <span className={cn("text-muted-foreground", textSize)}>({count})</span>
    </span>
  );
}

/**
 * Interactive 1–5 star picker. Calls onRate with the chosen value.
 * Highlights stars on hover; `value` reflects the current/submitted rating.
 */
export function StarRatingInput({
  value,
  onRate,
  disabled = false,
  className,
}: {
  value: number;
  onRate: (rating: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onRate(star)}
          onMouseEnter={() => setHovered(star)}
          aria-label={`Rate ${star} ${star === 1 ? "star" : "stars"}`}
          className="rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Star
            className={cn(
              "size-7",
              star <= active
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}
