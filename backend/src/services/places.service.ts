import type { PlaceSource, PlaceType, Prisma } from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/http-error.js";

const reviewAuthorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

export const placeSelect = {
  id: true,
  name: true,
  latitude: true,
  longitude: true,
  address: true,
  phone: true,
  website: true,
  openingHours: true,
  type: true,
  source: true,
  osmId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const placeDetailSelect = {
  ...placeSelect,
  reviews: {
    select: {
      id: true,
      userId: true,
      placeId: true,
      eventId: true,
      rating: true,
      tags: true,
      createdAt: true,
      user: {
        select: reviewAuthorSelect,
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
} as const;

export interface ListPlacesQuery {
  type?: PlaceType;
  q?: string;
}

export interface CreatePlaceReviewInput {
  eventId: string;
  rating: number;
  tags: string[];
}

export interface PlaceSummaryView {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  type: PlaceType;
  source: PlaceSource;
  osmId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewCount: number;
  averageRating: number | null;
}

export interface PlaceReviewView {
  id: string;
  userId: string;
  placeId: string;
  eventId: string;
  rating: number;
  tags: string[];
  createdAt: Date;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

export interface PlaceDetailView extends PlaceSummaryView {
  reviews: PlaceReviewView[];
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string | undefined>;
}

export interface ParsedOsmPlace {
  osmId: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  type: PlaceType;
  source: PlaceSource;
}

function computeRatingStats(ratings: { rating: number }[]): {
  reviewCount: number;
  averageRating: number | null;
} {
  if (ratings.length === 0) {
    return { reviewCount: 0, averageRating: null };
  }
  const sum = ratings.reduce((acc, item) => acc + item.rating, 0);
  const averageRating = Math.round((sum / ratings.length) * 100) / 100;
  return {
    reviewCount: ratings.length,
    averageRating,
  };
}

export async function listPlaces(
  query: ListPlacesQuery = {},
  db: DbClient = prisma,
): Promise<PlaceSummaryView[]> {
  const trimmedQ = query.q?.trim();
  const where: Prisma.PlaceWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(trimmedQ
      ? {
          OR: [
            { name: { contains: trimmedQ, mode: "insensitive" } },
            { address: { contains: trimmedQ, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const places = await db.place.findMany({
    where,
    select: {
      ...placeSelect,
      reviews: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return places.map(({ reviews, ...place }) => ({
    ...place,
    ...computeRatingStats(reviews),
  }));
}

export async function getPlaceById(
  placeId: string,
  db: DbClient = prisma,
): Promise<PlaceDetailView> {
  const place = await db.place.findUnique({
    where: { id: placeId },
    select: placeDetailSelect,
  });

  if (!place) {
    throw notFound("Place not found");
  }

  const { reviews, ...basePlace } = place;
  return {
    ...basePlace,
    ...computeRatingStats(reviews),
    reviews,
  };
}

export async function createPlaceReview(
  viewerId: string,
  placeId: string,
  input: CreatePlaceReviewInput,
  db: DbClient = prisma,
): Promise<PlaceReviewView> {
  const place = await db.place.findUnique({
    where: { id: placeId },
    select: { id: true },
  });
  if (!place) {
    throw notFound("Place not found");
  }

  const event = await db.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      placeId: true,
      organizerId: true,
      status: true,
    },
  });
  if (!event) {
    throw notFound("Event not found");
  }
  if (event.placeId !== placeId) {
    throw badRequest("The specified event did not take place at this location");
  }
  if (event.status === "CANCELLED") {
    throw badRequest("Cannot review a location for a cancelled event");
  }

  const isOrganizer = event.organizerId === viewerId;
  const goingParticipation = isOrganizer
    ? null
    : await db.eventParticipant.findFirst({
        where: {
          eventId: input.eventId,
          userId: viewerId,
          status: "GOING",
        },
        select: { id: true },
      });

  if (!isOrganizer && !goingParticipation) {
    throw forbidden("You can only review a place after participating in an event there");
  }

  const existingReview = await db.placeReview.findUnique({
    where: {
      userId_eventId: {
        userId: viewerId,
        eventId: input.eventId,
      },
    },
    select: { id: true },
  });

  if (existingReview) {
    throw conflict("You have already reviewed this place for this event");
  }

  const normalizedTags = [...new Set(input.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];

  const created = await db.placeReview.create({
    data: {
      userId: viewerId,
      placeId,
      eventId: input.eventId,
      rating: input.rating,
      tags: normalizedTags,
    },
    select: {
      id: true,
      userId: true,
      placeId: true,
      eventId: true,
      rating: true,
      tags: true,
      createdAt: true,
      user: {
        select: reviewAuthorSelect,
      },
    },
  });

  return created;
}

/**
 * Convertește un element Overpass/OpenStreetMap într-un obiect pregătit pentru tabelul `Place`.
 * Returnează `null` dacă elementul nu are nume, coordonate sau categorie recunoscută.
 */
export function parseOsmElement(element: OsmElement): ParsedOsmPlace | null {
  const tags = element.tags ?? {};
  const name = tags.name?.trim();
  if (!name) {
    return null;
  }

  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  let type: PlaceType | null = null;
  if (tags.leisure === "dog_park") {
    type = "DOG_PARK";
  } else if (tags.leisure === "park") {
    type = "PARK";
  } else if (tags.amenity === "veterinary") {
    type = "VET";
  } else if (tags.shop === "pet") {
    type = "PET_SHOP";
  } else if (tags.amenity === "cafe" && (tags.dog === "yes" || tags.pets === "yes")) {
    type = "CAFE";
  }

  if (!type) {
    return null;
  }

  const street = tags["addr:street"]?.trim();
  const houseNumber = tags["addr:housenumber"]?.trim();
  const city = tags["addr:city"]?.trim();
  const addressParts = [
    street && houseNumber ? `${street} nr. ${houseNumber}` : street,
    city,
  ].filter((part): part is string => Boolean(part));

  const address = addressParts.length > 0 ? addressParts.join(", ") : null;
  const phone = (tags.phone ?? tags["contact:phone"])?.trim() || null;
  const website = (tags.website ?? tags["contact:website"])?.trim() || null;
  const openingHours = tags.opening_hours?.trim() || null;

  return {
    osmId: `${element.type}/${element.id}`,
    name,
    latitude,
    longitude,
    address,
    phone,
    website,
    openingHours,
    type,
    source: "OSM",
  };
}

/**
 * Importă și deduplică locuri din OpenStreetMap pe baza câmpului unic `osmId`.
 */
export async function importOsmElements(
  elements: OsmElement[],
  db: DbClient = prisma,
): Promise<{ imported: number; skipped: number }> {
  const seenOsmIds = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const element of elements) {
    const parsed = parseOsmElement(element);
    if (!parsed || seenOsmIds.has(parsed.osmId)) {
      skipped += 1;
      continue;
    }
    seenOsmIds.add(parsed.osmId);

    const { osmId, ...data } = parsed;
    await db.place.upsert({
      where: { osmId },
      update: data,
      create: parsed,
    });
    imported += 1;
  }

  return { imported, skipped };
}
