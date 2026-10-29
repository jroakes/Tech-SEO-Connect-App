import { List, Map } from "lucide-react";

interface PlacesHeaderProps {
  current: "map" | "list";
  /** Controls on the right, like the map's category filter. */
  children?: React.ReactNode;
}

const TABS = [
  { id: "map", label: "Map", href: "/map", icon: Map },
  { id: "list", label: "List", href: "/locations", icon: List },
] as const;

/** The bar above the map and the list: the title and a Map / List switch. */
export function PlacesHeader({ current, children }: PlacesHeaderProps) {
  return (
    <div className="border-b border-border bg-card p-4">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="hidden text-xl font-semibold text-foreground sm:block" data-testid="text-page-title">
            Places
          </h1>
          <nav className="inline-flex rounded-md bg-muted p-1" aria-label="Places view">
            {TABS.map(({ id, label, href, icon: Icon }) => (
              <a
                key={id}
                href={href}
                className={`flex min-h-9 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors ${
                  id === current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-current={id === current ? "page" : undefined}
                data-testid={`tab-places-${id}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </a>
            ))}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
