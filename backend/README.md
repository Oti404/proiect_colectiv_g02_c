# ⚙️ Backend

API-ul aplicației, scris în **TypeScript** cu **Node.js 24 LTS** + **Express 5**, cu **Prisma 7** ca ORM și **PostgreSQL 18** ca bază de date.

**Echipa:** Sebastian · Gabriel G. · Gabriel F.

## Responsabilități
- API REST consumat de [frontend](../frontend/)
- Autentificare și autorizare cu **JWT**, parole criptate cu **bcryptjs**
- Modelul bazei de date și migrațiile (Prisma)
- Validarea datelor și tratarea erorilor

## Cerințe
- **Node.js 24.15.0 sau mai nou** (verificați cu `node -v`)
- Pentru baza de date: **Docker Desktop** (vezi [database/README.md](../database/README.md))

## Rulare locală

Toate comenzile se rulează din folderul `backend/`.

1. Instalați pachetele:

       npm install

2. Dacă npm afișează avertismentul `install-scripts ... not yet covered by allowScripts`, aprobați scripturile (sunt necesare pentru Prisma și `tsx`) și rulați-le:

       npm install-scripts approve prisma @prisma/engines esbuild
       npm rebuild prisma @prisma/engines esbuild

3. Copiați `.env.example` în `.env` și completați valorile:

       copy .env.example .env

4. Porniți serverul:

       npm run dev

API-ul pornește la `http://localhost:3000`. Verificare: `http://localhost:3000/api/health` → `{"data":{"status":"ok","database":"up"}}`.

Documentația tuturor endpoint-urilor (Swagger UI) e la `http://localhost:3000/api/docs`. De acolo rutele se pot și apela: login cu `POST /auth/login` (de ex. `ana.pop@demo.dogapp` / `pass1`), apoi **Authorize** cu token-ul primit. Specificația OpenAPI brută: `http://localhost:3000/api/docs/openapi.json`.

## Comenzi utile

| Comandă | Ce face |
|---|---|
| `npm run dev` | Pornește serverul cu reîncărcare automată (`tsx watch`) |
| `npm run build` | Compilează TypeScript-ul în `dist/` |
| `npm start` | Rulează varianta compilată (`node dist/server.js`) |
| `npm test` | Rulează testele unit (vitest + supertest), fără bază de date |
| `npm run test:integration` | Rulează testele de integrare pe o bază de test separată (`<db>_test`), creată automat. Cere `docker compose up -d db` |
| `npm run test:all` | Rulează ambele seturi de teste |
| `npm run typecheck` | Verifică tipurile în `src/` și `tests/` |
| `npm run prisma:generate` | Generează clientul Prisma după modificări în `schema.prisma` |
| `npx prisma migrate dev --name <nume>` | Creează o migrare și aplică modificările în baza de date |
| `npx prisma db seed` | Umple baza cu date demo (se poate rula de mai multe ori) |
| `npx prisma generate` | Regenerează clientul Prisma (rulați-o după `git pull`, dacă s-a schimbat schema) |
| `npx prisma studio` | Deschide în browser o interfață pentru datele din baza de date |

## Structură

```
backend/
├── prisma/
│   ├── schema.prisma   ← modelul bazei de date
│   ├── migrations/     ← migrările (se urcă în repo)
│   └── seed.ts         ← datele demo (rase, utilizatori, câini)
├── prisma.config.ts    ← configurarea Prisma (conexiunea la baza de date)
├── docs/api/           ← note detaliate pe modul (de ex. auth.md)
├── tests/              ← teste unit (fără bază de date), aceeași structură ca src/
│   └── integration/    ← teste pe baza de date reală + helpers (createUser, resetDatabase)
└── src/
    ├── config/env.ts   ← variabilele de mediu, validate la pornire
    ├── routes/         ← definirea endpoint-urilor (+ validare, auth)
    ├── schemas/        ← schemele zod pentru body / query / params
    ├── controllers/    ← primesc cererea și trimit răspunsul, fără logică
    ├── services/       ← logica aplicației și accesul la baza de date
    ├── middleware/     ← requireAuth, validate, middleware-ul de erori
    ├── utils/          ← erori HTTP, format răspuns, paginare, geo, JWT
    ├── lib/prisma.ts   ← clientul Prisma
    ├── types/          ← extinderi de tipuri (`req.user`)
    ├── docs/openapi.ts ← specificația OpenAPI, servită la /api/docs
    ├── generated/      ← clientul Prisma generat (nu se urcă în repo)
    ├── app.ts          ← aplicația Express (folosită și de teste)
    └── server.ts       ← punctul de pornire (`listen`)
```

## Cum se scrie un endpoint

Fiecare modul are: `schemas/<modul>.schemas.ts` (validare) → `routes/<modul>.routes.ts` → `controllers/<modul>.controller.ts` → `services/<modul>.service.ts`. Router-ul se montează în `routes/index.ts` (lista `apiMounts`), iar endpoint-ul se adaugă în `src/docs/openapi.ts`: parametrii și body-ul se generează din schemele zod, răspunsul se descrie în `components.schemas`. Testul `tests/docs/openapi.test.ts` pică dacă o rută din Express lipsește din documentație (sau invers). Exemple complete: `GET /api/health` și modulul `auth`.

Ce câmpuri ale unui utilizator se trimit e definit o singură dată, în `services/user-selects.ts`: `selfUserSelect` (utilizatorul despre el însuși), `publicUserSelect` (profil public, fără email), `userSummarySelect` (liste).

```ts
// routes/dogs.routes.ts
const getDogSchemas = { params: z.object({ id: z.uuid() }) };
dogsRouter.get("/:id", requireAuth, validate(getDogSchemas), getDog);

// controllers/dogs.controller.ts
export async function getDog(req: ValidatedRequest<typeof getDogSchemas>, res: Response) {
  const dog = await dogsService.getDog(currentUser(req).id, req.params.id);
  sendOk(res, dog);
}

// services/dogs.service.ts
export async function getDog(viewerId: string, dogId: string) {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog || (await isBlockedEitherWay(viewerId, dog.ownerId))) throw notFound("Dog not found");
  return dog;
}
```

### Formatul răspunsurilor

| Caz | Status | Corp |
|---|---|---|
| Succes | 200 / 201 | `{ "data": ... }` (`sendOk`, `sendCreated`) |
| Listă paginată | 200 | `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }` (`sendPaginated`) |
| Fără conținut | 204 | gol (`sendNoContent`) |
| Eroare | 4xx / 5xx | `{ "error": { "code": "NOT_FOUND", "message": "...", "details"?: ... } }` |

Erorile **nu** se trimit cu `res.status(...).json(...)`: se aruncă din service sau controller (`throw notFound("Dog not found")`, `throw forbidden()`, `throw conflict(...)` sau `new HttpError(status, "COD_PROPRIU", mesaj)`), iar middleware-ul din `middleware/error-handler.ts` le transformă. Express 5 prinde singur erorile din funcțiile `async`, nu e nevoie de `try/catch` sau `asyncHandler`.

Coduri de eroare folosite deja: `VALIDATION_ERROR` (400, cu lista de câmpuri în `details`), `INVALID_JSON`, `BAD_REQUEST`, `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` (401), `FORBIDDEN` (403), `NOT_FOUND`, `ROUTE_NOT_FOUND` (404), `CONFLICT` (409, inclusiv duplicate Prisma `P2002`), `INTERNAL_ERROR` (500).

### Funcții comune

| Funcție | Unde | Ce face |
|---|---|---|
| `requireAuth`, `currentUser(req)` | `middleware/require-auth.ts` | Verifică `Authorization: Bearer <token>` și pune utilizatorul pe `req.user` |
| `validate({ params, query, body })`, `ValidatedRequest` | `middleware/validate.ts` | Validare cu zod; valorile convertite înlocuiesc `req.params` / `req.query` / `req.body` |
| `isBlockedEitherWay(a, b)`, `getBlockedUserIds(id)` | `services/block.service.ts` | Block în oricare direcție |
| `paginationQuery`, `toPrismaPagination`, `buildPaginationMeta`, `paginateArray` | `utils/pagination.ts` | `?page=1&pageSize=20` (max 100) |
| `roundCoordinate`, `roundLocation`, `haversineKm` | `utils/geo.ts` | Rotunjire la 2 zecimale, distanță în km |
| `signAccessToken`, `verifyAccessToken` | `utils/jwt.ts` | Token-uri JWT (HS256) |

Funcțiile din `services/` primesc opțional ca ultim parametru un `db: DbClient`, ca să poată fi folosite și într-o tranzacție: `prisma.$transaction(async (tx) => { await isBlockedEitherWay(a, b, tx); ... })`.

## Docker

Imaginea se construiește din `Dockerfile` în două etape: prima compilează TypeScript-ul, iar a doua păstrează doar `dist/` și pachetele de producție, ca imaginea să fie mică. Se pornește din rădăcina repo-ului cu `docker compose up -d --build backend`.

## Reguli
- Instalați Prisma explicit pe versiunea 7: `npm install prisma@7 @prisma/client@7`. Eticheta `latest` de pe npm poate arăta spre o versiune de test.
- Importurile între fișierele proprii se scriu cu extensia **`.js`**, chiar dacă fișierul e `.ts` (ex. `import { prisma } from "./lib/prisma.js"`). Așa cere `NodeNext`.
- În `tsconfig.json` trebuie să rămână `"types": ["node"]`. Fără el, TypeScript 7 nu recunoaște `process` și `npm run build` dă eroare.
- Secretele (`JWT_SECRET`, parola bazei de date) stau în `.env`, care **nu** se urcă în repo. În repo se urcă doar `.env.example`.
- În Docker backend-ul rulează cu `NODE_ENV=production` și **nu pornește** fără `JWT_SECRET` (minim 32 de caractere) în `.env`-ul din rădăcină. Local, cu `npm run dev`, poate lipsi.
- Clientul Prisma se importă din `src/lib/prisma.ts`: `import { prisma } from "./lib/prisma.js"`.
- Pentru Docker, baza de date e disponibilă local pe portul **5433**, nu 5432.
