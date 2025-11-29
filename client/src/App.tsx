import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "./components/Header";
import { SplashScreen } from "./components/SplashScreen";
import MapPage from "./pages/MapPage";
import SchedulePage from "./pages/SchedulePage";
import LocationsPage from "./pages/LocationsPage";
import SponsorsPage from "./pages/SponsorsPage";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import type { Location } from "@shared/schema";
import { parseKML } from "./lib/kmlParser";
import narrativesData from "@assets/durham-locations-narratives_1763765760597.json";

function RedirectToSchedule() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/schedule');
  }, [setLocation]);

  return null;
}

function Router() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const response = await fetch("/api/kml-data");
        const kmlText = await response.text();
        const parsedLocations = parseKML(kmlText);
        
        const narratives = narrativesData as Record<string, string>;
        const locationsWithNarratives = parsedLocations.map(loc => ({
          ...loc,
          narrative: narratives[loc.name] || undefined,
        }));

        setLocations(locationsWithNarratives);
      } catch (error) {
        console.error("Error loading location data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLocations();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading conference data...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/schedule">
        <SchedulePage />
      </Route>
      <Route path="/map">
        <MapPage locations={locations} />
      </Route>
      <Route path="/locations">
        <LocationsPage locations={locations} />
      </Route>
      <Route path="/sponsors">
        <SponsorsPage />
      </Route>
      <Route path="/" component={RedirectToSchedule} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [, setLocation] = useLocation();

  const handleSplashComplete = () => {
    setShowSplash(false);
    setLocation('/schedule');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showSplash && <SplashScreen onAnimationComplete={handleSplashComplete} />}
        <div className="min-h-screen bg-background">
          <Header />
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
