# DogApp Frontend — Ghid de Handoff UI/UX (pentru Vlad)

Acest document descrie arhitectura funcțională, fluxurile implementate, contractele de interacțiune și regulile de separare a codului pentru prototipul frontend-only **DogApp** (Angular 22 + TypeScript + SCSS), pregătit pentru redesign-ul UI/UX.

---

## A. Application Overview

**DogApp** este o aplicație web comunitară pentru proprietarii de câini din Cluj-Napoca. Versiunea actuală este un **demo interactiv 100% frontend-only**, care rulează complet în browser fără backend, fără bază de date, fără Docker, fără apeluri REST API, fără WebSockets și fără JWT.

Toată logica de business și datele sunt gestionate centralizat prin Angular Signals în [`DemoStateService`](src/app/core/state/demo-state.service.ts) și persistate automat în `localStorage` sub cheia versionată `dogapp.demo.state.v1`. Aplicația include:
- Autentificare simulată și **account switcher** instant în header (`Ana Pop`, `Mihai Ionescu`, `Elena Rusu`, `Andrei Mureșan`, plus conturi noi înregistrate local).
- Căutare avansată de câini compatibili cu filtre de rasă, talie, temperament, vârstă, sterilizare și distanță aproximativă.
- Profiluri publice pentru câini și utilizatori, gestionarea propriului profil, CRUD pentru câinii proprii și `Block` / `Unblock`.
- Evenimente publice și private (`PLAYDATE`, `GROUP_WALK`, `BREED_MEETUP`), invitații private între conturi și per-dog RSVP cu verificare de capacitate.
- Mesagerie locală 1-la-1 cu unread counter, read tracking și opțiune de simulated reply.
- Modul de îngrijire (`/care`) cu sfaturi zilnice personalizate (rasă + demo weather), memento-uri clasificate (`OVERDUE`, `DUE_SOON`, `FUTURE`), grafic SVG de greutate și CRUD pentru fișe medicale.
- Social Feed (`/feed`) cu postări, tag-uri pe câini proprii, imagini demo offline, Like/Unlike per utilizator, comentarii, ștergere permisă doar autorului și filtrare mutuală la block.
- Director opțional de locații dog-friendly (`/map`) cu filtrare pe categorii, detalii locație, external Google Maps directions și shortcut către crearea de evenimente.

---

## B. Complete Route Map

Toate rutele sunt definite în [`src/app/app.routes.ts`](src/app/app.routes.ts), cu `withComponentInputBinding()` activat în [`src/app/app.config.ts`](src/app/app.config.ts).

| Rută | Guard | Componentă | Scop |
| --- | --- | --- | --- |
| `/` | — | Redirect → `/search` | Ruta implicită |
| `/login` | `demoGuestGuard` | `LoginPageComponent` | Enter Demo instant, selecție rapidă cont demo, email login simulat |
| `/register` | `demoGuestGuard` | `RegisterPageComponent` | Înregistrare cont demo nou în `localStorage` cu consimțământ GDPR |
| `/search` | `demoAuthGuard` | `SearchPageComponent` | Căutare și filtrare câini + shortcut către Mesaje / Playdate |
| `/dogs/:id` | `demoAuthGuard` | `DogDetailPageComponent` | Profil detaliat câine, info rasă, acțiuni mesaj / invitație / block |
| `/profile` | `demoAuthGuard` | `ProfilePageComponent` | Editare profil propriu, CRUD câinii mei (`My Dogs`), listă utilizatori blocați |
| `/users/:id` | `demoAuthGuard` | `UserProfilePageComponent` | Profil public utilizator, câinii acestuia, acțiuni mesaj / playdate / block |
| `/events` | `demoAuthGuard` | `EventsPageComponent` | Listă evenimente cu tab-uri (`PUBLIC`, `ORGANIZED`, `INVITATIONS`, `ALL`) |
| `/events/new` | `demoAuthGuard` | `EventFormPageComponent` | Creare eveniment public sau playdate privat; acceptă query params |
| `/events/:id` | `demoAuthGuard` | `EventDetailPageComponent` | Detalii eveniment, invitații, per-dog RSVP, editare / anulare organizator |
| `/events/:id/edit` | `demoAuthGuard` | `EventFormPageComponent` | Editare eveniment (doar organizator) |
| `/messages` | `demoAuthGuard` | `MessagesPageComponent` | Listă conversații + pornire chat nou |
| `/messages/:id` | `demoAuthGuard` | `MessagesPageComponent` | Conversație activă, trimitere mesaje și marcare automată ca citit |
| `/care` | `demoAuthGuard` | `CarePageComponent` | Sfaturi zilnice rasă/vreme, reminders, grafic SVG greutate, fișe medicale CRUD |
| `/feed` | `demoAuthGuard` | `FeedPageComponent` | Feed comunitar: creare postări, imagini demo, like-uri, comentarii, ștergere |
| `/map` | `demoAuthGuard` | `PlacesMapPageComponent` | Director locații dog-friendly (Optional P2) cu filtre și link către evenimente |
| `**` | — | Redirect → `/search` | Fallback pentru rute inexistente |

---

## C. Feature Inventory

1. **Auth & Session (`DemoAuthService`, `LoginPageComponent`, `RegisterPageComponent`):**
   - `Enter Demo` ca Ana Pop (`user-ana`) sau alt cont predefinit (`user-mihai`, `user-elena`, `user-andrei`).
   - Login cu email din lista de utilizatori demo și înregistrare cont nou cu selecție cartier și checkbox de consimțământ.
   - `Account Switcher` în header: schimbă utilizatorul activ fără pierderea datelor și actualizează imediat toate paginile via Angular Signals.
   - `Reset Demo Data` și `Logout` în header (`App`).

2. **Search & Profiles (`SearchService`, `DogService`, `UserService`):**
   - Filtrare live după text (nume câine, rasă, proprietar, cartier), rasă, talie (`SMALL`, `MEDIUM`, `LARGE`, `GIANT`), temperament (`FRIENDLY`, `PLAYFUL`, `SHY`, `REACTIVE`), grupă de vârstă (`ALL`, `PUPPY`, `ADULT`, `SENIOR`), `neuteredOnly` și rază `maxDistanceKm`.
   - Excludere automată a propriilor câini și a utilizatorilor blocați bilateral (`isBlockedEitherWay`).
   - `ProfilePageComponent`: editare nume, cartier (actualizează coordonatele aproximative), bio; adăugare / editare / ștergere câini proprii cu confirmare inline și curățare automată a referințelor (`eventDogRsvps`, `healthRecords`, `posts.dogId`).
   - `Block` / `Unblock` între utilizatori cu ascundere mutuală în Search, Profil, Events, Messages și Feed.

3. **Events, Private Invitations & Dog RSVP (`EventService`):**
   - Creare evenimente `PUBLIC` (cu selecție `Place` din director) sau `PRIVATE` (playdate cu invitați și text locație), editare și anulare (doar organizator).
   - Validare strictă a datelor (`endsAt > startsAt` și protecție la date invalide) și a capacității (`maxParticipants >= 1` și nu mai mic decât numărul curent de câini `GOING`).
   - Acceptare/Refuz invitație (`ACCEPTED` cere cel puțin 1 câine selectat; `DECLINED` elimină RSVP-urile utilizatorului la acel eveniment).
   - Per-dog RSVP (`GOING`, `MAYBE`, `NOT_GOING`) cu verificare de capacitate maximă și blocare acțiuni pentru evenimente `CANCELLED`.

4. **Messaging (`MessageService`, `MessagesPageComponent`):**
   - Creare/deschidere conversație 1-la-1 cu alt utilizator (cu verificare existență și block).
   - Lista de conversații sortată după cel mai recent mesaj, cu `unreadCount` per utilizator și badge total în navbar.
   - Marcare automată `markAsRead` la deschiderea conversației `/messages/:id`.
   - Trimitere mesaj + checkbox opțional pentru răspuns simulat automat (`includeSimulatedReply`).

5. **Care Module (`CareService`, `CarePageComponent`):**
   - Selector de câine sincronizat automat cu `DogService.myDogs` (și stare empty cu link la `/profile` dacă utilizatorul nu are câini).
   - Sfat zilnic determinist bazat pe rasă (`breathingIssues`, `heatSensitive`, `energyLevel`), vârstă (`>= 7 yrs`) și meteo demo (`14°C · Crisp autumn sun in Cluj-Napoca (Demo Weather)`), însoțit de disclaimer medical (`MEDICAL_DISCLAIMER_TEXT`).
   - Memento-uri (`getReminders`) calculate față de `DEMO_REFERENCE_DATE_ISO` în statusuri `OVERDUE`, `DUE_SOON` (0–14 zile) și `FUTURE` (>14 zile).
   - Grafic SVG inline pentru istoricul de greutate (`0`, `1` sau `N` puncte fără erori de împărțire la zero).
   - CRUD fișe medicale (`VACCINE`, `DEWORMING`, `VET_VISIT`, `WEIGHT`) cu filtrare pe tip, validări (`nextDueDate >= date`, `weightKg > 0`) și verificare ownership.

6. **Social Feed (`FeedService`, `FeedPageComponent`, `DEMO_POST_IMAGES`):**
   - Publicare postări cu conținut obligatoriu, etichetare opțională a unui câine propriu și selecție imagine demo offline SVG data-URI + preview live.
   - Afișare avatar sau inițiale fallback, link către profil autor (`/users/:id`) și câine etichetat (`/dogs/:id`).
   - Toggle `Like` / `Unlike` per utilizator, comentarii cronologice cu validare text non-empty, ștergere permisă exclusiv autorului cu confirmare inline și filtrare mutuală la `Block`.

7. **Places Directory / Map (`PlaceService`, `PlacesMapPageComponent`):**
   - Listă offline de locații din Cluj-Napoca (`SEED_PLACES`), filtrare pe categorie (`PARK`, `DOG_PARK`, `CAFE`, `VET`, `PET_SHOP`) și search text, detalii complete, link Google Maps Directions și buton `Create Event Here` spre `/events/new?placeId=...`.

---

## D. Angular Architecture

Structura proiectului în `frontend/src/app/`:

- `core/models/` — Interfețe TypeScript, tipuri enum și `*View` contracts (`enums.ts`, `user.model.ts`, `dog.model.ts`, `event.model.ts`, `messaging.model.ts`, `care.model.ts`, `feed.model.ts`, `place.model.ts`, `search.model.ts`, `demo-state.model.ts`, re-exportate prin `index.ts`).
- `core/mock-data/` — Date seed deterministe (`seed-users.ts`, `seed-breeds.ts`, `seed-dogs.ts`, `seed-places.ts`, `seed-events.ts`, `seed-care.ts`, `seed-social.ts`, `demo-images.ts`, agregate în `demo-seed.ts`).
- `core/state/demo-state.service.ts` — Single source of truth pe bază de Angular Signal (`state`), allocator determinist de ID-uri (`allocateId`), persistare `localStorage` (`dogapp.demo.state.v1`), validare structură envelope la încărcare și `resetDemoData`.
- `core/services/` — Servicii de domeniu stateless peste `DemoStateService` (`DemoAuthService`, `UserService`, `DogService`, `SearchService`, `EventService`, `MessageService`, `CareService`, `FeedService`, `PlaceService`) + suitele de teste `step2-flows.spec.ts`, `step3-flows.spec.ts`, `step4-flows.spec.ts`, `step5-flows.spec.ts`.
- `core/guards/` — Functional route guards (`demoAuthGuard`, `demoGuestGuard`).
- `shared/utils/` — Utilitare pure fără side-effects: `date.util.ts` (`DEMO_REFERENCE_DATE_ISO`, `offsetDemoDateOnly`, `offsetDemoDateIso`, `offsetDemoLocalDateTime`, `isWithinNextDays`), `dog-age.util.ts`, `distance.util.ts`, `clone.util.ts`.
- `features/` — Smart standalone page components organizate pe domeniu (`auth/`, `search/`, `dogs/`, `profile/`, `events/`, `messages/`, `care/`, `feed/`, `places/`).
- `app.ts`, `app.html`, `app.scss`, `styles.scss` — App shell (header cu navbar, badge-uri reactive, account switcher, Reset Demo Data, Logout) și clase CSS utilitare globale.

---

## E. Mock Data and State

- **Cheie `localStorage`:** `dogapp.demo.state.v1` cu `DEMO_STORAGE_VERSION = 1`.
- **Recuperare la corupere:** Dacă JSON-ul din `localStorage` este invalid sau nu trece de `isValidEnvelope()`, `DemoStateService` reinițializează automat starea cu `createInitialDemoState()`.
- **Date relative la `DEMO_REFERENCE_DATE_ISO`:** Constanta este `'2026-11-11T12:00:00.000Z'` în [`src/app/shared/utils/date.util.ts`](src/app/shared/utils/date.util.ts). Toate evenimentele seed (`seed-events.ts`), fișele/memento-urile seed (`seed-care.ts`), calculul vârstei câinilor (`dog-age.util.ts`) și valorile implicite ale formularelor (`CarePageComponent`, `EventFormPageComponent`) folosesc această constantă sau funcțiile `offsetDemo*`. Astfel:
  - Demo-ul poate fi rulat și în ianuarie 2027+ fără ca evenimentele seed să expire față de ceasul sistemului;
  - Pentru a muta toată cronologia demo într-un alt an/lună la prezentare, este suficient să actualizezi valoarea `DEMO_REFERENCE_DATE_ISO` într-un singur loc.
- **Conturi demo predefinite (`DEMO_ACCOUNT_OPTIONS`):**
  1. `user-ana` — Ana Pop (`ana.pop@demo.dogapp`, Centru) · câini: Rex, Bella; are invitație `PENDING` (`event-3`) și mesaj necitit (`conv-ana-mihai`).
  2. `user-mihai` — Mihai Ionescu (`mihai.ionescu@demo.dogapp`, Mănăștur) · câine: Max (`REACTIVE`); organizator playdate `event-3`.
  3. `user-elena` — Elena Rusu (`elena.rusu@demo.dogapp`, Gheorgheni) · câini: Luna, Coco; organizator meetup `event-2`.
  4. `user-andrei` — Andrei Mureșan (`andrei.muresan@demo.dogapp`, Zorilor) · câine: Rocky; organizator cafe social `event-6`.
  - În seed mai există și `user-radu`, `user-ioana`, `user-mara` (accesibili prin login cu email sau ca participanți/autori în datele seed).

---

## F. Component Interaction Contracts

- **App Shell (`App` in `app.ts` / `app.html`):**
  - Consumă `currentUser`, `isAuthenticated`, `demoAccounts`, `switcherOptions`, `unreadMessagesCount`, `pendingInvitationsCount`.
  - Acțiuni expuse template-ului: `onSwitchAccount($event)`, `onResetDemoData()`, `onLogout()`.
- **Route & Query Parameter Inputs (via `withComponentInputBinding()`):**
  - `DogDetailPageComponent`: `id = input<string>()`.
  - `UserProfilePageComponent`: `id = input<string>()`.
  - `EventDetailPageComponent`: `id = input<string>()`.
  - `EventFormPageComponent`: route param `id = input<string>()` (edit mode) + query params `inviteUserId`, `type`, `visibility`, `placeId` (create mode).
  - `MessagesPageComponent`: route param `id = input<string>()` (active conversation ID).
- **Navigații cross-feature esențiale de păstrat în template-urile noi:**
  - `/search` și `/dogs/:id` și `/users/:id` → `onSendMessage(...)` / `onInviteToPlaydate(...)` (nu înlocui cu link-uri statice fără `queryParams` sau creare conversație!).
  - `/map` → `Create Event Here` navighează la `/events/new` cu `[queryParams]="{ placeId: place.id, visibility: 'PUBLIC', type: 'GROUP_WALK' }"`.
  - `/care` empty state (0 dogs) → link către `/profile`; formularul păstrează câmpul condițional `weightKg` când `recordForm.controls.type.value === 'WEIGHT'`.
  - `/feed` → link-uri pe autor `/users/:id` și pe câine `/dogs/:id`; confirmare inline înainte de `confirmDeletePost(...)`; `item.canDelete` ascunde butonul de ștergere pentru alți utilizatori.
- **FormGroup contracts:** Formularele Reactive Forms (`loginForm`, `registerForm`, `profileForm`, `dogForm`, `eventForm`, `recordForm`, `postForm`) sunt definite în `.ts` și legate în `.html` prin `[formGroup]` și `formControlName`. Păstrează numele controalelor și semnalele `(ngSubmit)` / `(submit)` dacă modifici structura HTML.

---

## G. Files Vlad Can Modify

Vlad poate redesena liber layout-ul, structura HTML, clasele CSS, componentele vizuale și token-urile de design în:
- `frontend/src/styles.scss` și `frontend/src/index.html` (fonturi, theme variables, grid-uri, card-uri, butoane, responsive design)
- `frontend/src/app/app.html` și `frontend/src/app/app.scss` (navbar, sidebar, mobile drawer — păstrând legăturile din `App`)
- Toate fișierele `*.html` și eventualele noi `*.scss` din `frontend/src/app/features/**`:
  - `features/auth/login-page.html`, `register-page.html`
  - `features/search/search-page.html`
  - `features/dogs/dog-detail-page.html`
  - `features/profile/profile-page.html`, `user-profile-page.html`
  - `features/events/events-page.html`, `event-detail-page.html`, `event-form-page.html`
  - `features/messages/messages-page.html`
  - `features/care/care-page.html`
  - `features/feed/feed-page.html`
  - `features/places/places-map-page.html`
- Poate adăuga componente prezentationale noi (ex: sub `src/app/shared/components/`) pentru UI (avatar, badge-uri, card-uri, modaluri), atâta timp cât păstrează binding-urile către proprietățile și metodele componentelor smart `*-page.ts`.

---

## H. Files Vlad Should Preserve

Nu modifica fără coordonare următoarele directoare/fișiere (conțin logica de business, starea, persistarea și testele automate):
- `frontend/src/app/core/state/demo-state.service.ts`
- `frontend/src/app/core/services/*.ts` (`DemoAuthService`, `UserService`, `DogService`, `SearchService`, `EventService`, `MessageService`, `CareService`, `FeedService`, `PlaceService`)
- `frontend/src/app/core/models/*.ts`
- `frontend/src/app/core/mock-data/*.ts`
- `frontend/src/app/core/guards/*.ts`
- `frontend/src/app/shared/utils/*.ts`
- `frontend/src/app/app.routes.ts` și `frontend/src/app/app.config.ts`
- Testele `*.spec.ts` (sau actualizează testele doar dacă modifici voit texte verificate în assertion-uri UI; evită schimbarea semanticii fără re-rularea `npx ng test --watch=false`)
- În fișierele `*-page.ts`, evită modificarea semnelor `input()`, `FormGroup`, `computed()` și a metodelor apelate din template.

---

## I. Demo Scenarios

Walkthrough complet pentru prezentarea live (19 pași):
1. Pornește aplicația (`npm start`) și apasă **Enter Demo as Ana Pop** în `/login`.
2. În `/search`, caută `Luna` și verifică rezultatul pentru Luna (aparține Elenei Rusu).
3. Deschide profilul Lunei (`/dogs/dog-luna`) și apasă **Invite to Playdate**.
4. În `/events/new` (Elena preselectată), ajustează titlul/descrierea și selectează Rex ca participant.
5. Trimite formularul pentru a crea playdate-ul privat.
6. Din **Account Switcher** (header), schimbă pe **Elena Rusu (Gheorgheni)**.
7. Intră la `Events` (badge notificare invitații) → `Invitations` → deschide playdate-ul, bifează `Luna` și apasă **Accept Invitation**.
8. Comută înapoi pe **Ana Pop (Centru)** din header.
9. Verifică în pagina evenimentului că atât `Rex`, cât și `Luna` apar ca `GOING` și capacitatea s-a actualizat.
10. Din detaliul evenimentului sau al Lunei, apasă **Send Message** pentru a deschide `/messages/:id` cu Elena.
11. Trimite un mesaj către Elena.
12. Comută pe **Elena Rusu**, verifică badge-ul `Messages`, deschide conversația și confirmă mesajul primit și resetarea unread count.
13. Revino pe **Ana Pop**, deschide `/profile`, adaugă un câine nou și apoi editează-i numele sau detaliile.
14. Navighează la `/care`, selectează câinele nou (sau pe `Rex`) și adaugă un `Weight` record cu o dată viitoare (`nextDueDate`).
15. Verifică actualizarea instantă a graficului SVG `Weight History` și apariția reminder-ului în secțiunea `Upcoming & Overdue Reminders`.
16. Navighează la `/feed`, creează o postare cu text, tag pe un câine propriu și opțional o imagine demo.
17. Comută pe **Elena Rusu**, apasă **Like** pe postarea Anei și adaugă un comentariu.
18. Dă **Refresh (F5)** în browser și confirmă că sesiunea, postarea, like-ul, comentariul, câinele, mesajele și evenimentul au rămas salvate în `localStorage`.
19. Apasă **Reset Demo Data** în header și verifică revenirea completă la datele inițiale de demo.

*(Bonus opțional Map)*: Navighează la `/map`, filtrează după `Dog Parks`, selectează un parc și apasă **Create Event Here** pentru a deschide `/events/new` cu locația preselectată.

---

## J. Known Limitations

- **Fără backend / persistare reală multi-device:** Datele trăiesc exclusiv în browserul curent (`localStorage` sub `dogapp.demo.state.v1`). Incognito sau alt browser pornește cu seed-ul inițial.
- **Upload foto real neimplementat:** Avatarurile folosesc inițiale fallback dacă `avatarUrl` este `null`, iar pozele din Feed se aleg dintr-o listă fixă de SVG data-URI offline (`DEMO_POST_IMAGES`).
- **Map este un director de locații offline (Optional P2):** `/map` nu integrează Leaflet, Google Maps SDK sau tiles externe; oferă căutare, filtrare pe categorii, detalii locație, shortcut la evenimente și link extern Google Maps Directions.
- **Weather & Medical Tips simulate:** Cardul de îngrijire zilnică în `/care` folosește meteo static demo (`14°C · Crisp autumn sun in Cluj-Napoca (Demo Weather)`) și reguli deterministe; conține explicit disclaimer medical.
- **Chat în timp real simulat:** Mesajele nu folosesc WebSockets; comunicarea între conturi se verifică prin switcher-ul de cont sau prin bifa `simulated reply`.
- **Browser E2E automat neconfigurat:** Testele automate rulează cu Vitest + Angular TestBed + `jsdom`; verificarea vizuală/responsive completă în Chrome/Edge se face manual după rularea `npm start`.

---

## K. Development Instructions

### Cerințe mediu
- **Node.js 24 LTS** (Angular CLI `22.2.5` necesită Node >= 22/24; pe mașina curentă este instalat prin `fnm` cu Node `v24.22.2`).

### Comenzi principale (din directorul `frontend/`)

```powershell
# Activare Node 24 dacă folosești fnm
fnm use 24

# 1. Instalare dependențe (dacă node_modules nu există)
npm install

# 2. Pornire server local de dezvoltare
npm start
# Aplicația rulează implicit la http://localhost:4200

# 3. Build de producție
npm run build

# 4. Rulare teste automate (single-run, fără watch)
npx ng test --watch=false
```

### Resetare date demo în browser
- Din UI: apasă butonul **Reset Demo Data** din header.
- Manual din DevTools Console: `localStorage.removeItem('dogapp.demo.state.v1'); location.reload();`
