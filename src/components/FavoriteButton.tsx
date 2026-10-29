import { useState } from "react";
import { Heart } from "lucide-react";

interface FavoriteButtonProps {
  saved: boolean;
  /** Toggles the save and returns whether the item is now saved. */
  onToggle: () => boolean;
  /** The item's name, for screen readers. */
  label: string;
  testId?: string;
  className?: string;
}

/** The heart that saves a talk or place to My Conference. */
export function FavoriteButton({ saved, onToggle, label, testId, className = "" }: FavoriteButtonProps) {
  const [rising, setRising] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle()) {
      setRising(true);
      setTimeout(() => setRising(false), 600);
    }
  };

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md transition-all hover:bg-muted cursor-pointer"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${label} from My Conference` : `Save ${label} to My Conference`}
        data-testid={testId}
      >
        <Heart className={`h-5 w-5 transition-colors ${saved ? "fill-pink-500 text-pink-500" : "text-muted-foreground hover:text-pink-400"}`} />
      </button>

      {rising && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart className="h-5 w-5 fill-pink-500 text-pink-500 animate-heart-rise" />
        </div>
      )}
    </div>
  );
}
