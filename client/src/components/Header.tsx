import { Link, useLocation } from "wouter";
import logoIcon from "@assets/tc-1_1763763013990.jpg";
import logoFull from "@assets/tc-2_1763763013990.jpg";
import { MapPin, Calendar, Building2, Award } from "lucide-react";

export function Header() {
  const [location] = useLocation();

  const navItems = [
    { path: "/", label: "Map", icon: MapPin },
    { path: "/schedule", label: "Schedule", icon: Calendar },
    { path: "/locations", label: "Locations", icon: Building2 },
    { path: "/sponsors", label: "Sponsors", icon: Award },
  ];

  return (
    <header className="border-b border-border bg-background sticky top-0 z-50">
      <div className="mx-auto max-w-screen-xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" data-testid="link-home">
            <img
              src={logoIcon}
              alt="Tech SEO Connect"
              className="h-8 w-8 md:hidden"
              data-testid="img-logo-icon"
            />
            <img
              src={logoFull}
              alt="Tech SEO Connect"
              className="hidden h-10 md:block"
              data-testid="img-logo-full"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path} data-testid={`link-${item.label.toLowerCase()}`}>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors hover-elevate ${
                      isActive
                        ? "text-primary border-b-2 border-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="text-right hidden md:block">
              <div className="text-sm font-semibold text-foreground" data-testid="text-conference-name">
                Durham, NC
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-conference-dates">
                Dec 4-5, 2025
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden border-t border-border">
        <nav className="flex justify-around" data-testid="nav-mobile">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path} data-testid={`link-mobile-${item.label.toLowerCase()}`}>
                <div
                  className={`flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors hover-elevate ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
