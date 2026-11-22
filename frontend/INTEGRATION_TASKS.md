# 🔌 Legarea frontend-ului de backend

Acum frontend-ul nu face niciun apel la API. Toate datele vin din `core/mock-data/` și stau în `localStorage`, gestionate de [`DemoStateService`](src/app/core/state/demo-state.service.ts). Backend-ul e gata: toate rutele sunt documentate în Swagger la `http://localhost:3000/api/docs`.

**Scopul:** fiecare serviciu din `core/services/` să citească și să scrie prin API, iar la final `DemoStateService` și `mock-data/` să dispară.

Fiecare task se face pe branch-ul lui (`feature/fe-<modul>`) și intră în `main` prin Pull Request. **Fundația (secțiunea 0) intră prima**, restul se construiește peste ea.

---

## Reguli comune

- **Contractul e Swagger-ul.** Câmpurile, statusurile și codurile de eroare se iau de la `/api/docs`, nu din mock-uri. Unde modelele din `core/models/` diferă de API, se schimbă modelul din frontend.
- **Un singur `ApiService`** pentru toate apelurile (din fundație). Nimeni nu folosește `HttpClient` direct în componente.
- **Serviciile întorc `Observable` (sau signals umplute din API)**, nu mai întorc sincron `ActionResult`. Componentele trebuie adaptate: stare de *loading*, mesaj de eroare, buton dezactivat cât timp se trimite.
- **Erorile** vin ca `{ error: { code, message, details? } }`. La `VALIDATION_ERROR`, `details` are câmpurile invalide, care se afișează lângă input-ul respectiv.
- **Id-urile sunt UUID-uri** generate de server, nu `user-ana` / `dog-rex`. Nimic nu se bazează pe id-uri fixe.
- **Distanțele și „cine e blocat”** le calculează backend-ul. Logica din frontend pentru `isBlockedEitherWay` sau haversine se șterge, nu se copiază.
- Testele `*.spec.ts` care testează mock-urile se rescriu cu `HttpTestingController` sau se șterg, odată cu modulul lor.

---

## 0. Fundație ⚠️ — Otniel (blochează restul)

- [ ] `provideHttpClient(withInterceptors(...))` în `app.config.ts`
- [ ] `ApiService` (`core/api/api.service.ts`): `get / post / patch / put / delete`, despachetează `{ data }` și `{ data, meta }`, transformă erorile într-un tip `ApiError { status, code, message, details }`
- [ ] Interceptor care pune `Authorization: Bearer <token>`. La `401` (`INVALID_TOKEN`, `TOKEN_EXPIRED`): logout și redirect la `/login`
- [ ] URL de bază `/api`, plus `proxy.conf.json` pentru `ng serve` (`/api` → `http://localhost:3000`). În Docker, nginx are deja proxy-ul.
- [ ] Tipurile din API: generate din `/api/docs/openapi.json` (de ex. `openapi-typescript`) sau scrise de mână în `core/models/`
- [ ] Un exemplu complet de urmat de restul echipei: **Rase** (`GET /breeds`), cu loading și eroare

## 1. Auth și sesiune — Otniel

- [ ] `AuthService` real în locul lui `DemoAuthService`: `POST /auth/login`, `POST /auth/register`, `GET /auth/me`
- [ ] Token-ul salvat în `localStorage`. La pornirea aplicației, `GET /auth/me` reface sesiunea
- [ ] `authGuard` / `guestGuard` în locul lui `demoAuthGuard` / `demoGuestGuard`
- [ ] Register: cartierul ales se trimite ca `latitude` / `longitude` (din `NEIGHBORHOOD_COORDINATES`), plus `consentAccepted: true`. Erorile `409 EMAIL_TAKEN` și `400` pe câmp se afișează în formular
- [ ] Login: email + parolă (conturile demo au parola `pass1`). „Enter Demo” și account switcher-ul din header devin butoane de login rapid cu conturile demo sau dispar
- [ ] Logout: șterge token-ul și starea din memorie

## 2. Profil, câini, block, raportări — Vlad

- [ ] `UserService`: `GET/PATCH /users/me`, `GET /users/:id` (profil public cu câini; `404` = utilizator inexistent sau blocat)
- [ ] **Cartier:** API-ul are doar coordonate. Cartierul afișat se deduce din `approxLatitude/Longitude` (cel mai apropiat din `NEIGHBORHOOD_COORDINATES`); la editare se trimit coordonatele cartierului ales
- [ ] `DELETE /users/me` cu confirmare și parolă (`403 INVALID_PASSWORD`), apoi logout
- [ ] `DogService`: `GET /breeds`, `GET /dogs/:id`, `POST /dogs`, `PATCH /dogs/:id`, `DELETE /dogs/:id`. „Câinii mei” vin din profilul propriu (`GET /users/:id` cu id-ul meu)
- [ ] Block: `GET /blocks`, `POST /blocks/:userId`, `DELETE /blocks/:userId` (în profil și pe pagina altui utilizator)
- [ ] Raportare: buton „Report” pe profil și pe postare → `POST /reports` (`409 ALREADY_REPORTED` → mesaj „deja raportat”)
- [ ] Pagini: `profile`, `user-profile`, `dog-detail`

## 3. Căutare — Vlad

- [ ] `SearchService`: `GET /search/dogs` cu filtrele ca query params (`q`, `breedId`, `size`, `temperament`, `ageGroup`, `neuteredOnly`, `maxDistanceKm`, `page`, `pageSize`)
- [ ] Paginare din `meta` (`page`, `totalPages`): butoane sau „Load more”
- [ ] Debounce pe câmpul de text (~300 ms), ca să nu se trimită o cerere la fiecare tastă
- [ ] `distanceKm` și `ageGroup` vin gata calculate din API
- [ ] Pagina `search`

## 4. Îngrijire — Vlad

- [ ] `CareService`: `GET/POST /dogs/:id/health-records`, `PATCH/DELETE /dogs/:id/health-records/:recordId`
- [ ] `GET /dogs/:id/reminders`, `GET /dogs/:id/weight-history` (graficul SVG rămâne, doar datele vin din API), `GET /dogs/:id/daily-tip`
- [ ] Vremea: API-ul nu are încă vreme. Eticheta „Demo Weather” se scoate (sau se ascunde) până se decide
- [ ] Pagina `care`

## 5. Evenimente și RSVP — Tibi

- [ ] `EventService`: `GET /events?tab=PUBLIC|ORGANIZED|INVITATIONS|ALL`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id`, `POST /events/:id/cancel`
- [ ] Invitații: `POST /events/:id/invitations`, `POST /events/:id/invitations/respond` (la `DECLINED` răspunsul e `{ eventId, status }`, nu evenimentul)
- [ ] RSVP per câine: `PUT /events/:id/rsvp/:dogId` cu `GOING` / `MAYBE` / `NOT_GOING`
- [ ] Modelul: API-ul întoarce un singur `Event` cu `participants`, `invitations`, `goingDogsCount`, `isFull`, `isOrganizer`, `currentUserInvitation`, `currentUserDogRsvps`. `EventView` din frontend se aliniază la el
- [ ] Erorile de business afișate clar: `409` (eveniment plin, anulat), `403` (nu ești organizator / nu ești invitat)
- [ ] Formularul: un eveniment privat cere `locationText`, unul public cere `placeId` sau `locationText`. Query params-urile din „Invite to playdate” / „Create event here” trebuie păstrate
- [ ] Pagini: `events`, `event-detail`, `event-form`

## 6. Feed — Tibi

- [ ] `FeedService`: `GET /posts` paginat, `POST /posts`, `DELETE /posts/:id`
- [ ] Like / unlike: `POST` / `DELETE /posts/:id/like` (actualizare optimistă a contorului, cu revenire la eroare)
- [ ] Comentarii: `GET` / `POST /posts/:id/comments`
- [ ] Imaginile demo (data-URI SVG) merg în `imageUrl`, maxim 100 KB. Upload real de fișiere încă nu există
- [ ] `canDelete`, `isLikedByMe`, `likeCount` vin din API
- [ ] Pagina `feed`

## 7. Hartă / locuri — Tibi

- [ ] `PlaceService`: `GET /places?type=&q=`, `GET /places/:id` (cu recenzii)
- [ ] Recenzie: `POST /places/:id/reviews`, doar după un eveniment la care ai participat acolo (`403` altfel)
- [ ] Shortcut-ul „Create event here” trimite `placeId`-ul real
- [ ] Pagina `places-map`. În baza locală locurile apar după `npm run osm:import` în `backend/`

## 8. Mesagerie — Otniel

- [ ] `MessageService`: `GET /conversations`, `POST /conversations` (deschide sau întoarce conversația existentă), `GET /conversations/:id`
- [ ] Mesaje: `GET /conversations/:id/messages` (cursor `before` pentru scroll în sus), `POST /conversations/:id/messages`, `POST /conversations/:id/read`
- [ ] **Polling** (decis: fără WebSocket pentru demo): la câteva secunde, `GET .../messages?after=<ultimul id>` în conversația deschisă și `GET /messages/unread-count` pentru badge-ul din meniu. Polling-ul se oprește când utilizatorul pleacă de pe pagină sau dă logout
- [ ] `403 BLOCKED`, `409 CONVERSATION_CLOSED` afișate în chat
- [ ] Se scoate „simulated reply”
- [ ] Pagina `messages`

## 9. Final — Otniel

- [ ] Se șterg `DemoStateService`, `core/mock-data/`, „Reset Demo Data” și guard-urile demo
- [ ] Testul complet în Docker (`docker compose up -d --build`): toate fluxurile pe http://localhost:8080 cu 2 conturi demo în 2 browsere (evenimente, invitații, mesaje, block)
- [ ] `frontend/README.md` și `UIUX_HANDOFF.md` actualizate (aplicația nu mai e „frontend-only”)
- [ ] Lista de bug-uri găsite la testul complet, împărțită înapoi pe module

---

## 👥 Împărțire

| Membru | Taskuri |
|---|---|
| **Otniel** | 0 Fundație · 1 Auth · 8 Mesagerie · 9 Final |
| **Vlad** | 2 Profil, câini, block, raportări · 3 Căutare · 4 Îngrijire |
| **Tibi** | 5 Evenimente și RSVP · 6 Feed · 7 Hartă |

**Ordinea:** 0 + 1 intră primele în `main`. Până atunci, Vlad și Tibi pot citi Swagger-ul și pregăti modelele și componentele (stări de loading / eroare) pentru modulele lor.

## Întrebări deschise

- **Vremea** în sfatul zilnic: o adăugăm în backend (Open-Meteo) sau renunțăm la ea?
- **Upload de imagini** (avatar, poze câini, postări): rămâne cu URL-uri sau facem upload real?
- **Account switcher** în header: îl păstrăm ca login rapid pentru prezentare sau îl scoatem?
