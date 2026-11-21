import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { importOsmElements, type OsmElement } from "../services/places.service.js";

// Bounding box pentru Cluj-Napoca: sud, vest, nord, est
const CLUJ_BBOX = "46.72,23.52,46.82,23.68";
const OVERPASS_URL = process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter";

const OVERPASS_QUERY = `
[out:json][timeout:25];
(
  node["leisure"="dog_park"](${CLUJ_BBOX});
  way["leisure"="dog_park"](${CLUJ_BBOX});
  node["leisure"="park"](${CLUJ_BBOX});
  way["leisure"="park"](${CLUJ_BBOX});
  node["amenity"="veterinary"](${CLUJ_BBOX});
  way["amenity"="veterinary"](${CLUJ_BBOX});
  node["shop"="pet"](${CLUJ_BBOX});
  way["shop"="pet"](${CLUJ_BBOX});
  node["amenity"="cafe"]["dog"="yes"](${CLUJ_BBOX});
  way["amenity"="cafe"]["dog"="yes"](${CLUJ_BBOX});
);
out center tags;
`.trim();

// Date fallback offline din Cluj-Napoca (folosite dacă Overpass API nu este disponibil)
export const FALLBACK_CLUJ_OSM_ELEMENTS: OsmElement[] = [
  {
    type: "way",
    id: 24100101,
    center: { lat: 46.7689, lon: 23.5784 },
    tags: {
      name: "Parcul Central Simion Bărnuțiu",
      leisure: "park",
      "addr:street": "Aleea Stadionului",
      "addr:city": "Cluj-Napoca",
      opening_hours: "00:00-24:00",
    },
  },
  {
    type: "way",
    id: 24100102,
    center: { lat: 46.7662, lon: 23.6275 },
    tags: {
      name: "Dog Park Baza Sportivă Gheorgheni",
      leisure: "dog_park",
      "addr:street": "Str. Alexandru Vaida Voevod",
      "addr:city": "Cluj-Napoca",
      opening_hours: "07:00-22:00",
    },
  },
  {
    type: "way",
    id: 24100103,
    center: { lat: 46.7634, lon: 23.5621 },
    tags: {
      name: "Parcul Rozelor",
      leisure: "park",
      "addr:street": "Str. Splaiul Independenței",
      "addr:city": "Cluj-Napoca",
      opening_hours: "00:00-24:00",
    },
  },
  {
    type: "node",
    id: 24100104,
    lat: 46.7712,
    lon: 23.5918,
    tags: {
      name: "Clinica Veterinară CentralVet Cluj",
      amenity: "veterinary",
      "addr:street": "Str. Horea",
      "addr:housenumber": "32",
      "addr:city": "Cluj-Napoca",
      phone: "+40 264 000 101",
      website: "https://example.org/centralvet-demo",
      opening_hours: "Mo-Sa 08:00-20:00",
    },
  },
  {
    type: "node",
    id: 24100105,
    lat: 46.7785,
    lon: 23.6114,
    tags: {
      name: "HappyTail Pet Shop",
      shop: "pet",
      "addr:street": "B-dul 21 Decembrie 1989",
      "addr:housenumber": "104",
      "addr:city": "Cluj-Napoca",
      phone: "+40 264 000 303",
      opening_hours: "Mo-Sa 09:00-20:00",
    },
  },
  {
    type: "node",
    id: 24100106,
    lat: 46.7538,
    lon: 23.5812,
    tags: {
      name: "Zorilor Animal Care",
      amenity: "veterinary",
      "addr:street": "Str. Observatorului",
      "addr:housenumber": "45",
      "addr:city": "Cluj-Napoca",
      phone: "+40 264 000 404",
      opening_hours: "Mo-Fr 09:00-19:00",
    },
  },
  {
    type: "way",
    id: 24100107,
    center: { lat: 46.7532, lon: 23.5529 },
    tags: {
      name: "Țarc Câini Parcul Primăverii",
      leisure: "dog_park",
      "addr:street": "Str. Primăverii",
      "addr:city": "Cluj-Napoca",
      opening_hours: "00:00-24:00",
    },
  },
];

async function fetchOsmElements(): Promise<OsmElement[]> {
  if (process.argv.includes("--offline")) {
    return FALLBACK_CLUJ_OSM_ELEMENTS;
  }

  try {
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(OVERPASS_QUERY)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API responded with status ${response.status}`);
    }

    const payload = (await response.json()) as { elements?: OsmElement[] };
    if (Array.isArray(payload.elements) && payload.elements.length > 0) {
      return payload.elements;
    }
    return FALLBACK_CLUJ_OSM_ELEMENTS;
  } catch (err) {
    console.warn("Overpass API indisponibil, folosim setul local OSM Cluj-Napoca:", err);
    return FALLBACK_CLUJ_OSM_ELEMENTS;
  }
}

async function main(): Promise<void> {
  const elements = await fetchOsmElements();
  const { imported, skipped } = await importOsmElements(elements, prisma);
  console.log(`Import OSM finalizat: ${imported} locuri importate/actualizate (${skipped} ignorate).`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
