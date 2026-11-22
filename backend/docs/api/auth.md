# Auth

Token-ul JWT se trimite la toate rutele protejate în header-ul `Authorization: Bearer <token>`. Expiră după `JWT_EXPIRES_IN` (implicit 7 zile); după expirare API-ul răspunde cu `401 TOKEN_EXPIRED` și utilizatorul trebuie să se logheze din nou.

Formatul general al răspunsurilor și codurile de eroare comune sunt în [README](../../README.md#formatul-răspunsurilor).

## `POST /api/auth/register`

Creează contul și întoarce direct un token (utilizatorul e logat).

```json
{
  "email": "ana.pop@example.com",
  "password": "o-parola-buna",
  "firstName": "Ana",
  "lastName": "Pop",
  "bio": "opțional",
  "latitude": 46.770439,
  "longitude": 23.591423,
  "consentAccepted": true
}
```

- `email`: se salvează cu litere mici, fără spații.
- `password`: 8 caractere minim, 72 de octeți maxim (limita bcrypt).
- `latitude` / `longitude`: se rotunjesc la 2 zecimale (~1 km) înainte de salvare. Locația exactă nu se păstrează.
- `consentAccepted`: trebuie să fie `true` (GDPR). Momentul acordului se salvează în `consentAt`.

**201**

```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "…", "email": "ana.pop@example.com", "emailVerified": false,
      "firstName": "Ana", "lastName": "Pop", "avatarUrl": null, "bio": null,
      "approxLatitude": 46.77, "approxLongitude": 23.59,
      "consentAt": "2026-11-19T14:00:00.000Z", "createdAt": "…", "updatedAt": "…"
    }
  }
}
```

**Erori:** `400 VALIDATION_ERROR`, `409 EMAIL_TAKEN`.

## `POST /api/auth/login`

```json
{ "email": "ana.pop@demo.dogapp", "password": "pass1" }
```

**200**: același format ca la register (`{ data: { token, user } }`).

**Erori:** `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`. Răspunsul e identic pentru parolă greșită și pentru email inexistent, ca să nu se poată afla ce emailuri au cont.

Conturile demo din seed (`ana.pop@demo.dogapp`, `mihai.ionescu@demo.dogapp`, `elena.rusu@demo.dogapp`, `andrei.muresan@demo.dogapp`, `ioana.cristea@demo.dogapp`, `radu.moldovan@demo.dogapp`, `mara.popescu@demo.dogapp`) au parola `pass1`.

## `GET /api/auth/me` 🔒

Utilizatorul logat, în același format ca `user` de mai sus.

**Erori:** `401 UNAUTHORIZED` (lipsește token-ul), `401 INVALID_TOKEN` (token invalid sau cont șters), `401 TOKEN_EXPIRED`.
