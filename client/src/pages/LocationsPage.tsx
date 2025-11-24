import { useState, useMemo } from "react";
import { LocationCard } from "../components/LocationCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink } from "lucide-react";
import type { Location } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocationsPageProps {
  locations: Location[];
}

export default function LocationsPage({ locations }: LocationsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    locations.forEach(loc => cats.add(loc.category));
    return Array.from(cats).sort();
  }, [locations]);

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.narrative?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = !selectedCategory || loc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchQuery, selectedCategory]);

  const getCategoryColor = (category: string) => {
    if (category.includes("Hotel")) return "bg-chart-2 text-white";
    if (category.includes("Lunch") || category.includes("Dinner") || category.includes("Coffee")) return "bg-primary text-primary-foreground";
    if (category.includes("Drinks")) return "bg-chart-3 text-white";
    if (category.includes("Conference")) return "bg-chart-5 text-white";
    if (category.includes("Attractions")) return "bg-chart-4 text-white";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-screen-xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4" data-testid="text-page-title">
            Durham Locations
          </h1>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              className="min-h-11"
              onClick={() => setSelectedCategory(null)}
              data-testid="button-category-all"
            >
              All ({locations.length})
            </Button>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`min-h-11 ${
                  selectedCategory === category
                    ? getCategoryColor(category)
                    : ""
                }`}
                onClick={() => setSelectedCategory(category)}
                data-testid={`button-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category} ({locations.filter(l => l.category === category).length})
              </Button>
            ))}
          </div>
        </div>

        {filteredLocations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground" data-testid="text-no-results">
              No locations found matching your search.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-locations">
            {filteredLocations.map((location, idx) => (
              <LocationCard
                key={idx}
                location={location}
                onClick={() => setSelectedLocation(location)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedLocation} onOpenChange={() => setSelectedLocation(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-location-detail">
          {selectedLocation && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold pr-8" data-testid="text-dialog-title">
                  {selectedLocation.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Badge className={getCategoryColor(selectedLocation.category)} data-testid="badge-dialog-category">
                  {selectedLocation.category}
                </Badge>

                {selectedLocation.narrative && (
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm text-foreground font-serif leading-relaxed" data-testid="text-dialog-narrative">
                      {selectedLocation.narrative}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 min-h-11"
                      onClick={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${selectedLocation.lat},${selectedLocation.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid="button-dialog-google-maps"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 min-h-11"
                      onClick={() => {
                        const url = `https://maps.apple.com/?q=${selectedLocation.name}&ll=${selectedLocation.lat},${selectedLocation.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid="button-dialog-apple-maps"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Apple Maps
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
