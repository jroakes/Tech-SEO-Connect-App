import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Location } from "@shared/schema";
import L from "leaflet";
import { ExternalLink } from "lucide-react";
import { trackMapButtonClick } from "@/lib/analytics";
import "leaflet/dist/leaflet.css";

interface MapPageProps {
  locations: Location[];
}

const createCustomIcon = (color: string, iconSvg: string, size: number = 32) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">${iconSvg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const VENUE_NAME = "The Fruit -Conference Venue";

const createVenueIcon = () => {
  return createCustomIcon(
    "#D4AF37",
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    44
  );
};

const getCategoryIcon = (category: string) => {
  if (category.includes("Hotel")) {
    return createCustomIcon("#6A8EC4", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/><path d="M12 18h.01"/></svg>');
  }
  if (category.includes("Lunch") || category.includes("Dinner")) {
    return createCustomIcon("#0DB47C", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>');
  }
  if (category.includes("Coffee")) {
    return createCustomIcon("#0DB47C", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>');
  }
  if (category.includes("Drinks")) {
    return createCustomIcon("#836152", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>');
  }
  if (category.includes("Conference")) {
    return createCustomIcon("#3C4639", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>');
  }
  if (category.includes("Attractions")) {
    return createCustomIcon("#689581", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>');
  }
  return createCustomIcon("#999", '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>');
};

export default function MapPage({ locations }: MapPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expandedNarratives, setExpandedNarratives] = useState<Set<number>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    locations.forEach(loc => cats.add(loc.category));
    return Array.from(cats).sort();
  }, [locations]);
  
  const toggleNarrative = (idx: number) => {
    const newExpanded = new Set(expandedNarratives);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedNarratives(newExpanded);
  };

  const venueLocation = useMemo(() => {
    return locations.find(loc => loc.name === VENUE_NAME);
  }, [locations]);

  const filteredLocations = useMemo(() => {
    if (selectedCategory === "all") return locations;
    const filtered = locations.filter(loc => loc.category === selectedCategory);
    if (venueLocation && !filtered.some(loc => loc.name === VENUE_NAME)) {
      return [...filtered, venueLocation];
    }
    return filtered;
  }, [locations, selectedCategory, venueLocation]);

  const getLocationIcon = (location: Location) => {
    if (location.name === VENUE_NAME) {
      return createVenueIcon();
    }
    return getCategoryIcon(location.category);
  };

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
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-map-title">Durham Locations</h2>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[240px] min-h-11" data-testid="select-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="all" data-testid="select-option-all">All Categories ({locations.length})</SelectItem>
                {categories.map(category => (
                  <SelectItem 
                    key={category} 
                    value={category}
                    data-testid={`select-option-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category} ({locations.filter(l => l.category === category).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {filteredLocations.map((location, idx) => (
            <Marker
              key={idx}
              position={[location.lat, location.lng]}
              icon={getLocationIcon(location)}
              zIndexOffset={location.name === VENUE_NAME ? 1000 : 0}
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
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 min-h-11"
                      onClick={() => {
                        trackMapButtonClick('google_maps', location.name, location.category);
                        const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid={`button-google-maps-${idx}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Google Maps
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 justify-center gap-1.5 min-h-11"
                      onClick={() => {
                        trackMapButtonClick('apple_maps', location.name, location.category);
                        const url = `https://maps.apple.com/?q=${location.name}&ll=${location.lat},${location.lng}`;
                        window.open(url, '_blank');
                      }}
                      data-testid={`button-apple-maps-${idx}`}
                    >
                      <ExternalLink className="h-4 w-4" />
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
