import { z } from "zod";
import { loginSchemas, registerSchemas } from "../schemas/auth.schemas.js";
import {
  createHealthRecordSchemas,
  deleteHealthRecordSchemas,
  dogCareParamsSchemas,
  listHealthRecordsSchemas,
  updateHealthRecordSchemas,
} from "../routes/care.routes.js";
import { createDogSchemas, deleteDogSchemas, getDogSchemas, updateDogSchemas } from "../routes/dogs.routes.js";
import {
  createEventSchemas,
  eventIdParamsSchemas,
  inviteUsersSchemas,
  listEventsSchemas,
  respondToInvitationSchemas,
  updateEventSchemas,
  upsertDogRsvpByParamSchemas,
  upsertDogRsvpSchemas,
} from "../routes/events.routes.js";
import { createPlaceReviewSchemas, getPlaceSchemas, listPlacesSchemas } from "../routes/places.routes.js";
import { createCommentSchemas, createPostSchemas, listPostsSchemas, postIdParamsSchemas } from "../routes/posts.routes.js";
import { searchDogsSchemas } from "../routes/search.routes.js";
import type { RequestSchemas } from "../middleware/validate.js";

/**
 * Specificația OpenAPI 3.1 a API-ului, servită la /api/docs (Swagger UI) și /api/docs/openapi.json.
 *
 * - Cererile (params, query, body) se generează din aceleași scheme zod pe care le folosește
 *   `validate(...)`, deci nu pot ieși din sincron cu validarea.
 * - Răspunsurile sunt descrise de mână în `components.schemas`, după tipurile din services/.
 *
 * O rută nouă se adaugă în `paths` mai jos; testul din tests/docs/openapi.test.ts pică dacă lipsește.
 */

type JsonSchema = Record<string, unknown>;

// ───────────────────────── zod → JSON Schema ─────────────────────────

/** Curăță ce generează zod și nu ajută în documentație (regex-ul lung de uuid, limitele de Number.MAX_SAFE_INTEGER). */
function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean);
  if (node === null || typeof node !== "object") return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "$schema") continue;
    if (key === "pattern" && "format" in node) continue;
    if ((key === "maximum" || key === "minimum") && Math.abs(Number(value)) >= Number.MAX_SAFE_INTEGER) continue;
    out[key] = clean(value);
  }
  return out;
}

/** JSON Schema pentru ce trimite clientul (`io: "input"`): înainte de transform-uri și default-uri. */
function fromZod(schema: z.ZodType): JsonSchema {
  return clean(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" })) as JsonSchema;
}

function parametersFrom(schema: z.ZodType | undefined, location: "path" | "query"): JsonSchema[] {
  if (!schema) return [];
  const json = fromZod(schema);
  const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((json.required ?? []) as string[]);
  return Object.entries(properties).map(([name, propSchema]) => ({
    name,
    in: location,
    required: location === "path" || required.has(name),
    schema: propSchema,
  }));
}

// ───────────────────────── helpers pentru răspunsuri ─────────────────────────

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: JsonSchema) => ({ anyOf: [schema, { type: "null" }] });
const arrayOf = (schema: JsonSchema) => ({ type: "array", items: schema });
const str = { type: "string" };
const uuid = { type: "string", format: "uuid" };
const dateTime = { type: "string", format: "date-time" };
const int = { type: "integer" };
const num = { type: "number" };
const bool = { type: "boolean" };
const enumOf = (...values: string[]) => ({ type: "string", enum: values });

/** Obiect cu toate câmpurile obligatorii (așa arată răspunsurile API: câmpurile lipsă vin ca `null`). */
function obj(properties: Record<string, JsonSchema>, optional: string[] = []): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties).filter((key) => !optional.includes(key)),
  };
}

const dataOf = (schema: JsonSchema) => obj({ data: schema });

function json(description: string, schema: JsonSchema) {
  return { description, content: { "application/json": { schema } } };
}

const errorResponse = (description: string) => json(description, ref("Error"));

const ERRORS = {
  400: errorResponse("Date invalide (`VALIDATION_ERROR`, `BAD_REQUEST`, `INVALID_JSON`)"),
  401: errorResponse("Lipsește token-ul sau e invalid (`UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`)"),
  403: errorResponse("Resursa nu îți aparține (`FORBIDDEN`)"),
  404: errorResponse("Nu există sau e ascunsă din cauza unui block (`NOT_FOUND`)"),
  409: errorResponse("Conflict cu starea curentă (`CONFLICT`)"),
} as const;

type ErrorStatus = keyof typeof ERRORS;

interface OperationSpec {
  tag: string;
  summary: string;
  description?: string;
  /** Rută publică (fără token). Implicit rutele cer `Authorization: Bearer <token>`. */
  public?: boolean;
  schemas?: RequestSchemas;
  /** Răspunsul de succes. `undefined` înseamnă 204 fără body. */
  response?: { status: 200 | 201; description: string; schema: JsonSchema };
  errors?: ErrorStatus[];
}

function op(spec: OperationSpec): JsonSchema {
  const { schemas = {} } = spec;
  const parameters = [...parametersFrom(schemas.params, "path"), ...parametersFrom(schemas.query, "query")];

  const responses: Record<string, unknown> = {};
  if (spec.response) {
    responses[spec.response.status] = json(spec.response.description, spec.response.schema);
  } else {
    responses[204] = { description: "Șters, fără conținut" };
  }

  const errorStatuses = new Set<ErrorStatus>(spec.errors ?? []);
  if (schemas.params || schemas.query || schemas.body) errorStatuses.add(400);
  if (!spec.public) errorStatuses.add(401);
  for (const status of [...errorStatuses].sort()) responses[status] = ERRORS[status];

  return {
    tags: [spec.tag],
    summary: spec.summary,
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.public ? { security: [] } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(schemas.body
      ? { requestBody: { required: true, content: { "application/json": { schema: fromZod(schemas.body) } } } }
      : {}),
    responses,
  };
}

// ───────────────────────── modelele din răspunsuri ─────────────────────────

const sexEnum = enumOf("MALE", "FEMALE");
const sizeEnum = enumOf("SMALL", "MEDIUM", "LARGE", "GIANT");
const temperamentEnum = enumOf("FRIENDLY", "PLAYFUL", "SHY", "REACTIVE");
const placeTypeEnum = enumOf("PARK", "DOG_PARK", "CAFE", "VET", "PET_SHOP");
const rsvpStatusEnum = enumOf("INVITED", "GOING", "MAYBE", "NOT_GOING");

const userSummaryProps = {
  id: uuid,
  firstName: str,
  lastName: str,
  avatarUrl: nullable(str),
};

const publicUserProps = {
  ...userSummaryProps,
  bio: nullable(str),
  approxLatitude: { ...num, description: "Rotunjită la 2 zecimale (~1 km)" },
  approxLongitude: { ...num, description: "Rotunjită la 2 zecimale (~1 km)" },
};

const dogProps = {
  id: uuid,
  ownerId: uuid,
  breedId: uuid,
  name: str,
  birthDate: nullable(dateTime),
  sex: sexEnum,
  size: sizeEnum,
  temperament: temperamentEnum,
  neutered: bool,
  photoUrl: nullable(str),
};

const placeProps = {
  id: uuid,
  name: str,
  latitude: num,
  longitude: num,
  address: nullable(str),
  phone: nullable(str),
  website: nullable(str),
  openingHours: nullable(str),
  type: placeTypeEnum,
  source: enumOf("OSM", "USER_EVENTS"),
};

const placeSummaryProps = {
  ...placeProps,
  osmId: nullable(str),
  createdAt: dateTime,
  updatedAt: dateTime,
  reviewCount: int,
  averageRating: nullable(num),
};

const invitationSummary = obj({
  eventId: uuid,
  userId: uuid,
  invitedByUserId: nullable(uuid),
  status: enumOf("PENDING", "ACCEPTED"),
  dogIds: arrayOf(uuid),
  createdAt: dateTime,
  updatedAt: dateTime,
});

const commentProps = {
  id: uuid,
  postId: uuid,
  userId: uuid,
  content: str,
  createdAt: dateTime,
  updatedAt: dateTime,
  author: ref("PublicUser"),
};

const components = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "Token-ul primit de la `/api/auth/login` sau `/api/auth/register`.",
    },
  },
  schemas: {
    Error: obj({
      error: obj(
        {
          code: { ...str, examples: ["NOT_FOUND"] },
          message: { ...str, examples: ["Dog not found"] },
          details: {
            description:
              "Doar la unele erori. La `VALIDATION_ERROR` e o listă `{ location, path, message }`, câte una pentru fiecare câmp invalid.",
          },
        },
        ["details"],
      ),
    }),
    PaginationMeta: obj({ page: int, pageSize: int, total: int, totalPages: int }),

    SelfUser: obj({
      ...publicUserProps,
      email: { ...str, format: "email" },
      emailVerified: bool,
      consentAt: { ...dateTime, description: "Momentul acordului GDPR" },
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    PublicUser: obj(publicUserProps),
    UserSummary: obj(userSummaryProps),
    AuthResult: obj({ token: { ...str, description: "JWT" }, user: ref("SelfUser") }),

    Breed: obj({
      id: uuid,
      name: str,
      size: sizeEnum,
      careTips: str,
      heatSensitive: bool,
      breathingIssues: bool,
      energyLevel: { ...int, minimum: 1, maximum: 5 },
    }),
    Dog: obj({ ...dogProps, createdAt: dateTime, updatedAt: dateTime }),
    DogWithBreed: obj({ ...dogProps, createdAt: dateTime, updatedAt: dateTime, breed: ref("Breed") }),
    DogDetail: obj({
      ...dogProps,
      createdAt: dateTime,
      updatedAt: dateTime,
      breed: ref("Breed"),
      owner: ref("PublicUser"),
    }),
    DogSearchResult: obj({
      ...dogProps,
      createdAt: dateTime,
      updatedAt: dateTime,
      breed: ref("Breed"),
      owner: ref("PublicUser"),
      ageGroup: nullable(enumOf("PUPPY", "ADULT", "SENIOR")),
      distanceKm: { ...num, description: "Distanța aproximativă până la stăpân, cu o zecimală" },
    }),

    HealthRecord: obj({
      id: uuid,
      dogId: uuid,
      type: enumOf("VACCINE", "DEWORMING", "VET_VISIT", "WEIGHT"),
      title: str,
      date: dateTime,
      nextDueDate: nullable(dateTime),
      weightKg: nullable(num),
      notes: nullable(str),
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    Reminder: obj({
      record: ref("HealthRecord"),
      status: {
        ...enumOf("OVERDUE", "DUE_SOON", "FUTURE"),
        description: "`DUE_SOON` = în următoarele 14 zile",
      },
      daysDelta: { ...int, description: "Zile până la `nextDueDate` (negativ dacă a trecut)" },
    }),
    WeightPoint: obj({ id: uuid, title: str, date: dateTime, weightKg: num }),
    DailyTip: obj({ headline: str, advice: str, isWarning: bool, disclaimer: str }),

    EventInvitation: invitationSummary,
    EventDogRsvp: obj({
      id: uuid,
      eventId: uuid,
      userId: uuid,
      dogId: uuid,
      status: rsvpStatusEnum,
      createdAt: dateTime,
      updatedAt: dateTime,
    }),
    Event: obj({
      id: uuid,
      organizerId: nullable(uuid),
      placeId: nullable(uuid),
      locationText: nullable(str),
      title: str,
      description: nullable(str),
      type: enumOf("PLAYDATE", "GROUP_WALK", "BREED_MEETUP"),
      visibility: enumOf("PUBLIC", "PRIVATE"),
      status: enumOf("ACTIVE", "CANCELLED"),
      startsAt: dateTime,
      endsAt: dateTime,
      maxParticipants: nullable(int),
      createdAt: dateTime,
      updatedAt: dateTime,
      organizer: nullable(ref("PublicUser")),
      place: nullable(obj(placeProps)),
      invitations: arrayOf(
        obj({ invitation: ref("EventInvitation"), user: ref("PublicUser"), invitedBy: nullable(ref("PublicUser")) }),
      ),
      participants: arrayOf(
        obj({ rsvp: ref("EventDogRsvp"), dog: ref("Dog"), breed: ref("Breed"), owner: ref("PublicUser") }),
      ),
      goingDogsCount: { ...int, description: "Câini cu status `GOING`; se compară cu `maxParticipants`" },
      isFull: bool,
      isOrganizer: bool,
      currentUserInvitation: nullable(ref("EventInvitation")),
      currentUserDogRsvps: arrayOf(ref("EventDogRsvp")),
    }),

    Place: obj(placeSummaryProps),
    PlaceReview: obj({
      id: uuid,
      userId: uuid,
      placeId: uuid,
      eventId: uuid,
      rating: { ...int, minimum: 1, maximum: 5 },
      tags: arrayOf(str),
      createdAt: dateTime,
      user: ref("UserSummary"),
    }),
    PlaceDetail: obj({ ...placeSummaryProps, reviews: arrayOf(ref("PlaceReview")) }),

    Comment: obj(commentProps),
    Post: obj({
      id: uuid,
      authorId: uuid,
      dogId: nullable(uuid),
      content: str,
      imageUrl: nullable(str),
      createdAt: dateTime,
      updatedAt: dateTime,
      author: ref("PublicUser"),
      dog: nullable(obj({ ...dogProps, breed: obj({ id: uuid, name: str, size: sizeEnum }) })),
      comments: arrayOf(ref("Comment")),
      likedByUserIds: arrayOf(uuid),
      likeCount: int,
      isLikedByMe: bool,
      canDelete: bool,
    }),
    LikeResult: obj({ postId: uuid, likeCount: int, isLikedByMe: bool }),
  },
};

// ───────────────────────── rutele ─────────────────────────

const eventResponse = (description: string, status: 200 | 201 = 200) => ({
  status,
  description,
  schema: dataOf(ref("Event")),
});

const paths = {
  "/health": {
    get: op({
      tag: "Health",
      summary: "Starea API-ului și a bazei de date",
      public: true,
      response: {
        status: 200,
        description: "API-ul și baza de date merg",
        schema: dataOf(obj({ status: enumOf("ok"), database: enumOf("up") })),
      },
    }),
  },

  "/auth/register": {
    post: op({
      tag: "Auth",
      summary: "Creează un cont și întoarce direct un token",
      description:
        "Emailul se salvează cu litere mici. Parola are minim 8 caractere și maxim 72 de octeți (limita bcrypt). " +
        "`latitude` / `longitude` se rotunjesc la 2 zecimale (~1 km); locația exactă nu se păstrează. " +
        "`consentAccepted` trebuie să fie `true` (GDPR).",
      public: true,
      schemas: registerSchemas,
      response: { status: 201, description: "Cont creat, utilizator logat", schema: dataOf(ref("AuthResult")) },
      errors: [409],
    }),
  },
  "/auth/login": {
    post: op({
      tag: "Auth",
      summary: "Login cu email și parolă",
      description:
        "Răspunsul `401 INVALID_CREDENTIALS` e același pentru parolă greșită și email inexistent. " +
        "Conturile demo din seed au parola `pass1`.",
      public: true,
      schemas: loginSchemas,
      response: { status: 200, description: "Login reușit", schema: dataOf(ref("AuthResult")) },
    }),
  },
  "/auth/me": {
    get: op({
      tag: "Auth",
      summary: "Utilizatorul logat",
      response: { status: 200, description: "Profilul complet", schema: dataOf(ref("SelfUser")) },
      errors: [404],
    }),
  },

  "/breeds": {
    get: op({
      tag: "Breeds",
      summary: "Toate rasele, ordonate după nume",
      public: true,
      response: { status: 200, description: "Lista de rase", schema: dataOf(arrayOf(ref("Breed"))) },
    }),
  },

  "/dogs": {
    post: op({
      tag: "Dogs",
      summary: "Adaugă un câine utilizatorului logat",
      schemas: createDogSchemas,
      response: { status: 201, description: "Câinele creat", schema: dataOf(ref("DogWithBreed")) },
      errors: [404],
    }),
  },
  "/dogs/{id}": {
    get: op({
      tag: "Dogs",
      summary: "Detaliile unui câine, cu rasa și stăpânul",
      description: "Câinii utilizatorilor cu care există un block (în oricare direcție) răspund cu 404.",
      schemas: getDogSchemas,
      response: { status: 200, description: "Câinele", schema: dataOf(ref("DogDetail")) },
      errors: [404],
    }),
    patch: op({
      tag: "Dogs",
      summary: "Modifică un câine propriu",
      description: "Se trimit doar câmpurile care se schimbă (cel puțin unul).",
      schemas: updateDogSchemas,
      response: { status: 200, description: "Câinele modificat", schema: dataOf(ref("DogWithBreed")) },
      errors: [403, 404],
    }),
    delete: op({
      tag: "Dogs",
      summary: "Șterge un câine propriu",
      schemas: deleteDogSchemas,
      errors: [403, 404],
    }),
  },

  "/dogs/{id}/health-records": {
    get: op({
      tag: "Care",
      summary: "Fișa medicală a unui câine propriu",
      schemas: listHealthRecordsSchemas,
      response: { status: 200, description: "Înregistrările", schema: dataOf(arrayOf(ref("HealthRecord"))) },
      errors: [403, 404],
    }),
    post: op({
      tag: "Care",
      summary: "Adaugă o înregistrare medicală (vaccin, deparazitare, vizită, greutate)",
      description: "`weightKg` e obligatoriu când `type` e `WEIGHT`. `nextDueDate` nu poate fi înainte de `date`.",
      schemas: createHealthRecordSchemas,
      response: { status: 201, description: "Înregistrarea creată", schema: dataOf(ref("HealthRecord")) },
      errors: [403, 404],
    }),
  },
  "/dogs/{id}/health-records/{recordId}": {
    patch: op({
      tag: "Care",
      summary: "Modifică o înregistrare medicală",
      schemas: updateHealthRecordSchemas,
      response: { status: 200, description: "Înregistrarea modificată", schema: dataOf(ref("HealthRecord")) },
      errors: [403, 404],
    }),
    delete: op({
      tag: "Care",
      summary: "Șterge o înregistrare medicală",
      schemas: deleteHealthRecordSchemas,
      errors: [403, 404],
    }),
  },
  "/dogs/{id}/reminders": {
    get: op({
      tag: "Care",
      summary: "Remindere din înregistrările cu `nextDueDate`, cele mai apropiate primele",
      schemas: dogCareParamsSchemas,
      response: { status: 200, description: "Reminderele", schema: dataOf(arrayOf(ref("Reminder"))) },
      errors: [403, 404],
    }),
  },
  "/dogs/{id}/weight-history": {
    get: op({
      tag: "Care",
      summary: "Istoricul greutății, în ordine cronologică",
      schemas: dogCareParamsSchemas,
      response: { status: 200, description: "Punctele de greutate", schema: dataOf(arrayOf(ref("WeightPoint"))) },
      errors: [403, 404],
    }),
  },
  "/dogs/{id}/daily-tip": {
    get: op({
      tag: "Care",
      summary: "Sfatul zilei, după rasă și vârstă",
      schemas: dogCareParamsSchemas,
      response: { status: 200, description: "Sfatul", schema: dataOf(ref("DailyTip")) },
      errors: [403, 404],
    }),
  },

  "/search/dogs": {
    get: op({
      tag: "Search",
      summary: "Caută câini din apropiere",
      description:
        "Exclude câinii proprii și pe cei ai utilizatorilor blocați (în oricare direcție). " +
        "Rezultatele sunt ordonate după distanță. `q` caută în numele câinelui, al rasei și al stăpânului.",
      schemas: searchDogsSchemas,
      response: {
        status: 200,
        description: "O pagină de rezultate",
        schema: obj({ data: arrayOf(ref("DogSearchResult")), meta: ref("PaginationMeta") }),
      },
    }),
  },

  "/events": {
    get: op({
      tag: "Events",
      summary: "Evenimentele dintr-un tab",
      description:
        "`PUBLIC`: evenimentele publice active. `ORGANIZED`: cele organizate de mine (inclusiv anulate). " +
        "`INVITATIONS`: cele organizate de alții la care am o invitație. `ALL`: toate cele pe care le pot vedea. " +
        "Ordonate după `startsAt`; evenimentele utilizatorilor blocați nu apar.",
      schemas: listEventsSchemas,
      response: { status: 200, description: "Evenimentele", schema: dataOf(arrayOf(ref("Event"))) },
    }),
    post: op({
      tag: "Events",
      summary: "Creează un eveniment",
      description:
        "Un eveniment `PRIVATE` cere `locationText` și nu poate avea `placeId`. Unul `PUBLIC` cere `placeId` sau `locationText`. " +
        "`invitedUserIds` primesc invitații; `organizerGoingDogIds` sunt câinii organizatorului înscriși direct cu `GOING`.",
      schemas: createEventSchemas,
      response: eventResponse("Evenimentul creat", 201),
      errors: [403, 404, 409],
    }),
  },
  "/events/{id}": {
    get: op({
      tag: "Events",
      summary: "Detaliile unui eveniment",
      description: "Evenimentele private sunt vizibile doar organizatorului și invitaților; altfel 404.",
      schemas: eventIdParamsSchemas,
      response: eventResponse("Evenimentul"),
      errors: [404],
    }),
    patch: op({
      tag: "Events",
      summary: "Modifică un eveniment (doar organizatorul)",
      schemas: updateEventSchemas,
      response: eventResponse("Evenimentul modificat"),
      errors: [403, 404, 409],
    }),
    delete: op({
      tag: "Events",
      summary: "Șterge un eveniment (doar organizatorul)",
      schemas: eventIdParamsSchemas,
      errors: [403, 404],
    }),
  },
  "/events/{id}/cancel": {
    post: op({
      tag: "Events",
      summary: "Anulează un eveniment (doar organizatorul)",
      description: "Evenimentul rămâne vizibil cu `status: CANCELLED`; nu mai acceptă RSVP-uri sau modificări.",
      schemas: eventIdParamsSchemas,
      response: eventResponse("Evenimentul anulat"),
      errors: [403, 404, 409],
    }),
  },
  "/events/{id}/invitations": {
    post: op({
      tag: "Events",
      summary: "Invită utilizatori (doar organizatorul)",
      schemas: inviteUsersSchemas,
      response: eventResponse("Evenimentul, cu invitațiile noi"),
      errors: [403, 404, 409],
    }),
  },
  "/events/{id}/invitations/respond": {
    post: op({
      tag: "Events",
      summary: "Acceptă sau refuză o invitație",
      description: "La `ACCEPTED` trebuie ales cel puțin un câine propriu în `goingDogIds`; câinii aleși devin `GOING`.",
      schemas: respondToInvitationSchemas,
      response: eventResponse("Evenimentul, după răspuns"),
      errors: [403, 404, 409],
    }),
  },
  "/events/{id}/rsvp": {
    post: op({
      tag: "Events",
      summary: "RSVP pentru unul dintre câinii mei",
      description:
        "Creează sau actualizează RSVP-ul câinelui. La evenimentele private doar invitații pot da RSVP. " +
        "`409` dacă evenimentul e anulat sau dacă `GOING` ar depăși `maxParticipants`.",
      schemas: upsertDogRsvpSchemas,
      response: eventResponse("Evenimentul, cu RSVP-ul actualizat"),
      errors: [403, 404, 409],
    }),
  },
  "/events/{id}/rsvp/{dogId}": {
    put: op({
      tag: "Events",
      summary: "RSVP pentru un câine, cu `dogId` în URL",
      description: "La fel ca `POST /events/{id}/rsvp`, dar câinele e dat în URL.",
      schemas: upsertDogRsvpByParamSchemas,
      response: eventResponse("Evenimentul, cu RSVP-ul actualizat"),
      errors: [403, 404, 409],
    }),
  },

  "/places": {
    get: op({
      tag: "Places",
      summary: "Locurile de pe hartă (parcuri, cafenele, veterinari…)",
      schemas: listPlacesSchemas,
      response: { status: 200, description: "Locurile", schema: dataOf(arrayOf(ref("Place"))) },
    }),
  },
  "/places/{id}": {
    get: op({
      tag: "Places",
      summary: "Detaliile unui loc, cu recenziile",
      schemas: getPlaceSchemas,
      response: { status: 200, description: "Locul", schema: dataOf(ref("PlaceDetail")) },
      errors: [404],
    }),
  },
  "/places/{id}/reviews": {
    post: op({
      tag: "Places",
      summary: "Recenzie pentru un loc, după un eveniment ținut acolo",
      description:
        "Doar organizatorul sau participanții `GOING` la eveniment pot lăsa recenzie, o singură dată per eveniment.",
      schemas: createPlaceReviewSchemas,
      response: { status: 201, description: "Recenzia creată", schema: dataOf(ref("PlaceReview")) },
      errors: [403, 404, 409],
    }),
  },

  "/posts": {
    get: op({
      tag: "Posts",
      summary: "Feed-ul, cele mai noi postări primele",
      description: "Postările, like-urile și comentariile utilizatorilor blocați nu apar.",
      schemas: listPostsSchemas,
      response: {
        status: 200,
        description: "O pagină de postări",
        schema: obj({ data: arrayOf(ref("Post")), meta: ref("PaginationMeta") }),
      },
    }),
    post: op({
      tag: "Posts",
      summary: "Publică o postare",
      description: "`dogId` poate fi doar unul dintre câinii proprii.",
      schemas: createPostSchemas,
      response: { status: 201, description: "Postarea creată", schema: dataOf(ref("Post")) },
      errors: [403, 404],
    }),
  },
  "/posts/{id}": {
    delete: op({
      tag: "Posts",
      summary: "Șterge o postare proprie",
      schemas: postIdParamsSchemas,
      errors: [403, 404],
    }),
  },
  "/posts/{id}/like": {
    post: op({
      tag: "Posts",
      summary: "Like (de mai multe ori are același efect)",
      schemas: postIdParamsSchemas,
      response: { status: 200, description: "Starea like-urilor", schema: dataOf(ref("LikeResult")) },
      errors: [404],
    }),
    delete: op({
      tag: "Posts",
      summary: "Scoate like-ul",
      schemas: postIdParamsSchemas,
      response: { status: 200, description: "Starea like-urilor", schema: dataOf(ref("LikeResult")) },
      errors: [404],
    }),
  },
  "/posts/{id}/comments": {
    get: op({
      tag: "Posts",
      summary: "Comentariile unei postări, în ordine cronologică",
      schemas: postIdParamsSchemas,
      response: { status: 200, description: "Comentariile", schema: dataOf(arrayOf(ref("Comment"))) },
      errors: [404],
    }),
    post: op({
      tag: "Posts",
      summary: "Adaugă un comentariu",
      schemas: createCommentSchemas,
      response: { status: 201, description: "Comentariul creat", schema: dataOf(ref("Comment")) },
      errors: [404],
    }),
  },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "DogApp API",
    version: "1.0.0",
    description:
      "API-ul aplicației. Răspunsurile au forma `{ data }`, listele paginate `{ data, meta }`, " +
      "iar erorile `{ error: { code, message, details? } }`.\n\n" +
      "Pentru rutele protejate: loghează-te cu `POST /auth/login` (de ex. `ana.pop@demo.dogapp` / `pass1`), " +
      "copiază `token` din răspuns și apasă **Authorize**.",
  },
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Health" },
    { name: "Auth", description: "Cont, login, token" },
    { name: "Breeds" },
    { name: "Dogs", description: "Profilurile câinilor" },
    { name: "Care", description: "Fișa medicală, remindere, sfaturi" },
    { name: "Search", description: "Căutarea câinilor din apropiere" },
    { name: "Events", description: "Playdate-uri, plimbări în grup, RSVP" },
    { name: "Places", description: "Harta și recenziile locurilor" },
    { name: "Posts", description: "Feed, like-uri, comentarii" },
  ],
  paths,
  components,
};
