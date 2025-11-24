import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Location } from "@shared/schema";
import { trackMapButtonClick } from "@/lib/analytics";

interface LocationCardProps {
  location: Location;
  onClick?: () => void;
}

export function LocationCard({ location, onClick }: LocationCardProps) {
  const getCategoryColor = (category: string) => {
    if (category.includes("Hotel")) return "bg-chart-2 text-white";
    if (category.includes("Lunch") || category.includes("Dinner") || category.includes("Coffee")) return "bg-primary text-primary-foreground";
    if (category.includes("Drinks")) return "bg-chart-3 text-white";
    if (category.includes("Conference")) return "bg-chart-5 text-white";
    if (category.includes("Attractions")) return "bg-chart-4 text-white";
    return "bg-muted text-muted-foreground";
  };

  const handleGoogleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMapButtonClick('google_maps', location.name, location.category);
    const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  };

  const handleAppleMapsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackMapButtonClick('apple_maps', location.name, location.category);
    const url = `https://maps.apple.com/?q=${location.name}&ll=${location.lat},${location.lng}`;
    window.open(url, '_blank');
  };

  return (
    <Card
      className="p-4 border border-card-border hover-elevate transition-all"
      data-testid={`card-location-${location.name.toLowerCase().replace(/\s+/g, '-')}`}
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
