import { sponsors } from "@/data/sponsorsData";

export default function SponsorsPage() {
  return (
    <main className="mx-auto max-w-screen-xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground" data-testid="heading-sponsors">
          Conference Sponsors
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thank you to our sponsors for making Tech SEO Connect possible.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((sponsor) => (
          <div
            key={sponsor.name}
            className="flex items-center justify-center rounded-md border border-border bg-card p-8 hover-elevate"
            data-testid={`card-sponsor-${sponsor.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <img
              src={sponsor.logo}
              alt={sponsor.name}
              className="max-h-32 max-w-full object-contain"
              data-testid={`img-sponsor-${sponsor.name.toLowerCase().replace(/\s+/g, "-")}`}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
