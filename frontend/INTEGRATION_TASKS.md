# 🔌 Legarea frontend-ului de backend

**Scopul:** fiecare serviciu din `core/services/` să citească și să scrie prin API, iar la final `DemoStateService` și `core/mock-data/` să dispară. Backend-ul e gata: toate rutele sunt în Swagger, la `http://localhost:3000/api/docs`.

## 📍 Unde suntem

| Ce | Cine | Stare |
|---|---|---|
| 0 Fundație | Otniel | ✅ în `main` (#27) |
| 1 Auth și sesiune | Otniel | ✅ în `main` (#28) |
| 8 Mesagerie | Otniel | ✅ în `main` (#29) |
| 2 Profil, câini, block, raportări | **Vlad** | 🟢 se poate începe |
| 3 Căutare | **Vlad** | 🟢 se poate începe |
| 4 Îngrijire | **Vlad** | 🟢 se poate începe |
| 5 Evenimente și RSVP | **Tibi** | 🟢 se poate începe |
| 6 Feed | **Tibi** | 🟢 se poate începe |
| 7 Hartă / locuri | **Tibi** | 🟢 se poate începe |
| 9 Final | Otniel | ⏳ după ce intră toate modulele |

**Fundația, auth-ul și mesageria sunt în `main`: Vlad și Tibi pot începe acum.**

---

## 🚀 Cum începeți

1. Luați ultimul `main` (`git switch main` și `git pull`), apoi faceți ramura voastră din el: `feature/fe-<modul>` (de ex. `feature/fe-search`, `feature/fe-feed`). În `frontend/` rulați `npm install`.
2. Porniți backend-ul: `docker compose up -d` din rădăcina repo-ului. Apoi, din `frontend/`: `npm start` (aplicația pe `http://localhost:4200`; `/api` merge automat la backend prin `proxy.conf.json`).
3. Logați-vă cu un cont demo: butoanele de pe pagina de login, sau de ex. `ana.pop@demo.dogapp` / parola `pass1`. Sunt 7 conturi (Ana, Mihai, Elena, Andrei, Ioana, Radu, Mara).
4. Citiți secțiunea **„Legarea de backend”** din `frontend/README.md` și exemplul `core/api/breed-api.service.ts`.
5. Deschideți Swagger-ul (`/api/docs`): pentru fiecare rută vedeți exact ce trimiteți și ce primiți. Puteți apela rutele direct de acolo (login → copiați `token` → **Authorize**).

---

## 📏 Reguli comune

- **Contractul e Swagger-ul.** Câmpurile, statusurile și codurile de eroare se iau de la `/api/docs`, nu din mock-uri.
- **Tipurile din API:** `ApiModel<'Dog'>`, `ApiModel<'Event'>`, `ApiModel<'Post'>`... din `core/api/api.types.ts` (generate din Swagger în `schema.ts`). Nu le rescrieți de mână. Dacă backend-ul se schimbă: `npm run api:types` (cu backend-ul pornit).
- **Toate cererile prin `ApiService`** (`get`, `getPage`, `post`, `put`, `patch`, `delete`). Nimeni nu folosește `HttpClient` direct. Token-ul îl pune interceptorul.
- **Serviciile întorc `Observable`.** Starea o ține componenta:
  - citiri: `rxResource({ stream: () => this.api.list() })` → `isLoading()`, `error()`, `value()`;
  - scrieri: `subscribe({ next, error })`, cu un signal `submitting` care dezactivează butonul.
- **Erorile** sunt `ApiError`: verificați `err.code` (`NOT_FOUND`, `FORBIDDEN`, `CONFLICT`...), nu textul. La formulare, `err.fieldError('name')` dă mesajul pentru câmpul respectiv. Mesajele pentru utilizator le alegeți voi după `code` (vezi `chatErrorMessage` din `features/messages/messages-page.ts`).
- **Utilizatorul curent:** în paginile mutate pe API folosiți `AuthService.user()` (din `core/auth/auth.service.ts`), care are id-ul real. `DemoAuthService` rămâne doar pentru paginile încă pe mock-uri.
- **Id-urile sunt UUID-uri** generate de server, nu `user-ana` / `dog-rex`. Nimic nu se bazează pe id-uri fixe.
- **Distanțele, vârsta și „cine e blocat”** le calculează backend-ul. Logica din frontend pentru `isBlockedEitherWay`, haversine sau grupa de vârstă se șterge, nu se copiază.
- **Cartierul:** API-ul are doar coordonate. Folosiți `coordinatesOf(cartier)` (la trimitere) și `nearestNeighborhood(lat, lng)` (la afișare), din `core/auth/neighborhoods.ts`.
- **Deschiderea unui chat:** navigați la `/messages?with=<userId>`. Pagina de mesaje se ocupă de rest. Butoanele „Message” din căutare, câine, profil și eveniment fac deja asta.
- **Teste:** testele `step*-flows.spec.ts` testează mock-urile. Când mutați un modul, scoateți din ele părțile modulului vostru și scrieți teste noi cu `HttpTestingController`. Exemple: `core/api/api.spec.ts`, `core/services/message.service.spec.ts`.
- **Prettier doar pe fișierele voastre:** `npx prettier --write <fișierele modificate>`, nu pe foldere întregi, ca să nu reformatați codul altora și să nu apară conflicte.
- **PR-uri mici:** câte un PR pe modul. Înainte de PR: `npm test` și `npm run build` trec.

### Perioada de tranziție

Cât timp unele module sunt pe API și altele pe mock-uri, id-urile nu se potrivesc între ele (mock: `dog-luna`, API: UUID). Ca să stricăm cât mai puțin:

- **Vlad începe cu Căutarea și Câinii** (3, apoi 2): de acolo pleacă id-urile reale de câini și utilizatori spre restul paginilor.
- **Tibi începe cu Feed-ul și Harta** (6, 7), care depind mai puțin de alții, apoi Evenimentele (5).
- Un link dintr-o pagină mutată spre una încă pe mock-uri (sau invers) poate da „Not found” până se mută și cealaltă. E acceptabil pe durata tranziției; notați-l în PR.

---

## 0. Fundație ✅ — Otniel

- [x] `provideHttpClient(withInterceptors([authInterceptor]))` în `app.config.ts`
- [x] `ApiService` (`core/api/api.service.ts`): prefix `/api`, despachetează `{ data }` și `{ data, meta }` (`getPage<T, M>`), erorile devin `ApiError`
- [x] Interceptor: `Authorization: Bearer <token>`; la sesiune expirată → logout și `/login`
- [x] `proxy.conf.json` pentru `ng serve` (în Docker, nginx are deja proxy-ul)
- [x] Tipurile din Swagger (`npm run api:types` → `core/api/schema.ts`)
- [x] Exemplul de urmat: `BreedApiService` (`GET /breeds`) + secțiunea din README

## 1. Auth și sesiune ✅ — Otniel

- [x] `AuthService` real: login, register, logout; la pornire reface sesiunea din token (`GET /auth/me`)
- [x] `authGuard` (cu `returnUrl`) și `guestGuard` în locul guard-urilor demo
- [x] Login cu email + parolă și butoane pentru cele 7 conturi demo
- [x] Register cu parolă, cartier → coordonate, acord GDPR, erori de la API pe câmpuri
- [x] Selectorul de cont din header face login real cu contul demo ales
- [x] Punte temporară: utilizatorul real e oglindit în mock-uri (după email), ca paginile încă nemutate să meargă

## 2. Profil, câini, block, raportări — Vlad

- [ ] `UserService`: `GET/PATCH /users/me`, `GET /users/:id` (profil public cu câini; `404` = inexistent sau blocat)
- [ ] Cartierul: afișat cu `nearestNeighborhood(...)`, trimis la editare cu `coordinatesOf(...)` ca `latitude` / `longitude`
- [ ] `DELETE /users/me` cu confirmare și parolă (`403 INVALID_PASSWORD`), apoi `AuthService.logout()`
- [ ] `DogService`: `GET /dogs/:id`, `POST /dogs`, `PATCH /dogs/:id`, `DELETE /dogs/:id`. Rasele: `BreedApiService` (există deja). „Câinii mei” vin din `GET /users/:id` cu id-ul meu
- [ ] Block: `GET /blocks`, `POST /blocks/:userId`, `DELETE /blocks/:userId`
- [ ] Raportare: buton „Report” pe profil și pe postare → `POST /reports` (`409 ALREADY_REPORTED` → „deja raportat”)
- [ ] După `PATCH /users/me`, numele din header se actualizează (de discutat cu Otniel: o metodă `AuthService.refreshUser()`)
- [ ] Pagini: `profile`, `user-profile`, `dog-detail`

## 3. Căutare — Vlad (prima)

- [ ] `SearchService`: `GET /search/dogs` cu `getPage`, filtrele ca query params (`q`, `breedId`, `size`, `temperament`, `ageGroup`, `neuteredOnly`, `maxDistanceKm`, `page`, `pageSize`). Valorile goale nu se trimit (le scoate `ApiService`)
- [ ] Paginare din `meta` (`page`, `totalPages`): butoane sau „Load more”
- [ ] Debounce pe câmpul de text (~300 ms)
- [ ] `distanceKm`, `ageGroup`, `owner` vin gata din API
- [ ] Dropdown-ul de rase din `BreedApiService`
- [ ] Pagina `search`

## 4. Îngrijire — Vlad

- [ ] `CareService`: `GET/POST /dogs/:id/health-records`, `PATCH/DELETE /dogs/:id/health-records/:recordId`
- [ ] `GET /dogs/:id/reminders`, `GET /dogs/:id/weight-history` (graficul SVG rămâne, doar datele vin din API), `GET /dogs/:id/daily-tip`
- [ ] Erorile de validare pe câmpuri: `nextDueDate` înainte de `date`, `weightKg` lipsă la `WEIGHT`
- [ ] Vremea: API-ul nu are vreme. Eticheta „Demo Weather” se scoate până se decide
- [ ] Pagina `care`

## 5. Evenimente și RSVP — Tibi

- [ ] `EventService`: `GET /events?tab=PUBLIC|ORGANIZED|INVITATIONS|ALL`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id`, `POST /events/:id/cancel`
- [ ] Invitații: `POST /events/:id/invitations`, `POST /events/:id/invitations/respond` (la `DECLINED` răspunsul e doar `{ eventId, status }`, nu evenimentul)
- [ ] RSVP per câine: `PUT /events/:id/rsvp/:dogId` cu `GOING` / `MAYBE` / `NOT_GOING`
- [ ] Modelul: un singur `ApiModel<'Event'>` cu `participants`, `invitations`, `goingDogsCount`, `isFull`, `isOrganizer`, `currentUserInvitation`, `currentUserDogRsvps`. Nu se mai calculează nimic din acestea în frontend
- [ ] Erorile: `409` (eveniment plin, anulat), `403` (nu ești organizator / nu ești invitat), afișate lângă acțiunea respectivă
- [ ] Formularul: privat cere `locationText`; public cere `placeId` sau `locationText`. Query params-urile din „Invite to playdate” (`inviteUserId`) și „Create event here” (`placeId`) se păstrează
- [ ] Badge-ul de invitații din meniu (`pendingInvitationsCount`): din `GET /events?tab=INVITATIONS`, cele cu `currentUserInvitation.status === 'PENDING'`
- [ ] „Message organizer” face deja `/messages?with=<organizerId>`
- [ ] Pagini: `events`, `event-detail`, `event-form`

## 6. Feed — Tibi (primul)

- [ ] `FeedService`: `GET /posts` cu `getPage`, `POST /posts`, `DELETE /posts/:id`
- [ ] Like / unlike: `POST` / `DELETE /posts/:id/like` (contorul se actualizează imediat și revine la eroare)
- [ ] Comentarii: `GET` / `POST /posts/:id/comments`
- [ ] Imaginile demo (data-URI SVG) merg în `imageUrl`, maxim 100 KB. Upload real încă nu există
- [ ] `canDelete`, `isLikedByMe`, `likeCount`, `author`, `dog` vin din API
- [ ] Pagina `feed`

## 7. Hartă / locuri — Tibi

- [ ] `PlaceService`: `GET /places?type=&q=`, `GET /places/:id` (cu recenzii)
- [ ] Recenzie: `POST /places/:id/reviews`, doar după un eveniment la care ai participat acolo (`403` altfel, `409` dacă ai scris deja una)
- [ ] „Create event here” trimite `placeId`-ul real
- [ ] Pagina `places-map`. În baza locală locurile apar după `npm run osm:import` în `backend/`

## 8. Mesagerie ✅ — Otniel

- [x] Conversații, mesaje (cursor `before` pentru „Load older”), trimitere, marcare ca citit
- [x] Polling: mesaje noi la 4 s în conversația deschisă, lista și badge-ul de necitite la 15 s
- [x] Erorile `BLOCKED`, `CONVERSATION_CLOSED` afișate în chat; scos „simulated reply”
- [x] Alte pagini deschid un chat cu `/messages?with=<userId>`
- [x] Punte temporară: id-urile demo sunt traduse în utilizatorul real după nume

## 9. Final — Otniel

- [ ] Se șterg `DemoStateService`, `DemoAuthService`, `core/mock-data/`, „Reset Data” și punțile temporare (din `AuthService` și `MessageService`)
- [ ] Lista din „Start new chat” (acum din mock-uri): din conversațiile existente / profilul public
- [ ] Testul complet în Docker (`docker compose up -d --build`): toate fluxurile pe http://localhost:8080, cu 2 conturi în 2 browsere (evenimente, invitații, mesaje, block)
- [ ] `frontend/README.md` și `UIUX_HANDOFF.md` actualizate (aplicația nu mai e „frontend-only”)
- [ ] Bug-urile găsite la testul complet, împărțite înapoi pe module

---

## 👥 Împărțire

| Membru | Taskuri | Ordine |
|---|---|---|
| **Otniel** | 0 Fundație ✅ · 1 Auth ✅ · 8 Mesagerie ✅ · 9 Final | 9 la sfârșit |
| **Vlad** | 2 Profil, câini, block, raportări · 3 Căutare · 4 Îngrijire | 3 → 2 → 4 |
| **Tibi** | 5 Evenimente și RSVP · 6 Feed · 7 Hartă | 6 → 7 → 5 |

## ❓ Întrebări deschise

- **Vremea** în sfatul zilnic: o adăugăm în backend (Open-Meteo) sau renunțăm la ea?
- **Upload de imagini** (avatar, poze câini, postări): rămâne cu URL-uri sau facem upload real?
- **Selectorul de cont** din header: rămâne pentru prezentare (acum face login real cu conturile demo) sau îl scoatem la final?
