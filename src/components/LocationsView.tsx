import { useState, useMemo } from "react";
import { LocationCard } from "../components/LocationCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink } from "lucide-react";
import type { Place } from "@/lib/types";
import { openDirections, trackMapButtonClick, trackPlaceSave, trackPlaceView } from "@/lib/analytics";
import { useSaved } from "@/lib/saved";
import { FavoriteButton } from "./FavoriteButton";
import { PlacesHeader } from "./PlacesHeader";
import { getCategoryColor } from "@/lib/categories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LocationsViewProps {
  places: Place[];
}

export default function LocationsView({ places: locations }: LocationsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(null);
  const { saved, toggle } = useSaved("place");

  const toggleSave = (place: Place) => {
    const nowSaved = toggle(place.id);
    trackPlaceSave(place, nowSaved);
    return nowSaved;
  };

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

  const openPlace = (place: Place) => {
    setSelectedLocation(place);
    trackPlaceView(place, "list");
  };

  return (
    <div className="min-h-screen bg-background">
      <PlacesHeader current="list" />
      <div className="mx-auto max-w-screen-xl px-4 py-6">
        <div className="mb-6">
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
            {filteredLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                onClick={() => openPlace(location)}
                saved={saved.has(location.id)}
                onToggleSave={() => toggleSave(location)}
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
                <div className="flex items-center justify-between gap-2">
                  <Badge className={getCategoryColor(selectedLocation.category)} data-testid="badge-dialog-category">
                    {selectedLocation.category}
                  </Badge>
                  <FavoriteButton
                    saved={saved.has(selectedLocation.id)}
                    onToggle={() => toggleSave(selectedLocation)}
                    label={selectedLocation.name}
                    testId="button-save-place-dialog"
                    className="-my-2"
                  />
                </div>

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
                        trackMapButtonClick("google_maps", selectedLocation, "detail");
                        openDirections("google_maps", selectedLocation);
                      }}
                      data-testid="button-dialog-google-maps"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 min-h-11"
                      onClick={() => {
                        trackMapButtonClick("apple_maps", selectedLocation, "detail");
                        openDirections("apple_maps", selectedLocation);
                      }}
                      data-testid="button-dialog-apple-maps"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Apple Maps
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
