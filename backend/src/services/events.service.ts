import type {
  EventStatus,
  EventType,
  Prisma,
  RsvpStatus,
  Visibility,
} from "../generated/prisma/client.js";
import { prisma, type DbClient } from "../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/http-error.js";
import { getBlockedUserIds, isBlockedEitherWay } from "./block.service.js";

export type EventsTab = "PUBLIC" | "ORGANIZED" | "INVITATIONS" | "ALL";
export type ActiveRsvpStatus = Exclude<RsvpStatus, "INVITED">;
export type InvitationResponseStatus = "ACCEPTED" | "DECLINED";
export type InvitationViewStatus = "PENDING" | "ACCEPTED";

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  bio: true,
  approxLatitude: true,
  approxLongitude: true,
} as const;

const placeSelect = {
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
} as const;

const breedSelect = {
  id: true,
  name: true,
  size: true,
  careTips: true,
  heatSensitive: true,
  breathingIssues: true,
  energyLevel: true,
} as const;

const eventInclude = {
  organizer: {
    select: publicUserSelect,
  },
  place: {
    select: placeSelect,
  },
  participants: {
    include: {
      user: {
        select: publicUserSelect,
      },
      dog: {
        include: {
          breed: {
            select: breedSelect,
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} as const;

export interface CreateEventInput {
  title: string;
  description?: string | null;
  type: EventType;
  visibility: Visibility;
  startsAt: Date;
  endsAt: Date;
  maxParticipants?: number | null;
  placeId?: string | null;
  locationText?: string | null;
  invitedUserIds?: string[];
  organizerGoingDogIds?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  type?: EventType;
  startsAt?: Date;
  endsAt?: Date;
  maxParticipants?: number | null;
  placeId?: string | null;
  locationText?: string | null;
}

export interface InviteUsersInput {
  userIds: string[];
}

export interface RespondToInvitationInput {
  status: InvitationResponseStatus;
  goingDogIds?: string[];
}

export interface UpsertDogRsvpInput {
  dogId: string;
  status: ActiveRsvpStatus;
}

export interface EventInvitationSummary {
  eventId: string;
  userId: string;
  invitedByUserId: string | null;
  status: InvitationViewStatus;
  dogIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EventInvitationDetail {
  invitation: EventInvitationSummary;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    approxLatitude: number;
    approxLongitude: number;
  };
  invitedBy: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    approxLatitude: number;
    approxLongitude: number;
  } | null;
}

export interface EventDogRsvpView {
  id: string;
  eventId: string;
  userId: string;
  dogId: string;
  status: RsvpStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipantDetail {
  rsvp: EventDogRsvpView;
  dog: {
    id: string;
    ownerId: string;
    breedId: string;
    name: string;
    birthDate: Date | null;
    sex: string;
    size: string;
    temperament: string;
    neutered: boolean;
    photoUrl: string | null;
  };
  breed: {
    id: string;
    name: string;
    size: string;
    careTips: string;
    heatSensitive: boolean;
    breathingIssues: boolean;
    energyLevel: number;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    bio: string | null;
    approxLatitude: number;
    approxLongitude: number;
  };
}

export interface EventView {
  id: string;
  organizerId: string | null;
  placeId: string | null;
  locationText: string | null;
  title: string;
  description: string | null;
  type: EventType;
  visibility: Visibility;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  maxParticipants: number | null;
  createdAt: Date;
  updatedAt: Date;
  organizer: EventParticipantDetail["owner"] | null;
  place: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
    phone: string | null;
    website: string | null;
    openingHours: string | null;
    type: string;
    source: string;
  } | null;
  invitations: EventInvitationDetail[];
  participants: EventParticipantDetail[];
  goingDogsCount: number;
  isFull: boolean;
  isOrganizer: boolean;
  currentUserInvitation: EventInvitationSummary | null;
  currentUserDogRsvps: EventDogRsvpView[];
}

type RawEventWithRelations = {
  id: string;
  organizerId: string | null;
  placeId: string | null;
  locationText: string | null;
  title: string;
  description: string | null;
  type: EventType;
  visibility: Visibility;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  maxParticipants: number | null;
  createdAt: Date;
  updatedAt: Date;
  organizer: EventView["organizer"];
  place: EventView["place"];
  participants: {
    id: string;
    eventId: string;
    userId: string;
    dogId: string;
    status: RsvpStatus;
    createdAt: Date;
    updatedAt: Date;
    user: EventParticipantDetail["owner"];
    dog: EventParticipantDetail["dog"] & {
      breed: EventParticipantDetail["breed"];
    };
  }[];
};

async function runInTransaction<T>(
  db: DbClient,
  fn: (tx: DbClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in db && typeof db.$transaction === "function") {
    return db.$transaction((tx) => fn(tx));
  }
  return fn(db);
}

function canViewerAccessRawEvent(
  event: RawEventWithRelations,
  viewerId: string,
  blockedSet: Set<string>,
): boolean {
  if (event.organizerId && event.organizerId !== viewerId && blockedSet.has(event.organizerId)) {
    return false;
  }
  if (event.visibility === "PUBLIC") {
    return true;
  }
  if (event.organizerId === viewerId) {
    return true;
  }
  return event.participants.some((p) => p.userId === viewerId);
}

function toEventView(
  raw: RawEventWithRelations,
  viewerId: string,
  blockedSet: Set<string>,
): EventView {
  const visibleRows = raw.participants.filter((p) => !blockedSet.has(p.userId));

  // Participanții activi (câini marcați GOING / MAYBE / NOT_GOING)
  const activeParticipantRows = visibleRows.filter((p) => p.status !== "INVITED");
  const participants: EventParticipantDetail[] = activeParticipantRows.map((row) => {
    const { breed, ...dogFields } = row.dog;
    return {
      rsvp: {
        id: row.id,
        eventId: row.eventId,
        userId: row.userId,
        dogId: row.dogId,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      dog: dogFields,
      breed,
      owner: row.user,
    };
  });

  // Invitațiile (pentru evenimente PRIVATE sau orice rând cu status INVITED)
  const invitationsByUser = new Map<
    string,
    {
      rows: typeof visibleRows;
      user: EventParticipantDetail["owner"];
    }
  >();

  for (const row of visibleRows) {
    if (row.userId === raw.organizerId) {
      continue;
    }
    if (raw.visibility === "PRIVATE" || row.status === "INVITED") {
      const existing = invitationsByUser.get(row.userId);
      if (existing) {
        existing.rows.push(row);
      } else {
        invitationsByUser.set(row.userId, { rows: [row], user: row.user });
      }
    }
  }

  const invitations: EventInvitationDetail[] = [];
  for (const [userId, group] of invitationsByUser.entries()) {
    const hasPendingRow = group.rows.some((r) => r.status === "INVITED");
    const status: InvitationViewStatus = hasPendingRow ? "PENDING" : "ACCEPTED";
    const createdAt = group.rows.reduce(
      (min, r) => (r.createdAt < min ? r.createdAt : min),
      group.rows[0]!.createdAt,
    );
    const updatedAt = group.rows.reduce(
      (max, r) => (r.updatedAt > max ? r.updatedAt : max),
      group.rows[0]!.updatedAt,
    );

    invitations.push({
      invitation: {
        eventId: raw.id,
        userId,
        invitedByUserId: raw.organizerId,
        status,
        dogIds: group.rows.map((r) => r.dogId),
        createdAt,
        updatedAt,
      },
      user: group.user,
      invitedBy: raw.organizer,
    });
  }

  const goingDogsCount = participants.filter((p) => p.rsvp.status === "GOING").length;
  const isFull = raw.maxParticipants !== null && goingDogsCount >= raw.maxParticipants;

  const currentUserInvitation =
    invitations.find((item) => item.user.id === viewerId)?.invitation ?? null;

  const currentUserDogRsvps: EventDogRsvpView[] = visibleRows
    .filter((row) => row.userId === viewerId && row.status !== "INVITED")
    .map((row) => ({
      id: row.id,
      eventId: row.eventId,
      userId: row.userId,
      dogId: row.dogId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

  return {
    id: raw.id,
    organizerId: raw.organizerId,
    placeId: raw.placeId,
    locationText: raw.locationText,
    title: raw.title,
    description: raw.description,
    type: raw.type,
    visibility: raw.visibility,
    status: raw.status,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    maxParticipants: raw.maxParticipants,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    organizer: raw.organizer,
    place: raw.place,
    invitations,
    participants,
    goingDogsCount,
    isFull,
    isOrganizer: raw.organizerId === viewerId,
    currentUserInvitation,
    currentUserDogRsvps,
  };
}

async function fetchEventViewOrThrow(
  viewerId: string,
  eventId: string,
  db: DbClient,
): Promise<EventView> {
  const [raw, blockedIds] = await Promise.all([
    db.event.findUnique({
      where: { id: eventId },
      include: eventInclude,
    }),
    getBlockedUserIds(viewerId, db),
  ]);

  if (!raw) {
    throw notFound("Event not found");
  }

  const blockedSet = new Set(blockedIds);
  const typedRaw = raw as unknown as RawEventWithRelations;
  if (!canViewerAccessRawEvent(typedRaw, viewerId, blockedSet)) {
    throw notFound("Event not found");
  }

  return toEventView(typedRaw, viewerId, blockedSet);
}

export async function listEvents(
  viewerId: string,
  tab: EventsTab = "PUBLIC",
  db: DbClient = prisma,
): Promise<EventView[]> {
  const blockedIds = await getBlockedUserIds(viewerId, db);
  const blockedSet = new Set(blockedIds);

  let where: Prisma.EventWhereInput = {};
  switch (tab) {
    case "PUBLIC":
      where = {
        visibility: "PUBLIC",
        status: "ACTIVE",
      };
      break;
    case "ORGANIZED":
      where = {
        organizerId: viewerId,
      };
      break;
    case "INVITATIONS":
      where = {
        organizerId: { not: viewerId },
        participants: {
          some: {
            userId: viewerId,
          },
        },
      };
      break;
    case "ALL":
      where = {
        OR: [
          { visibility: "PUBLIC" },
          { organizerId: viewerId },
          { participants: { some: { userId: viewerId } } },
        ],
      };
      break;
  }

  const events = await db.event.findMany({
    where,
    include: eventInclude,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
  });

  return (events as unknown as RawEventWithRelations[])
    .filter((ev) => canViewerAccessRawEvent(ev, viewerId, blockedSet))
    .map((ev) => toEventView(ev, viewerId, blockedSet))
    .filter((view) => (tab === "INVITATIONS" ? view.currentUserInvitation !== null : true));
}

export async function getEventById(
  viewerId: string,
  eventId: string,
  db: DbClient = prisma,
): Promise<EventView> {
  return fetchEventViewOrThrow(viewerId, eventId, db);
}

export async function createEvent(
  viewerId: string,
  input: CreateEventInput,
  db: DbClient = prisma,
): Promise<EventView> {
  if (input.endsAt <= input.startsAt) {
    throw badRequest("Event end time must be later than start time");
  }

  const maxParticipants = input.maxParticipants ?? null;
  if (maxParticipants !== null && maxParticipants < 1) {
    throw badRequest("maxParticipants must be at least 1");
  }

  const uniqueGoingDogIds = [...new Set(input.organizerGoingDogIds ?? [])];
  if (maxParticipants !== null && uniqueGoingDogIds.length > maxParticipants) {
    throw conflict(
      `Selected dogs (${uniqueGoingDogIds.length}) exceed maxParticipants (${maxParticipants})`,
    );
  }

  if (input.visibility === "PRIVATE" && input.placeId) {
    throw badRequest("Private events cannot be linked to a public placeId");
  }

  if (input.visibility === "PRIVATE" && !input.locationText?.trim()) {
    throw badRequest("locationText is required for a private event");
  }

  if (input.visibility === "PUBLIC" && !input.placeId && !input.locationText?.trim()) {
    throw badRequest("A public event requires a placeId or locationText");
  }

  return runInTransaction(db, async (tx) => {
    if (input.placeId) {
      const place = await tx.place.findUnique({
        where: { id: input.placeId },
        select: { id: true },
      });
      if (!place) {
        throw notFound("Place not found");
      }
    }

    if (uniqueGoingDogIds.length > 0) {
      const ownedDogs = await tx.dog.findMany({
        where: {
          id: { in: uniqueGoingDogIds },
          ownerId: viewerId,
        },
        select: { id: true },
      });
      if (ownedDogs.length !== uniqueGoingDogIds.length) {
        throw forbidden("You can only add your own dogs to the event");
      }
    }

    const blockedIds = new Set(await getBlockedUserIds(viewerId, tx));
    const uniqueInvitedUserIds = [...new Set(input.invitedUserIds ?? [])].filter(
      (uid) => uid !== viewerId && !blockedIds.has(uid),
    );

    const invitedDogs =
      uniqueInvitedUserIds.length > 0
        ? await tx.dog.findMany({
            where: {
              ownerId: { in: uniqueInvitedUserIds },
            },
            select: { id: true, ownerId: true },
          })
        : [];

    const createdEvent = await tx.event.create({
      data: {
        organizerId: viewerId,
        placeId: input.visibility === "PUBLIC" ? (input.placeId ?? null) : null,
        locationText: input.locationText?.trim() || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        visibility: input.visibility,
        status: "ACTIVE",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        maxParticipants,
      },
      select: { id: true },
    });

    const participantRows: Prisma.EventParticipantCreateManyInput[] = [
      ...uniqueGoingDogIds.map((dogId) => ({
        eventId: createdEvent.id,
        userId: viewerId,
        dogId,
        status: "GOING" as const,
      })),
      ...invitedDogs.map((dog) => ({
        eventId: createdEvent.id,
        userId: dog.ownerId,
        dogId: dog.id,
        status: "INVITED" as const,
      })),
    ];

    if (participantRows.length > 0) {
      await tx.eventParticipant.createMany({
        data: participantRows,
        skipDuplicates: true,
      });
    }

    return fetchEventViewOrThrow(viewerId, createdEvent.id, tx);
  });
}

export async function updateEvent(
  viewerId: string,
  eventId: string,
  patch: UpdateEventInput,
  db: DbClient = prisma,
): Promise<EventView> {
  return runInTransaction(db, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        visibility: true,
        status: true,
        startsAt: true,
        endsAt: true,
        maxParticipants: true,
      },
    });

    if (!existing) {
      throw notFound("Event not found");
    }
    if (existing.organizerId !== viewerId) {
      throw forbidden("Only the organizer can edit this event");
    }
    if (existing.status === "CANCELLED") {
      throw conflict("Cannot modify a cancelled event");
    }

    const nextStartsAt = patch.startsAt ?? existing.startsAt;
    const nextEndsAt = patch.endsAt ?? existing.endsAt;
    if (nextEndsAt <= nextStartsAt) {
      throw badRequest("Event end time must be later than start time");
    }

    if (patch.maxParticipants !== undefined && patch.maxParticipants !== null) {
      if (patch.maxParticipants < 1) {
        throw badRequest("maxParticipants must be at least 1");
      }
      const goingCount = await tx.eventParticipant.count({
        where: {
          eventId,
          status: "GOING",
        },
      });
      if (patch.maxParticipants < goingCount) {
        throw conflict(
          `maxParticipants (${patch.maxParticipants}) cannot be lower than current GOING dogs (${goingCount})`,
        );
      }
    }

    if (patch.placeId !== undefined && patch.placeId !== null) {
      if (existing.visibility === "PRIVATE") {
        throw badRequest("Private events cannot be linked to a public placeId");
      }
      const place = await tx.place.findUnique({
        where: { id: patch.placeId },
        select: { id: true },
      });
      if (!place) {
        throw notFound("Place not found");
      }
    }

    await tx.event.update({
      where: { id: eventId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description ? patch.description.trim() : null }
          : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.startsAt !== undefined ? { startsAt: patch.startsAt } : {}),
        ...(patch.endsAt !== undefined ? { endsAt: patch.endsAt } : {}),
        ...(patch.maxParticipants !== undefined ? { maxParticipants: patch.maxParticipants } : {}),
        ...(patch.placeId !== undefined && existing.visibility === "PUBLIC"
          ? { placeId: patch.placeId }
          : {}),
        ...(patch.locationText !== undefined
          ? { locationText: patch.locationText ? patch.locationText.trim() : null }
          : {}),
      },
    });

    return fetchEventViewOrThrow(viewerId, eventId, tx);
  });
}

export async function cancelEvent(
  viewerId: string,
  eventId: string,
  db: DbClient = prisma,
): Promise<EventView> {
  return runInTransaction(db, async (tx) => {
    const existing = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        status: true,
      },
    });

    if (!existing) {
      throw notFound("Event not found");
    }
    if (existing.organizerId !== viewerId) {
      throw forbidden("Only the organizer can cancel this event");
    }
    if (existing.status === "CANCELLED") {
      throw conflict("Event is already cancelled");
    }

    await tx.event.update({
      where: { id: eventId },
      data: { status: "CANCELLED" },
    });

    return fetchEventViewOrThrow(viewerId, eventId, tx);
  });
}

export async function deleteEvent(
  viewerId: string,
  eventId: string,
  db: DbClient = prisma,
): Promise<void> {
  const existing = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });
  if (!existing) {
    throw notFound("Event not found");
  }
  if (existing.organizerId !== viewerId) {
    throw forbidden("Only the organizer can delete this event");
  }

  await db.event.delete({
    where: { id: eventId },
  });
}

export async function inviteUsersToEvent(
  viewerId: string,
  eventId: string,
  input: InviteUsersInput,
  db: DbClient = prisma,
): Promise<EventView> {
  return runInTransaction(db, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        status: true,
      },
    });

    if (!event) {
      throw notFound("Event not found");
    }
    if (event.organizerId !== viewerId) {
      throw forbidden("Only the organizer can invite users to this event");
    }
    if (event.status === "CANCELLED") {
      throw conflict("Cannot invite users to a cancelled event");
    }

    const blockedSet = new Set(await getBlockedUserIds(viewerId, tx));
    const candidateUserIds = [...new Set(input.userIds)].filter(
      (uid) => uid !== viewerId && !blockedSet.has(uid),
    );

    if (candidateUserIds.length > 0) {
      const existingParticipants = await tx.eventParticipant.findMany({
        where: {
          eventId,
          userId: { in: candidateUserIds },
        },
        select: { dogId: true },
      });
      const alreadyLinkedDogIds = new Set(existingParticipants.map((p) => p.dogId));

      const dogsToInvite = await tx.dog.findMany({
        where: {
          ownerId: { in: candidateUserIds },
        },
        select: { id: true, ownerId: true },
      });

      const newInviteRows = dogsToInvite
        .filter((dog) => !alreadyLinkedDogIds.has(dog.id))
        .map((dog) => ({
          eventId,
          userId: dog.ownerId,
          dogId: dog.id,
          status: "INVITED" as const,
        }));

      if (newInviteRows.length > 0) {
        await tx.eventParticipant.createMany({
          data: newInviteRows,
          skipDuplicates: true,
        });
      }
    }

    return fetchEventViewOrThrow(viewerId, eventId, tx);
  });
}

export async function respondToInvitation(
  viewerId: string,
  eventId: string,
  input: RespondToInvitationInput,
  db: DbClient = prisma,
): Promise<EventView | { eventId: string; status: "DECLINED" }> {
  return runInTransaction(db, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        status: true,
        maxParticipants: true,
      },
    });

    if (!event) {
      throw notFound("Event not found");
    }
    if (event.organizerId && (await isBlockedEitherWay(viewerId, event.organizerId, tx))) {
      throw notFound("Event not found");
    }
    if (event.status === "CANCELLED") {
      throw conflict("Cannot respond to an invitation for a cancelled event");
    }

    const currentRows = await tx.eventParticipant.findMany({
      where: {
        eventId,
        userId: viewerId,
      },
      select: { id: true, dogId: true, status: true },
    });

    if (currentRows.length === 0) {
      throw notFound("No invitation found for your account on this event");
    }

    if (input.status === "DECLINED") {
      await tx.eventParticipant.deleteMany({
        where: {
          eventId,
          userId: viewerId,
        },
      });
      return { eventId, status: "DECLINED" as const };
    }

    const uniqueGoingDogIds = [...new Set(input.goingDogIds ?? [])];
    if (uniqueGoingDogIds.length === 0) {
      throw badRequest("Select at least one of your dogs to accept the invitation");
    }

    const ownedDogs = await tx.dog.findMany({
      where: {
        id: { in: uniqueGoingDogIds },
        ownerId: viewerId,
      },
      select: { id: true },
    });

    if (ownedDogs.length !== uniqueGoingDogIds.length) {
      throw forbidden("You can only accept an invitation with your own dogs");
    }

    if (event.maxParticipants !== null) {
      const otherGoingCount = await tx.eventParticipant.count({
        where: {
          eventId,
          status: "GOING",
          userId: { not: viewerId },
        },
      });

      if (otherGoingCount + uniqueGoingDogIds.length > event.maxParticipants) {
        throw conflict(
          `Event capacity reached (${otherGoingCount}/${event.maxParticipants} dogs going)`,
        );
      }
    }

    // Înlocuim toate rândurile utilizatorului (inclusiv cele INVITED) cu câinii selectați ca GOING
    await tx.eventParticipant.deleteMany({
      where: {
        eventId,
        userId: viewerId,
      },
    });

    await tx.eventParticipant.createMany({
      data: uniqueGoingDogIds.map((dogId) => ({
        eventId,
        userId: viewerId,
        dogId,
        status: "GOING" as const,
      })),
    });

    return fetchEventViewOrThrow(viewerId, eventId, tx);
  });
}

export async function upsertDogRsvp(
  viewerId: string,
  eventId: string,
  input: UpsertDogRsvpInput,
  db: DbClient = prisma,
): Promise<EventView> {
  return runInTransaction(db, async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        visibility: true,
        status: true,
        maxParticipants: true,
      },
    });

    if (!event) {
      throw notFound("Event not found");
    }
    if (event.organizerId && (await isBlockedEitherWay(viewerId, event.organizerId, tx))) {
      throw notFound("Event not found");
    }
    if (event.status === "CANCELLED") {
      throw conflict("Cannot RSVP to a cancelled event");
    }

    if (event.visibility === "PRIVATE" && event.organizerId !== viewerId) {
      const userParticipation = await tx.eventParticipant.findFirst({
        where: {
          eventId,
          userId: viewerId,
        },
        select: { id: true },
      });
      if (!userParticipation) {
        throw forbidden("You are not invited to this private event");
      }
    }

    const dog = await tx.dog.findUnique({
      where: { id: input.dogId },
      select: { id: true, ownerId: true },
    });
    if (!dog) {
      throw notFound("Dog not found");
    }
    if (dog.ownerId !== viewerId) {
      throw forbidden("You can only RSVP with your own dogs");
    }

    if (input.status === "GOING" && event.maxParticipants !== null) {
      const otherGoingCount = await tx.eventParticipant.count({
        where: {
          eventId,
          status: "GOING",
          dogId: { not: input.dogId },
        },
      });
      if (otherGoingCount >= event.maxParticipants) {
        throw conflict(
          `This event has reached its capacity of ${event.maxParticipants} dogs`,
        );
      }
    }

    await tx.eventParticipant.upsert({
      where: {
        eventId_dogId: {
          eventId,
          dogId: input.dogId,
        },
      },
      update: {
        status: input.status,
      },
      create: {
        eventId,
        userId: viewerId,
        dogId: input.dogId,
        status: input.status,
      },
    });

    // Dacă utilizatorul avea alți câini în starea INVITED și acum a răspuns cu un câine GOING / MAYBE,
    // curățăm restul rândurilor INVITED pentru a marca invitația drept acceptată.
    if (input.status === "GOING" || input.status === "MAYBE") {
      await tx.eventParticipant.deleteMany({
        where: {
          eventId,
          userId: viewerId,
          status: "INVITED",
        },
      });
    }

    return fetchEventViewOrThrow(viewerId, eventId, tx);
  });
}
