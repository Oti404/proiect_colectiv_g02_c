import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, DogSize, Sex, Temperament } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Parola tuturor utilizatorilor demo
const DEMO_PASSWORD = "pass1";

const breeds = [
  { name: "Mixed breed", size: DogSize.MEDIUM, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Pentru metiși, talia și nevoile reale depind de rasele din care provin. Consultați medicul veterinar pentru un plan personalizat." },
  { name: "Labrador Retriever", size: DogSize.LARGE, energyLevel: 4, heatSensitive: false, breathingIssues: false,
    careTips: "Mănâncă ușor în exces: porții măsurate și cel puțin 1-2 ore de mișcare pe zi. Îi place apa." },
  { name: "Golden Retriever", size: DogSize.LARGE, energyLevel: 4, heatSensitive: false, breathingIssues: false,
    careTips: "Blană deasă: periat de 2-3 ori pe săptămână. Are nevoie de multă mișcare și de companie." },
  { name: "German Shepherd", size: DogSize.LARGE, energyLevel: 5, heatSensitive: false, breathingIssues: false,
    careTips: "Foarte activ și inteligent: are nevoie de joc, dresaj și plimbări lungi. Atenție la articulații." },
  { name: "French Bulldog", size: DogSize.SMALL, energyLevel: 2, heatSensitive: true, breathingIssues: true,
    careTips: "Evitați efortul și plimbările pe căldură. Folosiți ham, nu zgardă. Pliurile feței se curăță regulat." },
  { name: "Pug", size: DogSize.SMALL, energyLevel: 2, heatSensitive: true, breathingIssues: true,
    careTips: "Sensibil la căldură și la efort. Plimbări scurte, greutate sub control, curățarea pliurilor." },
  { name: "Chihuahua", size: DogSize.SMALL, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Îi e frig repede: haină iarna. Periat dentar des, fiindcă are probleme cu dinții." },
  { name: "Yorkshire Terrier", size: DogSize.SMALL, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Blana lungă se încurcă: periat zilnic. Igienă dentară atentă." },
  { name: "Beagle", size: DogSize.MEDIUM, energyLevel: 4, heatSensitive: false, breathingIssues: false,
    careTips: "Urmărește mirosuri și fuge: plimbări în lesă. Tendință de îngrășare, deci porții controlate." },
  { name: "Border Collie", size: DogSize.MEDIUM, energyLevel: 5, heatSensitive: false, breathingIssues: false,
    careTips: "Are nevoie de 2+ ore de activitate și de sarcini mentale. Se plictisește ușor." },
  { name: "Siberian Husky", size: DogSize.LARGE, energyLevel: 5, heatSensitive: true, breathingIssues: false,
    careTips: "Supraîncălzire vara: plimbări dimineața sau seara. Năpârlește mult, deci periat des." },
  { name: "Cocker Spaniel", size: DogSize.MEDIUM, energyLevel: 4, heatSensitive: false, breathingIssues: false,
    careTips: "Urechile lungi se curăță săptămânal. Blana necesită periat și tuns regulat." },
  { name: "Dachshund", size: DogSize.SMALL, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Spate sensibil: evitați săriturile și scările. Greutatea trebuie ținută sub control." },
  { name: "Boxer", size: DogSize.LARGE, energyLevel: 4, heatSensitive: true, breathingIssues: true,
    careTips: "Energic și jucăuș, dar sensibil la căldură. Evitați efortul în orele fierbinți." },
  { name: "Great Dane", size: DogSize.GIANT, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Mănâncă în porții mici și dese. Evitați efortul imediat după masă. Articulații sensibile." },
  { name: "Bichon Frise", size: DogSize.SMALL, energyLevel: 3, heatSensitive: false, breathingIssues: false,
    careTips: "Blana creață cere periat zilnic și tuns la 4-6 săptămâni." },
  { name: "Jack Russell Terrier", size: DogSize.SMALL, energyLevel: 5, heatSensitive: false, breathingIssues: false,
    careTips: "Foarte energic, deși mic: are nevoie de multă mișcare și joc. Îi place să sape." },
];

// Conturile demo, aliniate cu frontend-ul (frontend/src/app/core/mock-data/seed-users.ts).
// Locații aproximative în Cluj-Napoca (deja rotunjite la 2 zecimale).
// legacyEmail: emailul din versiunea veche a seed-ului; contul existent e redenumit, nu duplicat.
const users = [
  { email: "ana.pop@demo.dogapp", legacyEmail: "user1@demo.local", firstName: "Ana", lastName: "Pop",
    bio: "Love morning walks around Parcul Central with Rex and Bella.", lat: 46.77, lng: 23.59, consentAt: "2026-10-05T09:00:00.000Z" },
  { email: "mihai.ionescu@demo.dogapp", legacyEmail: "user2@demo.local", firstName: "Mihai", lastName: "Ionescu",
    bio: "Dog obedience trainer working on calm leash socializations.", lat: 46.75, lng: 23.55, consentAt: "2026-10-06T11:30:00.000Z" },
  { email: "elena.rusu@demo.dogapp", legacyEmail: "user3@demo.local", firstName: "Elena", lastName: "Rusu",
    bio: "Looking for friendly playmates for Luna and Coco in Gheorgheni.", lat: 46.77, lng: 23.62, consentAt: "2026-10-07T14:15:00.000Z" },
  { email: "andrei.muresan@demo.dogapp", legacyEmail: "user4@demo.local", firstName: "Andrei", lastName: "Mureșan",
    bio: "Trail runner & husky dad always up for active weekend hikes.", lat: 46.75, lng: 23.58, consentAt: "2026-10-08T16:45:00.000Z" },
  { email: "ioana.cristea@demo.dogapp", legacyEmail: "user5@demo.local", firstName: "Ioana", lastName: "Cristea",
    bio: "Mia is shy at first, Toby loves everyone!", lat: 46.78, lng: 23.61, consentAt: "2026-10-09T10:20:00.000Z" },
  { email: "radu.moldovan@demo.dogapp", legacyEmail: null, firstName: "Radu", lastName: "Moldovan",
    bio: "Evening walks near Someș in Grigorescu.", lat: 46.77, lng: 23.56, consentAt: "2026-10-10T18:00:00.000Z" },
  { email: "mara.popescu@demo.dogapp", legacyEmail: null, firstName: "Mara", lastName: "Popescu",
    bio: "Proud owner of Oscar the Boxer & Pip the Bichon.", lat: 46.75, lng: 23.6, consentAt: "2026-10-12T08:10:00.000Z" },
];

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&auto=format`;

// Câinii demo, aliniați cu frontend/src/app/core/mock-data/seed-dogs.ts
const dogs = [
  // Ana are doi câini
  { owner: "ana.pop@demo.dogapp", name: "Rex", breed: "Labrador Retriever", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2022-03-12", photoUrl: photo("1587300003388-59208cc962cb") },
  { owner: "ana.pop@demo.dogapp", name: "Bella", breed: "French Bulldog", sex: Sex.FEMALE, size: DogSize.SMALL, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2024-07-01", photoUrl: photo("1583512603805-3cc6b41f3edb") },
  { owner: "mihai.ionescu@demo.dogapp", name: "Max", breed: "German Shepherd", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.REACTIVE, neutered: true, birthDate: "2020-01-20", photoUrl: photo("1589941013453-ec89f33b5e95") },
  // Elena are doi câini
  { owner: "elena.rusu@demo.dogapp", name: "Luna", breed: "Golden Retriever", sex: Sex.FEMALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2023-05-05", photoUrl: photo("1552053831-71594a27632d") },
  { owner: "elena.rusu@demo.dogapp", name: "Coco", breed: "Beagle", sex: Sex.FEMALE, size: DogSize.MEDIUM, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2025-11-14", photoUrl: photo("1505628346881-b72b27e84530") },
  { owner: "andrei.muresan@demo.dogapp", name: "Rocky", breed: "Siberian Husky", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2021-11-30", photoUrl: photo("1617895153857-82fe0c43621b") },
  { owner: "ioana.cristea@demo.dogapp", name: "Mia", breed: "Chihuahua", sex: Sex.FEMALE, size: DogSize.SMALL, temperament: Temperament.SHY, neutered: true, birthDate: "2018-06-18", photoUrl: photo("1575425186775-b8de9a427e67") },
  // Câine adoptat, fără dată de naștere cunoscută
  { owner: "ioana.cristea@demo.dogapp", name: "Toby", breed: "Mixed breed", sex: Sex.MALE, size: DogSize.MEDIUM, temperament: Temperament.PLAYFUL, neutered: true, birthDate: null, photoUrl: null },
  { owner: "radu.moldovan@demo.dogapp", name: "Bruno", breed: "Golden Retriever", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2019-09-10", photoUrl: photo("1518717758536-85ae29035b6d") },
  { owner: "radu.moldovan@demo.dogapp", name: "Daisy", breed: "Mixed breed", sex: Sex.FEMALE, size: DogSize.MEDIUM, temperament: Temperament.SHY, neutered: false, birthDate: "2026-02-01", photoUrl: null },
  { owner: "mara.popescu@demo.dogapp", name: "Oscar", breed: "Boxer", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2021-04-22", photoUrl: photo("1543466835-00a7907e9de1") },
  { owner: "mara.popescu@demo.dogapp", name: "Pip", breed: "Bichon Frise", sex: Sex.FEMALE, size: DogSize.SMALL, temperament: Temperament.PLAYFUL, neutered: true, birthDate: "2023-08-15", photoUrl: photo("1529429617124-95b109e86bb8") },
];

async function main() {
  // Rasele: upsert după nume, deci seed-ul se poate rula de câte ori vrem
  for (const b of breeds) {
    await prisma.breed.upsert({ where: { name: b.name }, update: b, create: b });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, string>();
  for (const u of users) {
    const data = {
      passwordHash,
      emailVerified: true,
      firstName: u.firstName,
      lastName: u.lastName,
      bio: u.bio,
      approxLatitude: u.lat,
      approxLongitude: u.lng,
      consentAt: new Date(u.consentAt),
    };
    // Baza locală poate avea încă contul cu emailul vechi: îl redenumim, ca să-și păstreze câinii și restul datelor
    if (u.legacyEmail) {
      const legacy = await prisma.user.findUnique({ where: { email: u.legacyEmail } });
      const current = await prisma.user.findUnique({ where: { email: u.email } });
      if (legacy && !current) await prisma.user.update({ where: { id: legacy.id }, data: { email: u.email } });
    }
    const user = await prisma.user.upsert({ where: { email: u.email }, update: data, create: { email: u.email, ...data } });
    userIds.set(u.email, user.id);
  }

  for (const d of dogs) {
    const ownerId = userIds.get(d.owner)!;
    const breed = await prisma.breed.findUniqueOrThrow({ where: { name: d.breed } });
    const data = {
      breedId: breed.id,
      sex: d.sex,
      size: d.size,
      temperament: d.temperament,
      neutered: d.neutered,
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      photoUrl: d.photoUrl,
    };
    const existing = await prisma.dog.findFirst({ where: { ownerId, name: d.name } });
    if (existing) await prisma.dog.update({ where: { id: existing.id }, data });
    else await prisma.dog.create({ data: { ownerId, name: d.name, ...data } });
  }

  console.log(`Seed gata: ${breeds.length} rase, ${users.length} utilizatori, ${dogs.length} câini.`);
  console.log(`Conturi demo: ${users.map((u) => u.email).join(", ")}, parola: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
