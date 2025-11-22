import type { Location } from "@shared/schema";

export function parseKML(kmlText: string): Location[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, "text/xml");
  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  const locations: Location[] = [];

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = placemark.getElementsByTagName("name")[0]?.textContent || "";
    const coordinates = placemark.getElementsByTagName("coordinates")[0]?.textContent || "";
   
    const folder = placemark.parentElement;
    let category = "Other";
    if (folder && folder.tagName === "Folder") {
      const folderName = folder.getElementsByTagName("name")[0]?.textContent || "";
      category = folderName;
    }

    const coords = coordinates.trim().split(",");
    if (coords.length >= 2) {
      const lng = parseFloat(coords[0]);
      const lat = parseFloat(coords[1]);

      if (!isNaN(lat) && !isNaN(lng)) {
        locations.push({
          name,
          category,
          lat,
          lng,
        });
      }
    }
  }

  return locations;
}
