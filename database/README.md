# 🗄️ Bază de date

**PostgreSQL 18**, rulat în Docker (imaginea `postgres:18-alpine`).

**Responsabil:** Cătălin

## Configurare
Datele de acces (utilizator, parolă, nume bază de date) se pun în `.env` din rădăcina repo-ului, după modelul din [.env.example](../.env.example):

```
POSTGRES_USER=app
POSTGRES_PASSWORD=schimba_parola
POSTGRES_DB=app_db
```

Structura tabelelor e definită în [backend/prisma/schema.prisma](../backend/prisma/schema.prisma).

## Pornire și oprire
Din rădăcina repo-ului:

```bash
docker compose up -d db     # pornește doar baza de date
docker compose ps           # la db trebuie să scrie "healthy"
docker compose down         # oprește containerele
```

Datele se păstrează în volumul Docker `db-data`, deci nu se pierd la `docker compose down`. Se șterg doar cu `docker compose down -v`, așa că folosiți comanda asta doar dacă vreți intenționat o bază de date goală.

## Portul 5433
Baza de date din Docker e disponibilă pe PC la **`localhost:5433`**, nu pe portul standard 5432. Motivul: cine are PostgreSQL instalat direct pe Windows îl are deja pe 5432, iar cele două ar intra în conflict. Portul e deschis doar pe calculatorul propriu (`127.0.0.1`), nu în rețea.

În interiorul Docker, celelalte servicii (de ex. backend-ul) se conectează la adresa **`db:5432`**.

## Cum vă uitați în baza de date
PostgreSQL nu se deschide în browser. Variante:

- **Din terminal:**

      docker compose exec db psql -U app -d app_db

  Comenzi utile în `psql`: `\l` (baze de date), `\dt` (tabele), `\q` (ieșire).

- **pgAdmin / DBeaver:** server nou cu *Host* `localhost`, *Port* **`5433`**, utilizatorul și parola din `.env`.

- **Prisma Studio** (după ce backend-ul e conectat): `npx prisma studio` din `backend/`.

## Limite de resurse
În `compose.yaml`, baza de date are maximum **256 MB** de memorie (`mem_limit`), cu `shared_buffers=64MB` și cel mult 30 de conexiuni simultane. Suficient pentru dezvoltare și demo.
