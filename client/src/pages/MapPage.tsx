import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Location } from "@shared/schema";
import L from "leaflet";
import { ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface MapPageProps {
  locations: Location[];
}

const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const getCategoryIcon = (category: string) => {
  if (category.includes("Hotel")) return createCustomIcon("#6A8EC4");
  if (category.includes("Lunch") || category.includes("Dinner") || category.includes("Coffee")) return createCustomIcon("#0DB47C");
  if (category.includes("Drinks")) return createCustomIcon("#836152");
  if (category.includes("Conference")) return createCustomIcon("#3C4639");
  if (category.includes("Attractions")) return createCustomIcon("#689581");
  return createCustomIcon("#999");
};

export default function MapPage({ locations }: MapPageProps) {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [expandedNarratives, setExpandedNarratives] = useState<Set<number>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    locations.forEach(loc => cats.add(loc.category));
    return Array.from(cats).sort();
  }, [locations]);

  useEffect(() => {
    setSelectedCategories(new Set(categories));
  }, [categories]);

  const toggleCategory = (category: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(category)) {
      newSelected.delete(category);
    } else {
      newSelected.add(category);
    }
    setSelectedCategories(newSelected);
  };

  const selectAll = () => setSelectedCategories(new Set(categories));
  const clearAll = () => setSelectedCategories(new Set());
  
  const toggleNarrative = (idx: number) => {
    const newExpanded = new Set(expandedNarratives);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedNarratives(newExpanded);
  };

  const filteredLocations = useMemo(() => {
    return locations.filter(loc => selectedCategories.has(loc.category));
  }, [locations, selectedCategories]);

  const center: [number, number] = [35.9940, -78.8986];

  const getCategoryColor = (category: string) => {
    if (category.includes("Hotel")) return "bg-chart-2 text-white border-chart-2";
    if (category.includes("Lunch") || category.includes("Dinner") || category.includes("Coffee")) return "bg-primary text-primary-foreground border-primary";
    if (category.includes("Drinks")) return "bg-chart-3 text-white border-chart-3";
    if (category.includes("Conference")) return "bg-chart-5 text-white border-chart-5";
    if (category.includes("Attractions")) return "bg-chart-4 text-white border-chart-4";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-3.5rem)]">
      <div className="p-4 border-b border-border bg-card">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-map-title">Durham Locations</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={selectAll} data-testid="button-select-all">
                All
              </Button>
              <Button size="sm" variant="outline" onClick={clearAll} data-testid="button-clear-all">
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategories.has(category) ? "default" : "outline"}
                size="sm"
                className={`min-h-9 ${
                  selectedCategories.has(category)
                    ? getCategoryColor(category)
                    : ""
                }`}
                onClick={() => toggleCategory(category)}
                data-testid={`button-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category} ({locations.filter(l => l.category === category).length})
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative" data-testid="map-container">
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredLocations.map((location, idx) => (
            <Marker
              key={idx}
              position={[location.lat, location.lng]}
              icon={getCategoryIcon(location.category)}
            >
              <Popup maxWidth={320} minWidth={250}>
                <div className="p-2">
                  <h3 className="font-semibold text-sm mb-2" data-testid={`popup-title-${idx}`}>{location.name}</h3>
                  <Badge className={`${getCategoryColor(location.category)} text-xs mb-3`}>
                    {location.category}
                  </Badge>
                  {location.narrative && (
                    <div className="mb-3">
                      <p 
                        className={`text-xs text-muted-foreground font-serif leading-relaxed cursor-pointer hover:text-foreground transition-colors ${
                          expandedNarratives.has(idx) ? '' : 'line-clamp-3'
                        }`}
                        onClick={() => toggleNarrative(idx)}
                        data-testid={`popup-narrative-${idx}`}
                      >
                        {location.narrative}
                      </p>
                      <button
                        onClick={() => toggleNarrative(idx)}
                        className="text-xs text-primary hover:underline mt-1"
                        data-testid={`button-toggle-narrative-${idx}`}
                      >
                        {expandedNarratives.has(idx) ? 'Show less' : 'Read more'}
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 justify-center gap-1.5"
                      onClick={() => {
                        const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid={`button-google-maps-${idx}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Google Maps
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 justify-center gap-1.5"
                      onClick={() => {
                        const url = `https://maps.apple.com/?q=${location.name}&ll=${location.lat},${location.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid={`button-apple-maps-${idx}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Apple Maps
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
