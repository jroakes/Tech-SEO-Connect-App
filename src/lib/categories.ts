// Colors for place categories, shared by the map markers, badges and filters.

type CategoryKind = "hotel" | "food" | "drinks" | "conference" | "attractions" | "other";

function kindOf(category: string): CategoryKind {
  if (category.includes("Hotel")) return "hotel";
  if (category.includes("Lunch") || category.includes("Dinner") || category.includes("Coffee")) return "food";
  if (category.includes("Drinks")) return "drinks";
  if (category.includes("Conference")) return "conference";
  if (category.includes("Attractions") || category.includes("Things to do")) return "attractions";
  return "other";
}

const badgeClasses: Record<CategoryKind, string> = {
  hotel: "bg-chart-2 text-white",
  food: "bg-primary text-primary-foreground",
  drinks: "bg-chart-3 text-white",
  conference: "bg-chart-5 text-white",
  attractions: "bg-chart-4 text-white",
  other: "bg-muted text-muted-foreground",
};

export function getCategoryColor(category: string): string {
  return badgeClasses[kindOf(category)];
}

export function getCategoryKind(category: string): CategoryKind {
  return kindOf(category);
}
