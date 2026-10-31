# ⚙️ Backend

API-ul aplicației, scris în **TypeScript** cu **Node.js 24 LTS** + **Express 5**, cu **Prisma 7** ca ORM și **PostgreSQL 18** ca bază de date.

**Echipa:** Sebastian · Gabriel G. · Gabriel F.

## Responsabilități
- API REST consumat de [frontend](../frontend/)
- Autentificare și autorizare cu **JWT**, parole criptate cu **bcryptjs**
- Modelul bazei de date și migrațiile (Prisma)
- Validarea datelor și tratarea erorilor

## Cerințe
- **Node.js 24.15.0 sau mai nou** (verificați cu `node -v`)
- Pentru baza de date: **Docker Desktop** (vezi [database/README.md](../database/README.md))

## Rulare locală

Toate comenzile se rulează din folderul `backend/`.

1. Instalați pachetele:

       npm install

2. Dacă npm afișează avertismentul `install-scripts ... not yet covered by allowScripts`, aprobați scripturile (sunt necesare pentru Prisma și `tsx`) și rulați-le:

       npm install-scripts approve prisma @prisma/engines esbuild
       npm rebuild prisma @prisma/engines esbuild

3. Copiați `.env.example` în `.env` și completați valorile:

       copy .env.example .env

4. Porniți serverul:

       npm run dev

API-ul pornește la `http://localhost:3000`. Verificare: `http://localhost:3000/api/health` → `{"status":"ok"}`.

## Comenzi utile

| Comandă | Ce face |
|---|---|
| `npm run dev` | Pornește serverul cu reîncărcare automată (`tsx watch`) |
| `npm run build` | Compilează TypeScript-ul în `dist/` |
| `npm start` | Rulează varianta compilată (`node dist/app.js`) |
| `npm run prisma:generate` | Generează clientul Prisma după modificări în `schema.prisma` |
| `npx prisma migrate dev --name <nume>` | Creează o migrare și aplică modificările în baza de date |
| `npx prisma studio` | Deschide în browser o interfață pentru datele din baza de date |

## Structură propusă

```
backend/
├── prisma/
│   └── schema.prisma   ← modelul bazei de date
├── prisma7.config.ts   ← configurarea Prisma (conexiunea la baza de date)
└── src/
    ├── routes/         ← definirea endpoint-urilor
    ├── controllers/    ← primesc cererile și trimit răspunsurile
    ├── services/       ← logica aplicației
    ├── middleware/     ← autentificare, validare, erori
    ├── lib/            ← clientul Prisma și alte utilitare
    ├── generated/      ← clientul Prisma generat (nu se urcă în repo)
    └── app.ts          ← punctul de pornire
```

## Docker

Imaginea se construiește din `Dockerfile` în două etape: prima compilează TypeScript-ul, iar a doua păstrează doar `dist/` și pachetele de producție, ca imaginea să fie mică. Se pornește din rădăcina repo-ului cu `docker compose up -d --build backend`.

## Reguli
- Instalați Prisma explicit pe versiunea 7: `npm install prisma@7 @prisma/client@7`. Eticheta `latest` de pe npm poate arăta spre o versiune de test.
- Importurile între fișierele proprii se scriu cu extensia **`.js`**, chiar dacă fișierul e `.ts` (ex. `import { prisma } from "./lib/prisma.js"`). Așa cere `NodeNext`.
- În `tsconfig.json` trebuie să rămână `"types": ["node"]`. Fără el, TypeScript 7 nu recunoaște `process` și `npm run build` dă eroare.
- Secretele (`JWT_SECRET`, parola bazei de date) stau în `.env`, care **nu** se urcă în repo. În repo se urcă doar `.env.example`.
- Pentru Docker, baza de date e disponibilă local pe portul **5433**, nu 5432.
