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

Structura tabelelor e definită în [backend/prisma/schema.prisma](../backend/prisma/schema.prisma). Diagrama bazei de date: [docs/diagrams/db-schema.md](../docs/diagrams/db-schema.md).

## Schema, migrări și date demo
- **16 tabele**, după diagrama de clase din [docs/diagrams/class-diagram.svg](../docs/diagrams/class-diagram.svg).
- **Migrările** sunt în `backend/prisma/migrations/` și se urcă în repo. Prima migrare conține și constrângerile `CHECK` pe care Prisma nu le poate declara în schemă (nota 1-5, un raport trebuie să aibă țintă, un eveniment se termină după ce începe etc.).
- **Date demo** (`backend/prisma/seed.ts`): 17 rase (inclusiv „Mixed breed"), 5 utilizatori din Cluj și 8 câini. Conturile demo sunt `user1@demo.local` ... `user5@demo.local` (Ana Pop, Mihai Ionescu, Elena Rusu, Andrei Mureșan, Ioana Cristea), toate cu parola `pass1`.
- **Cu Docker nu trebuie făcut nimic manual:** serviciul `migrate` din `compose.yaml` aplică migrările și rulează seed-ul la fiecare `docker compose up`, înaintea backend-ului. Seed-ul se poate rula de oricâte ori.
- **Fără Docker pentru backend** (baza rămâne în Docker): din `backend/` rulați `npx prisma migrate dev` și `npx prisma db seed`.

### Reguli de ștergere
- Ștergerea unui utilizator șterge în cascadă câinii, postările, like-urile, comentariile, jurnalul de sănătate, blocările, rapoartele, recenziile și participările lui. Asta înseamnă „șterge-mi contul" (GDPR).
- Mesajele rămân, cu expeditorul gol (se afișează „Utilizator șters"). La evenimente, organizatorul devine gol, iar backend-ul trece evenimentul pe `CANCELLED`.
- O rasă nu se poate șterge cât timp există câini care o folosesc.

### Modificări de schemă
1. Modificați `schema.prisma`.
2. Din `backend/`: `npx prisma migrate dev --name <ce_ati_schimbat>`.
3. Urcați în repo fișierul nou din `prisma/migrations/`. Nu editați o migrare deja urcată, creați una nouă.

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
