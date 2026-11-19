# ✅ Taskuri backend

Lista e dedusă din [`prisma/schema.prisma`](prisma/schema.prisma) și din funcționalitățile deja implementate în frontend (vezi [`frontend/UIUX_HANDOFF.md`](../frontend/UIUX_HANDOFF.md)). Scopul: tot ce face acum frontend-ul cu date mock în `localStorage` trebuie mutat pe server.

**Stare curentă:** există doar `GET /api/health`. Schema (16 tabele), migrarea și seed-ul sunt gata.

Fiecare task se face pe branch-ul lui (`feature/<nume>`) și intră în `main` prin Pull Request.

---

## 0. Fundație ⚠️ (se face primul, blochează restul)

- [ ] Structura `routes/` → `controllers/` → `services/`
- [ ] Middleware central de erori și un format unic de răspuns / eroare
- [ ] Validarea body-ului și a query params (de ex. `zod`)
- [ ] Middleware JWT `requireAuth`, care pune utilizatorul curent pe `req`
- [ ] Funcții comune: `isBlockedEitherWay(a, b)`, rotunjirea coordonatelor la 2 zecimale, paginare

## 1. Auth

- [ ] `POST /api/auth/register`: parolă cu bcrypt, `consentAt` (GDPR), locație aproximativă rotunjită
- [ ] `POST /api/auth/login`: întoarce JWT
- [ ] `GET /api/auth/me`

## 2. Utilizatori, block și raportări

- [ ] `GET /api/users/me`, `PATCH /api/users/me`
- [ ] `GET /api/users/:id`: profil public cu câinii utilizatorului (ascuns dacă există block)
- [ ] `DELETE /api/users/me`: în aceeași tranzacție, evenimentele organizate trec pe `CANCELLED`
- [ ] `POST /api/blocks/:userId`, `DELETE /api/blocks/:userId`, `GET /api/blocks`
- [ ] `POST /api/reports` (pe un utilizator sau pe o postare)

## 3. Rase și câini

- [ ] `GET /api/breeds`
- [ ] `GET /api/dogs/:id`
- [ ] `POST /api/dogs`, `PATCH /api/dogs/:id`, `DELETE /api/dogs/:id` (doar proprietarul)

## 4. Căutare

- [ ] `GET /api/search/dogs` cu filtre: text, rasă, talie, temperament, grupă de vârstă (`PUPPY` / `ADULT` / `SENIOR`), `neuteredOnly`, `maxDistanceKm` (haversine)
- [ ] Exclude câinii proprii și utilizatorii blocați în oricare direcție
- [ ] Paginare

## 5. Evenimente și RSVP

- [ ] CRUD evenimente + anulare (doar organizatorul)
- [ ] Listă cu tab-urile `PUBLIC` / `ORGANIZED` / `INVITATIONS` / `ALL`
- [ ] Validări: `endsAt > startsAt`, `maxParticipants >= 1` și nu mai mic decât numărul de câini `GOING`
- [ ] Invitații la playdate-uri private: acceptare (cere cel puțin un câine) / refuz (șterge RSVP-urile)
- [ ] RSVP per câine (`GOING` / `MAYBE` / `NOT_GOING`), cu verificarea capacității într-o tranzacție
- [ ] Nicio acțiune permisă pe evenimente `CANCELLED`

## 6. Mesagerie

- [ ] `GET /api/conversations`: sortate după ultimul mesaj, cu `unreadCount` (din `lastReadAt`)
- [ ] `POST /api/conversations`: deschide conversația 1-la-1 sau o întoarce pe cea existentă (cu verificare de block)
- [ ] `GET /api/conversations/:id/messages`, `POST /api/conversations/:id/messages`
- [ ] `POST /api/conversations/:id/read`
- [ ] `GET /api/messages/unread-count` (badge-ul din meniu)
- [ ] De decis: polling sau WebSocket (pentru demo ajunge polling-ul)

## 7. Îngrijire

- [ ] CRUD fișe medicale (`VACCINE` / `DEWORMING` / `VET_VISIT` / `WEIGHT`), cu verificarea proprietarului
- [ ] Validări: `nextDueDate >= date`, `weightKg > 0` (obligatoriu la `WEIGHT`)
- [ ] `GET /api/dogs/:id/reminders`: statusuri `OVERDUE` / `DUE_SOON` (0–14 zile) / `FUTURE`
- [ ] `GET /api/dogs/:id/weight-history`
- [ ] `GET /api/dogs/:id/daily-tip`: după rasă (`heatSensitive`, `breathingIssues`, `energyLevel`), vârstă și vreme (opțional, de la un API meteo, de ex. Open-Meteo)

## 8. Feed

- [ ] `GET /api/posts`: paginat, fără postările utilizatorilor blocați
- [ ] `POST /api/posts` (câine etichetat opțional, doar dintre câinii proprii)
- [ ] `DELETE /api/posts/:id` (doar autorul)
- [ ] `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like`
- [ ] `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- [ ] Upload de imagini (opțional)

## 9. Hartă / locuri (prioritate mică)

- [ ] `GET /api/places` (filtru pe categorie + căutare text), `GET /api/places/:id`
- [ ] Script de import din OpenStreetMap (deduplicare pe `osmId`)
- [ ] `POST /api/places/:id/reviews`, după ce utilizatorul a participat la un eveniment acolo

## 10. Transversale

- [ ] Seed-ul (5 utilizatori, 8 câini) aliniat cu conturile demo din frontend
- [ ] Documentație API (Swagger / OpenAPI)
- [ ] Teste de integrare (de ex. vitest + supertest), mai ales pentru evenimente / RSVP și block

---

## 👥 Propunere de împărțire

| Membru | Taskuri |
|---|---|
| Gabriel F. | 0 Fundație · 1 Auth · 2 Utilizatori, block, raportări · 6 Mesagerie |
| Gabriel G. | 3 Rase și câini · 4 Căutare · 7 Îngrijire |
| Sebastian | 5 Evenimente și RSVP · 8 Feed · 9 Hartă |

Taskurile din secțiunea 10 se împart între toți. Fundația intră prima în `main`, apoi fiecare lucrează pe branch-ul lui peste ea.
