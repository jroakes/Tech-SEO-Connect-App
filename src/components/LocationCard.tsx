import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Place } from "@/lib/types";
import { openDirections, trackMapButtonClick } from "@/lib/analytics";
import { getCategoryColor } from "@/lib/categories";

interface LocationCardProps {
  location: Place;
  onClick?: () => void;
}

export function LocationCard({ location, onClick }: LocationCardProps) {
  const handleGoogleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMapButtonClick("google_maps", location, "list");
    openDirections("google_maps", location);
  };

  const handleAppleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMapButtonClick("apple_maps", location, "list");
    openDirections("apple_maps", location);
  };

  return (
    <Card
      className="p-4 border border-card-border hover-elevate transition-all"
      data-testid={`card-location-${location.id}`}
    >
      <div 
        className="cursor-pointer mb-3"
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-foreground leading-tight" data-testid="text-location-name">
            {location.name}
          </h3>
          <Badge
            className={`${getCategoryColor(location.category)} text-xs shrink-0`}
            data-testid="badge-category"
          >
            {location.category}
          </Badge>
        </div>

        {location.narrative && (
          <p className="text-sm text-muted-foreground line-clamp-3 font-serif leading-relaxed" data-testid="text-narrative">
            {location.narrative}
          </p>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-border">
        <Button
          variant="outline"
          className="flex-1 justify-center gap-1.5 min-h-11"
          onClick={handleGoogleMapsClick}
          data-testid="button-google-maps"
        >
          <ExternalLink className="h-4 w-4" />
          Google Maps
        </Button>
        <Button
          variant="outline"
          className="flex-1 justify-center gap-1.5 min-h-11"
          onClick={handleAppleMapsClick}
          data-testid="button-apple-maps"
        >
          <ExternalLink className="h-4 w-4" />
          Apple Maps
        </Button>
      </div>
    </Card>
  );
}
