# ⚙️ Backend

API-ul aplicației, realizat în **Node.js 24 LTS** + **Express 5**, cu **Prisma 7** ca ORM și **PostgreSQL** ca bază de date.

**Echipa:** Sebastian · Gabriel G. · Gabriel F.

## Responsabilități
- API REST consumat de [frontend](../frontend/)
- Autentificare și autorizare cu **JWT**, parole criptate cu **bcrypt**
- Modelul bazei de date și migrațiile (Prisma)
- Validarea datelor și tratarea erorilor

## Structură propusă

```
backend/
├── prisma/
│   └── schema.prisma   ← modelul bazei de date
└── src/
    ├── routes/         ← definirea endpoint-urilor
    ├── controllers/    ← primesc cererile și trimit răspunsurile
    ├── services/       ← logica aplicației
    ├── middleware/     ← autentificare, validare, erori
    └── app.js          ← punctul de pornire
```

## Reguli
- Instalați Prisma explicit pe versiunea 7: `npm install prisma@7 @prisma/client@7`
- Secretele (`JWT_SECRET`, parola bazei de date) stau în `.env`, care **nu** se urcă în repo. În repo se urcă doar `.env.example`.

## Rulare locală

_TBD_. Se completează după configurarea proiectului și a Docker-ului.
