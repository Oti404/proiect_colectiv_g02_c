# Proiect Colectiv – G02

Proiect realizat în cadrul disciplinei **Proiect Colectiv**, Facultatea de Matematică și Informatică, UBB Cluj-Napoca, anul III, semestrul 5 (2026–2027).

> 🚧 **Status:** structura proiectului e gata (frontend, backend, bază de date, Docker). Alegem ideea finală. Secțiunile marcate cu _TBD_ se completează după decizia echipei.

## 💡 Ideea

_TBD_. Candidat principal momentan: o aplicație pentru proprietarii de câini, care îi conectează după rasă și zonă (playdate-uri, chat, sfaturi de îngrijire în funcție de talie).

## 👥 Echipa

| Membru | Rol |
|---|---|
| Otniel | Manager de proiect |
| Tibi | UI/UX · Frontend |
| Gabriel F. | Backend |
| Gabriel G. | Backend |
| Sebastian | Backend |
| Cătălin | DevOps · Bază de date |
| Dan | QA · Documentație · Prezentare |
| Vlad | Frontend |

## 🛠️ Tehnologii

| Componentă | Tehnologie |
|---|---|
| Frontend | Angular 22 · SCSS |
| Backend | Node.js 24 LTS · Express 5 · TypeScript |
| ORM | Prisma 7 |
| Bază de date | PostgreSQL 18 |
| Autentificare | JWT · bcryptjs |
| Containerizare | Docker Compose · nginx |

## 📅 Calendar evaluare

| Etapă | Perioadă |
|---|---|
| Evaluarea progresului (misiuni Code of Talent) | 5 octombrie 2026 – 15 ianuarie 2027 |
| Evaluarea aplicației (prezentare de 15 min) | 16 – 17 ianuarie 2027 |
| Evaluarea individuală | 18 – 24 ianuarie 2027 |

Detalii despre notare: [docs/evaluare.md](docs/evaluare.md).

## 📚 Documentație

Toată documentația e în [docs/](docs/): evaluare, misiuni Code of Talent, idei de proiect și notițe de la ședințe.

Fiecare modul are README-ul lui: [frontend](frontend/README.md) · [backend](backend/README.md) · [bază de date](database/README.md).

## 📁 Structura repo-ului

```
├── frontend/      ← aplicația Angular (servită cu nginx în Docker)
├── backend/       ← API-ul Express + Prisma
├── database/      ← documentația bazei de date
├── docs/          ← documentația proiectului
├── compose.yaml   ← pornește toate serviciile cu Docker
└── .env.example   ← modelul pentru variabilele de mediu
```

## 🔀 Reguli de lucru

- **Nu facem push direct pe `main`.** Fiecare task are branch-ul lui: `feature/<nume>`, `fix/<nume>`.
- Orice modificare intră în `main` prin **Pull Request**, cu cel puțin **1 review** de la un coleg.
- Commit-uri mici, cu mesaje clare (ex. `feat: adaugă pagina de profil`).
- **Nu urcăm niciodată în repo** parole, chei API sau fișiere `.env`.

## 🚀 Rulare locală

### Cu Docker (toată aplicația)

Cerințe: **Docker Desktop** instalat și pornit (în fereastra lui trebuie să scrie *Engine running*).

1. Copiați `.env.example` în `.env` (în rădăcina repo-ului) și puneți o parolă:

       copy .env.example .env

2. Din rădăcina repo-ului:

       docker compose up -d --build

   Primul build durează câteva minute.

| Serviciu | Adresă |
|---|---|
| Frontend | http://localhost:8080 |
| Backend (API) | http://localhost:3000/api/health |
| Bază de date | `localhost:5433` (nu se deschide în browser, vezi [database/README.md](database/README.md)) |

Comenzi utile:

| Comandă | Ce face |
|---|---|
| `docker compose ps` | Arată ce containere rulează și dacă sunt sănătoase |
| `docker compose logs -f backend` | Arată live log-urile unui serviciu |
| `docker compose up -d --build frontend` | Reconstruiește un singur serviciu după modificări |
| `docker compose down` | Oprește tot (datele din baza de date rămân) |
| `docker stats --no-stream` | Arată memoria folosită de fiecare container |

### Fără Docker (pentru dezvoltare)

Fiecare modul se poate porni și separat, cu reîncărcare automată la modificări. Instrucțiunile sunt în [frontend/README.md](frontend/README.md) și [backend/README.md](backend/README.md).

Cerință: **Node.js 24.15.0 sau mai nou** (`node -v`).

### Probleme frecvente

- **`failed to connect to the docker API`**: Docker Desktop nu e pornit.
- **`ports are not available ... 5432`**: aveți PostgreSQL instalat pe Windows. De aceea folosim portul **5433** pentru baza de date din Docker.
- **Portul 3000 sau 8080 e ocupat**: opriți `npm run dev` / `npm start` înainte de `docker compose up`.
