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

// Locații aproximative în Cluj-Napoca (deja rotunjite la 2 zecimale)
const users = [
  { email: "user1@demo.local", firstName: "Ana", lastName: "Pop", bio: "Iubesc plimbările în Parcul Central.", lat: 46.77, lng: 23.59 },
  { email: "user2@demo.local", firstName: "Mihai", lastName: "Ionescu", bio: "Antrenez câini de sport.", lat: 46.75, lng: 23.55 },
  { email: "user3@demo.local", firstName: "Elena", lastName: "Rusu", bio: "Caut parteneri de joacă pentru Luna.", lat: 46.77, lng: 23.62 },
  { email: "user4@demo.local", firstName: "Andrei", lastName: "Mureșan", bio: null, lat: 46.75, lng: 23.58 },
  { email: "user5@demo.local", firstName: "Ioana", lastName: "Cristea", bio: "Mia e timidă, dar se împrietenește repede.", lat: 46.78, lng: 23.61 },
];

const dogs = [
  // Ana are doi câini
  { owner: "user1@demo.local", name: "Rex", breed: "Labrador Retriever", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2021-03-12" },
  { owner: "user1@demo.local", name: "Bella", breed: "French Bulldog", sex: Sex.FEMALE, size: DogSize.SMALL, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2022-07-01" },
  { owner: "user2@demo.local", name: "Max", breed: "German Shepherd", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.REACTIVE, neutered: true, birthDate: "2020-01-20" },
  // Elena are doi câini
  { owner: "user3@demo.local", name: "Luna", breed: "Golden Retriever", sex: Sex.FEMALE, size: DogSize.LARGE, temperament: Temperament.FRIENDLY, neutered: true, birthDate: "2022-05-05" },
  { owner: "user3@demo.local", name: "Coco", breed: "Beagle", sex: Sex.FEMALE, size: DogSize.MEDIUM, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2023-09-14" },
  { owner: "user4@demo.local", name: "Rocky", breed: "Siberian Husky", sex: Sex.MALE, size: DogSize.LARGE, temperament: Temperament.PLAYFUL, neutered: false, birthDate: "2021-11-30" },
  { owner: "user5@demo.local", name: "Mia", breed: "Chihuahua", sex: Sex.FEMALE, size: DogSize.SMALL, temperament: Temperament.SHY, neutered: true, birthDate: "2019-06-18" },
  // Câine adoptat, fără dată de naștere cunoscută
  { owner: "user5@demo.local", name: "Toby", breed: "Mixed breed", sex: Sex.MALE, size: DogSize.MEDIUM, temperament: Temperament.PLAYFUL, neutered: true, birthDate: null },
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
      consentAt: new Date(),
    };
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
    };
    const existing = await prisma.dog.findFirst({ where: { ownerId, name: d.name } });
    if (existing) await prisma.dog.update({ where: { id: existing.id }, data });
    else await prisma.dog.create({ data: { ownerId, name: d.name, ...data } });
  }

  console.log(`Seed gata: ${breeds.length} rase, ${users.length} utilizatori, ${dogs.length} câini.`);
  console.log(`Conturi demo: user1@demo.local ... user5@demo.local, parola: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
