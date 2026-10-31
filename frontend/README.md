# 🎨 Frontend

Interfața aplicației, realizată în **Angular 22** (generată cu Angular CLI 22.2.5).

**Echipa:** Tibi · Vlad

## Responsabilități
- Ecranele aplicației și navigarea între ele
- Comunicarea cu API-ul din [backend](../backend/)
- Design consistent și uniform pe toate paginile
- Aplicație responsive (desktop și telefon)

## Cerințe
- **Node.js 24.15.0 sau mai nou** (verificați cu `node -v`)

## Rulare locală

Toate comenzile se rulează din folderul `frontend/`.

```bash
npm install
npm start
```

Aplicația pornește la `http://localhost:4200` și se reîncarcă automat la fiecare modificare.

### Cu Docker

Din rădăcina repo-ului:

```bash
docker compose up -d --build frontend
```

Aplicația e disponibilă la `http://localhost:8080`. Imaginea se construiește în două etape: prima rulează `npm run build`, iar a doua servește fișierele rezultate cu **nginx** (configurat în `nginx.conf`). Cererile către `/api/` sunt trimise de nginx la backend, deci în cod adresele API-ului încep cu `/api/...`, fără `localhost:3000`.

După orice modificare în cod, imaginea trebuie reconstruită (comanda de mai sus). Pentru lucrul de zi cu zi e mai comod `npm start`.

## Comenzi utile

| Comandă | Ce face |
|---|---|
| `npm start` | Pornește serverul de dezvoltare |
| `npm run build` | Construiește aplicația pentru producție în `dist/` |
| `npm test` | Rulează testele unitare (Vitest) |
| `npx ng generate component features/<nume>` | Creează o componentă nouă |
| `npx ng generate service core/services/<nume>` | Creează un service nou |

## Structură propusă

```
frontend/
└── src/app/
    ├── core/        ← servicii globale (autentificare, interceptor HTTP, guards)
    ├── shared/      ← componente, pipe-uri și modele refolosite
    ├── features/    ← câte un folder pentru fiecare funcționalitate
    └── app.routes.ts
```

## Reguli
- Stilurile se scriu în **SCSS**.
- Componentele noi se pun în folderul potrivit din structura de mai sus, nu direct în `src/app/`.
- Codul se formatează cu **Prettier** (configurat în `.prettierrc`).
- `nginx.conf` și `Dockerfile` stau direct în `frontend/`, cu numele scrise exact așa (Docker face diferența între litere mari și mici).
