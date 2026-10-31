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
