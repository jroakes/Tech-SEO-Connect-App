import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { Location } from "@shared/schema";

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

  return (
    <Card
      className="p-4 border border-card-border hover-elevate transition-all cursor-pointer"
      onClick={onClick}
      data-testid={`card-location-${location.name.toLowerCase().replace(/\s+/g, '-')}`}
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
        <p className="text-sm text-muted-foreground line-clamp-3 font-serif leading-relaxed mb-3" data-testid="text-narrative">
          {location.narrative}
        </p>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="text-coordinates">
        <MapPin className="h-3 w-3" />
        <span>{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
      </div>
    </Card>
  );
}
