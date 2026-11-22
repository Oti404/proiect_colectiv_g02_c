/**
 * Conturile demo din seed-ul backend-ului (`backend/prisma/seed.ts`), toate cu parola `pass1`.
 * Folosite pentru login rapid pe pagina de login și în header (prezentare / testare).
 */
export interface DemoAccount {
  email: string;
  name: string;
  hint: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'ana.pop@demo.dogapp', name: 'Ana Pop', hint: 'Centru · Rex & Bella' },
  { email: 'mihai.ionescu@demo.dogapp', name: 'Mihai Ionescu', hint: 'Mănăștur · Max' },
  { email: 'elena.rusu@demo.dogapp', name: 'Elena Rusu', hint: 'Gheorgheni · Luna & Coco' },
  { email: 'andrei.muresan@demo.dogapp', name: 'Andrei Mureșan', hint: 'Zorilor · Rocky' },
  { email: 'ioana.cristea@demo.dogapp', name: 'Ioana Cristea', hint: 'Mărăști · Mia & Toby' },
  { email: 'radu.moldovan@demo.dogapp', name: 'Radu Moldovan', hint: 'Grigorescu · Bruno & Daisy' },
  { email: 'mara.popescu@demo.dogapp', name: 'Mara Popescu', hint: 'Bună Ziua · Oscar & Pip' },
];
