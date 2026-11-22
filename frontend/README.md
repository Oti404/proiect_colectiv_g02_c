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

Cererile către `/api` sunt trimise la backend (`http://localhost:3000`) prin `proxy.conf.json`, deci backend-ul trebuie să ruleze (de ex. `docker compose up -d` din rădăcină).

### Cu Docker

Din rădăcina repo-ului:

```bash
docker compose up -d --build frontend
```

Aplicația e disponibilă la `http://localhost:8080`. Imaginea se construiește în două etape: prima rulează `npm run build`, iar a doua servește fișierele rezultate cu **nginx** (configurat în `nginx.conf`). Cererile către `/api/` sunt trimise de nginx la backend, deci în cod adresele API-ului încep cu `/api/...`, fără `localhost:3000`.

După orice modificare în cod, imaginea trebuie reconstruită (comanda de mai sus). Pentru lucrul de zi cu zi e mai comod `npm start`.

## Comenzi utile

| Comandă | Ce face |
|---|---|
| `npm start` | Pornește serverul de dezvoltare |
| `npm run build` | Construiește aplicația pentru producție în `dist/` |
| `npm test` | Rulează testele unitare (Vitest) |
| `npm run api:types` | Regenerează tipurile API (`core/api/schema.ts`) din Swagger. Cere backend-ul pornit |
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

## Legarea de backend

Tot ce ține de API e în `src/app/core/api/`:

| Fișier | Ce face |
|---|---|
| `api.service.ts` | `ApiService`: singurul loc care face cereri HTTP. Prefixează `/api`, despachetează `{ data }` și `{ data, meta }`, transformă erorile în `ApiError` |
| `api.types.ts` | `ApiModel<'Dog'>` (tipurile din Swagger), `Page<T>`, `ApiError` (cu `code`, `status`, `fieldError('email')`) |
| `auth.interceptor.ts` | Pune `Authorization: Bearer <token>`. La `401` cu token expirat: șterge token-ul și trimite la `/login` |
| `token-storage.service.ts` | Token-ul JWT, păstrat în `localStorage` |
| `schema.ts` | Generat cu `npm run api:types`, nu se modifică de mână |
| `breed-api.service.ts` | **Exemplul de urmat** pentru un serviciu nou |

Un serviciu nou arată ca `BreedApiService`: injectează `ApiService` și întoarce `Observable`.

```ts
@Injectable({ providedIn: 'root' })
export class DogApiService {
  private readonly api = inject(ApiService);

  get(id: string) {
    return this.api.get<ApiModel<'DogDetail'>>(`/dogs/${id}`);
  }
  create(draft: DogDraft) {
    return this.api.post<ApiModel<'DogWithBreed'>>('/dogs', draft);
  }
}
```

Starea de loading și de eroare o ține componenta, cu `rxResource` pentru citiri:

```ts
private readonly breedApi = inject(BreedApiService);
readonly breeds = rxResource({ stream: () => this.breedApi.list() });
// template: breeds.isLoading(), breeds.error(), breeds.value()
```

Pentru scrieri (submit de formular), `subscribe` cu `next` / `error`. Erorile se verifică după `code`, nu după text:

```ts
this.dogApi.create(draft).subscribe({
  next: (dog) => this.router.navigate(['/dogs', dog.id]),
  error: (err: ApiError) => {
    this.nameError = err.fieldError('name');
    if (err.code === 'NOT_FOUND') this.formError = 'Rasa aleasă nu mai există.';
  },
});
```

Planul de integrare, pe module și pe membri, e pe ramura `docs/frontend-integration-tasks` (`frontend/INTEGRATION_TASKS.md`).

## Reguli
- Stilurile se scriu în **SCSS**.
- Componentele noi se pun în folderul potrivit din structura de mai sus, nu direct în `src/app/`.
- Codul se formatează cu **Prettier** (configurat în `.prettierrc`).
- `nginx.conf` și `Dockerfile` stau direct în `frontend/`, cu numele scrise exact așa (Docker face diferența între litere mari și mici).
