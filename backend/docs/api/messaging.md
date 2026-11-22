# Mesagerie

Conversații 1-la-1 între utilizatori. Toate rutele cer autentificare (`Authorization: Bearer <token>`). Formatul general al răspunsurilor e în [README](../../README.md#formatul-răspunsurilor).

## Actualizare în timp real: polling

Pentru demo folosim **polling**, nu WebSocket:

| Ce | Cât de des | Endpoint |
|---|---|---|
| Badge-ul din meniu | la 30 s | `GET /api/messages/unread-count` |
| Lista de conversații (când e deschisă) | la 15 s | `GET /api/conversations` |
| Conversația deschisă | la 5 s | `GET /api/conversations/:id/messages?after=<id-ul ultimului mesaj primit>` |

Cu `after`, serverul întoarce doar mesajele noi, de obicei o listă goală. Dacă mai târziu avem nevoie de WebSocket, endpoint-urile rămân valabile.

## Block și conturi șterse

- Dacă unul dintre utilizatori l-a blocat pe celălalt, conversația dispare din listă și din numărul de mesaje necitite, iar citirea și trimiterea de mesaje dau `403 BLOCKED`. După deblocare, conversația reapare cu tot istoricul.
- Dacă celălalt utilizator își șterge contul, conversația rămâne, cu `otherParticipants: []`. Mesajele lui au `senderId: null` (afișate ca „Utilizator șters”), iar trimiterea de mesaje noi dă `409 CONVERSATION_CLOSED`.

## Formatul unei conversații

```json
{
  "id": "…",
  "createdAt": "…",
  "otherParticipants": [ { "id": "…", "firstName": "Mihai", "lastName": "Ionescu", "avatarUrl": null } ],
  "lastMessage": { "id": "…", "conversationId": "…", "senderId": "…", "content": "Ne vedem la 5?", "sentAt": "…" },
  "unreadCount": 2
}
```

`unreadCount` numără mesajele primite (nu pe ale mele) după ultima citire (`POST /read`).

## `GET /api/conversations` 🔒

Conversațiile mele, cele cu activitate recentă primele (după ultimul mesaj sau, dacă nu are mesaje, după data creării).

**200**: `{ "data": [ <conversație>, … ] }`

## `POST /api/conversations` 🔒

Deschide conversația cu un utilizator sau o întoarce pe cea existentă (din oricare parte ar fi fost creată).

```json
{ "userId": "…" }
```

**201** dacă s-a creat acum, **200** dacă exista deja; corpul e conversația.
**Erori:** `400 CANNOT_MESSAGE_SELF`, `404 NOT_FOUND`, `403 BLOCKED`.

## `GET /api/conversations/:id` 🔒

O singură conversație (pentru antetul chat-ului). **Erori:** `404 NOT_FOUND` (nu există sau nu ești participant), `403 BLOCKED`.

## `GET /api/conversations/:id/messages` 🔒

Mesajele, în ordine cronologică (cel mai vechi primul). Paginare cu cursor:

| Query | Ce întoarce |
|---|---|
| (nimic) | ultimele `limit` mesaje |
| `?before=<messageId>` | mesajele dinaintea acestuia (scroll în sus) |
| `?after=<messageId>` | mesajele de după acesta (polling) |
| `limit` | 1–100, implicit 50 |

```json
{
  "data": [ { "id": "…", "conversationId": "…", "senderId": "…", "content": "…", "sentAt": "…" } ],
  "meta": { "hasMore": true, "limit": 50 }
}
```

`hasMore` spune dacă mai sunt mesaje în direcția cerută (mai vechi pentru `before` / fără cursor, mai noi pentru `after`).
**Erori:** `400 VALIDATION_ERROR` (`before` și `after` împreună), `400 BAD_REQUEST` (cursorul nu e din conversația asta), `404 NOT_FOUND`, `403 BLOCKED`.

## `POST /api/conversations/:id/messages` 🔒

```json
{ "content": "Ne vedem la 5?" }
```

`content`: 1–2000 de caractere, fără spațiile de la capete. Trimiterea marchează conversația ca citită pentru expeditor.

**201**: mesajul creat.
**Erori:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `403 BLOCKED`, `409 CONVERSATION_CLOSED`.

## `POST /api/conversations/:id/read` 🔒

Marchează conversația ca citită, până la ultimul mesaj. Se apelează când utilizatorul deschide conversația și când sosesc mesaje noi cât timp e deschisă.

**204**. **Erori:** `404 NOT_FOUND`.

## `GET /api/messages/unread-count` 🔒

Totalul de mesaje necitite din toate conversațiile (fără cele cu utilizatori blocați).

**200**: `{ "data": { "count": 3 } }`
