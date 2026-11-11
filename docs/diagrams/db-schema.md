# 🗄️ Diagrama bazei de date

Schema reală din [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma), PostgreSQL 18 · 16 tabele. Pornește de la diagrama de clase ([class-diagram.svg](class-diagram.svg)).

Notație: `PK` cheie primară · `FK` cheie străină · `UK` valoare unică · `?` câmp opțional. Toate id-urile sunt UUID.

## Imaginea de ansamblu

```mermaid
erDiagram
    User ||--o{ Dog : "owns"
    Breed ||--o{ Dog : "is of"
    User ||--o{ Block : "blocks"
    User ||--o{ Report : "reports"
    User ||--o{ Post : "writes"
    Dog |o--o{ Post : "about"
    Post ||--o{ Like : "has"
    User ||--o{ Like : "gives"
    Post ||--o{ Comment : "has"
    User ||--o{ Comment : "writes"
    Post |o--o{ Report : "reported"
    Conversation ||--|{ ConversationParticipant : "has"
    User ||--o{ ConversationParticipant : "joins"
    Conversation ||--o{ Message : "contains"
    User |o--o{ Message : "sends"
    User |o--o{ Event : "organizes"
    Place |o--o{ Event : "hosts"
    Event ||--o{ EventParticipant : "RSVP"
    User ||--o{ EventParticipant : "answers"
    Dog ||--o{ EventParticipant : "attends"
    Dog ||--o{ HealthRecord : "log"
    Place ||--o{ PlaceReview : "gets"
    Event ||--o{ PlaceReview : "after"
    User ||--o{ PlaceReview : "writes"
```

`||--o{` = unul la mai mulți. `|o--o{` = legătura e opțională în partea din stânga (de ex. o postare poate să nu aibă câine, un eveniment privat nu are loc pe hartă).

**Un utilizator poate avea oricâți câini** (`User 1 → N Dog`). La evenimente, fiecare câine adus are propriul rând în `EventParticipant`, unic pe `(eventId, dogId)`.

## 1. Core: căutare

```mermaid
erDiagram
    User ||--o{ Dog : "owns"
    Breed ||--o{ Dog : "is of"
    User ||--o{ Block : "blocks"
    User ||--o{ Report : "reports"
    Post |o--o{ Report : "reported"

    User {
        uuid id PK
        string email UK
        string passwordHash
        boolean emailVerified
        string firstName
        string lastName
        string avatarUrl "?"
        string bio "?"
        float approxLatitude "rounded to 2 decimals"
        float approxLongitude "rounded to 2 decimals"
        datetime consentAt "GDPR"
        datetime createdAt
        datetime updatedAt
    }
    Dog {
        uuid id PK
        uuid ownerId FK
        uuid breedId FK
        string name
        datetime birthDate "?"
        enum sex "MALE FEMALE"
        enum size "SMALL MEDIUM LARGE GIANT"
        enum temperament "FRIENDLY PLAYFUL SHY REACTIVE"
        boolean neutered
        string photoUrl "?"
        datetime createdAt
        datetime updatedAt
    }
    Breed {
        uuid id PK
        string name UK "includes Mixed breed"
        enum size "SMALL MEDIUM LARGE GIANT"
        string careTips
        boolean heatSensitive
        boolean breathingIssues
        int energyLevel "CHECK 1-5"
        datetime createdAt
        datetime updatedAt
    }
    Block {
        uuid blockerId PK, FK
        uuid blockedId PK, FK
        datetime createdAt
    }
    Report {
        uuid id PK
        uuid reporterId FK
        uuid reportedUserId FK "?"
        uuid postId FK "?"
        string reason
        enum status "OPEN REVIEWED DISMISSED"
        datetime createdAt
        datetime updatedAt
    }
```

Indecși: `User(approxLatitude, approxLongitude)`, `Dog(ownerId)`, `Dog(breedId)`, `Dog(size)`. `Block` și `Report` pornesc ambele din `User` pe două legături (cine blochează/raportează și cine e blocat/raportat). Un `Report` trebuie să aibă `reportedUserId` sau `postId` (CHECK), iar un utilizator nu se poate bloca pe sine (CHECK).

## 2. Social: postări și chat

```mermaid
erDiagram
    User ||--o{ Post : "writes"
    Dog |o--o{ Post : "about"
    Post ||--o{ Like : "has"
    User ||--o{ Like : "gives"
    Post ||--o{ Comment : "has"
    User ||--o{ Comment : "writes"
    Conversation ||--|{ ConversationParticipant : "has"
    User ||--o{ ConversationParticipant : "joins"
    Conversation ||--o{ Message : "contains"
    User |o--o{ Message : "sends"

    Post {
        uuid id PK
        uuid authorId FK
        uuid dogId FK "?"
        string content
        string imageUrl "?"
        datetime createdAt
        datetime updatedAt
    }
    Like {
        uuid userId PK, FK
        uuid postId PK, FK
        datetime createdAt
    }
    Comment {
        uuid id PK
        uuid userId FK
        uuid postId FK
        string content
        datetime createdAt
        datetime updatedAt
    }
    Conversation {
        uuid id PK
        datetime createdAt
    }
    ConversationParticipant {
        uuid conversationId PK, FK
        uuid userId PK, FK
        datetime joinedAt
        datetime lastReadAt "? unread messages"
    }
    Message {
        uuid id PK
        uuid conversationId FK
        uuid senderId FK "? null = deleted user"
        string content
        datetime sentAt
    }
```

`Like` are cheie compusă `(userId, postId)`, deci nu se poate da like de două ori. Mesajele necitite se calculează din `ConversationParticipant.lastReadAt`. Index pe `Message(conversationId, sentAt)`.

## 3. Întâlniri

```mermaid
erDiagram
    User |o--o{ Event : "organizes"
    Place |o--o{ Event : "hosts"
    Event ||--o{ EventParticipant : "RSVP"
    User ||--o{ EventParticipant : "answers"
    Dog ||--o{ EventParticipant : "attends"

    Event {
        uuid id PK
        uuid organizerId FK "? null = deleted user"
        uuid placeId FK "? only PUBLIC events"
        string locationText "? for PRIVATE events"
        string title
        string description "?"
        enum type "PLAYDATE GROUP_WALK BREED_MEETUP"
        enum visibility "PUBLIC PRIVATE"
        enum status "ACTIVE CANCELLED"
        datetime startsAt
        datetime endsAt "CHECK after startsAt"
        int maxParticipants "? counts dogs"
        datetime createdAt
        datetime updatedAt
    }
    EventParticipant {
        uuid id PK
        uuid eventId FK
        uuid userId FK
        uuid dogId FK "unique with eventId"
        enum status "INVITED GOING MAYBE NOT_GOING"
        datetime createdAt
        datetime updatedAt
    }
```

Doar evenimentele `PUBLIC` pot avea `placeId` (CHECK); cele `PRIVATE` folosesc `locationText`, deci o întâlnire acasă la cineva nu ajunge pe hartă. Un utilizator cu doi câini are două rânduri în `EventParticipant`.

## 4. Îngrijire

```mermaid
erDiagram
    Dog ||--o{ HealthRecord : "log"

    HealthRecord {
        uuid id PK
        uuid dogId FK
        enum type "VACCINE DEWORMING VET_VISIT WEIGHT"
        string title "e.g. vaccine name"
        datetime date
        datetime nextDueDate "? reminder, indexed"
        float weightKg "? only for WEIGHT"
        string notes "?"
        datetime createdAt
        datetime updatedAt
    }
```

Memento-urile se obțin cu o interogare pe `nextDueDate` (indexat), fără job programat.

## 5. Hartă (opțional)

```mermaid
erDiagram
    Place |o--o{ Event : "hosts"
    Place ||--o{ PlaceReview : "gets"
    Event ||--o{ PlaceReview : "after"
    User ||--o{ PlaceReview : "writes"

    Place {
        uuid id PK
        string name
        float latitude
        float longitude
        string address "?"
        string phone "?"
        string website "?"
        string openingHours "?"
        enum type "PARK DOG_PARK CAFE VET PET_SHOP"
        enum source "OSM USER_EVENTS"
        string osmId UK "? no duplicate imports"
        datetime createdAt
        datetime updatedAt
    }
    PlaceReview {
        uuid id PK
        uuid userId FK
        uuid placeId FK
        uuid eventId FK "unique with userId"
        int rating "CHECK 1-5"
        string tags "list"
        datetime createdAt
    }
```

O singură recenzie pe utilizator și eveniment: `unique(userId, eventId)`.

## Ce se întâmplă la ștergere

| Se șterge | Efect |
|---|---|
| **User** | Cascadă: `Dog`, `Post`, `Like`, `Comment`, `HealthRecord` (prin câine), `Block`, `Report`, `ConversationParticipant`, `EventParticipant`, `PlaceReview`. Gol (`NULL`): `Message.senderId` (apare „Utilizator șters") și `Event.organizerId` (backend-ul trece evenimentul pe `CANCELLED`). |
| **Dog** | Cascadă: `HealthRecord`, `EventParticipant`. `Post.dogId` devine gol, postarea rămâne. |
| **Post** | Cascadă: `Like`, `Comment`, `Report`. |
| **Breed** | Blocat cât timp există câini cu rasa respectivă. |
| **Place** | Cascadă: `PlaceReview`. `Event.placeId` devine gol. |
| **Event** | Cascadă: `EventParticipant`, `PlaceReview`. |

## Constrângeri `CHECK` (în migrare, nu în `schema.prisma`)

| Tabel | Regulă |
|---|---|
| `Breed` | `energyLevel` între 1 și 5 |
| `PlaceReview` | `rating` între 1 și 5 |
| `Report` | `reportedUserId` sau `postId` trebuie completat |
| `Block` | `blockerId` diferit de `blockedId` |
| `Event` | `endsAt` după `startsAt` |
| `Event` | un eveniment `PRIVATE` nu are `placeId` |
