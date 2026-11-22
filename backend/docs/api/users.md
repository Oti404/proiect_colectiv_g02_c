# Utilizatori, block și raportări

Toate rutele cer autentificare (`Authorization: Bearer <token>`). Formatul general al răspunsurilor e în [README](../../README.md#formatul-răspunsurilor).

## Utilizatori

### `GET /api/users/me` 🔒

Utilizatorul logat, în același format ca la [`/api/auth/me`](auth.md#get-apiauthme-).

### `PATCH /api/users/me` 🔒

Se trimit doar câmpurile care se schimbă (cel puțin unul). Alte câmpuri (de ex. `email`) sunt refuzate.

```json
{
  "firstName": "Elena",
  "lastName": "Rusu",
  "bio": "Iubesc câinii",
  "avatarUrl": "https://example.com/avatar.jpg",
  "latitude": 46.754321,
  "longitude": 23.556789
}
```

- `bio` și `avatarUrl`: `null` sau `""` șterg valoarea. `avatarUrl` trebuie să fie `http(s)`.
- `latitude` și `longitude` se trimit împreună și se rotunjesc la 2 zecimale.

**200**: utilizatorul actualizat. **Erori:** `400 VALIDATION_ERROR`.

### `GET /api/users/:id` 🔒

Profilul public, fără email, cu câinii utilizatorului.

```json
{
  "data": {
    "id": "…", "firstName": "Mihai", "lastName": "Ionescu", "avatarUrl": null,
    "bio": "Antrenez câini de sport.", "approxLatitude": 46.75, "approxLongitude": 23.55,
    "createdAt": "…",
    "dogs": [
      {
        "id": "…", "name": "Max", "birthDate": "2020-01-20T00:00:00.000Z", "sex": "MALE",
        "size": "LARGE", "temperament": "REACTIVE", "neutered": true, "photoUrl": null,
        "breed": { "id": "…", "name": "German Shepherd" }
      }
    ]
  }
}
```

**Erori:** `400 VALIDATION_ERROR` (id invalid), `404 NOT_FOUND`. Dacă unul dintre cei doi l-a blocat pe celălalt, răspunsul e tot `404`, ca și cum utilizatorul n-ar exista.

### `DELETE /api/users/me` 🔒

Șterge contul definitiv. Cere din nou parola:

```json
{ "password": "parola-curenta" }
```

În aceeași tranzacție:

- evenimentele **active** organizate de utilizator trec pe `CANCELLED` (rămân fără organizator);
- câinii, postările, like-urile, comentariile, block-urile, raportările și participările se șterg în cascadă;
- mesajele trimise rămân, cu `senderId: null` (frontend-ul le afișează ca „Utilizator șters”).

**204** fără conținut. Token-ul nu mai funcționează după ștergere (`401 INVALID_TOKEN`).
**Erori:** `400 VALIDATION_ERROR` (lipsește parola), `403 INVALID_PASSWORD`.

## Block

Un block ascunde cei doi utilizatori unul de celălalt, în ambele direcții: profil, căutare, feed, mesaje. Doar cel care a blocat îl poate debloca.

### `GET /api/blocks` 🔒

Utilizatorii blocați de mine (nu și cei care m-au blocat), cei mai recenți primii.

```json
{ "data": [ { "user": { "id": "…", "firstName": "Mihai", "lastName": "Ionescu", "avatarUrl": null }, "createdAt": "…" } ] }
```

### `POST /api/blocks/:userId` 🔒

**201** dacă block-ul s-a creat acum, **200** dacă exista deja. Corpul e un element din lista de mai sus.
**Erori:** `400 CANNOT_BLOCK_SELF`, `404 NOT_FOUND`.

### `DELETE /api/blocks/:userId` 🔒

**204**, și când block-ul nu exista.

## Raportări

### `POST /api/reports` 🔒

Raportează **fie** un utilizator, **fie** o postare (exact unul dintre câmpuri):

```json
{ "reportedUserId": "…", "reason": "Mesaje jignitoare" }
```

```json
{ "postId": "…", "reason": "Spam" }
```

`reason`: 3–1000 de caractere.

**201**

```json
{ "data": { "id": "…", "reportedUserId": "…", "postId": null, "reason": "Mesaje jignitoare", "status": "OPEN", "createdAt": "…" } }
```

**Erori:** `400 VALIDATION_ERROR`, `400 CANNOT_REPORT_SELF` (pe tine sau propria postare), `404 NOT_FOUND`, `409 ALREADY_REPORTED` (ai deja un raport deschis pe aceeași țintă).

Moderarea (trecerea pe `REVIEWED` / `DISMISSED`) nu are încă endpoint.
