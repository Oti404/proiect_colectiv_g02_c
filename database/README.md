# 🗄️ Bază de date

**PostgreSQL 18**, rulat în Docker.

**Responsabil:** Cătălin

## Pornire
Din rădăcina repo-ului:

    docker compose up -d db

## Oprire

    docker compose down

## Configurare
Datele de acces (utilizator, parolă, nume bază de date) se pun în `.env` din rădăcina repo-ului, după modelul din `.env.example`.

Structura tabelelor e definită în `backend/prisma/schema.prisma`.