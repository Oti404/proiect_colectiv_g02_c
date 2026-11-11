import { Breed } from '../models';

export const SEED_BREEDS: Breed[] = [
  {
    id: 'breed-mixed',
    name: 'Mixed breed',
    size: 'MEDIUM',
    energyLevel: 3,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'For mixed-breed dogs, actual size and exercise needs vary by lineage. Monitor joints and schedule annual check-ups.',
  },
  {
    id: 'breed-labrador',
    name: 'Labrador Retriever',
    size: 'LARGE',
    energyLevel: 4,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'High-energy water retriever that needs 60+ minutes of daily exercise and strict portion control to prevent obesity.',
  },
  {
    id: 'breed-french-bulldog',
    name: 'French Bulldog',
    size: 'SMALL',
    energyLevel: 2,
    heatSensitive: true,
    breathingIssues: true,
    careTips:
      'Brachycephalic breed: avoid intense exertion above 24°C, clean facial folds regularly, and use a harness instead of a collar.',
  },
  {
    id: 'breed-german-shepherd',
    name: 'German Shepherd',
    size: 'LARGE',
    energyLevel: 5,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'Requires structured mental stimulation, consistent socialization, and daily vigorous walks to stay balanced.',
  },
  {
    id: 'breed-golden',
    name: 'Golden Retriever',
    size: 'LARGE',
    energyLevel: 4,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'Friendly family dog needing regular brushing twice a week, ear drying after swimming, and daily fetch or walks.',
  },
  {
    id: 'breed-beagle',
    name: 'Beagle',
    size: 'MEDIUM',
    energyLevel: 4,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'Strong scent drive — keep on a secure leash in unfenced areas and use puzzle feeders for enrichment.',
  },
  {
    id: 'breed-husky',
    name: 'Siberian Husky',
    size: 'LARGE',
    energyLevel: 5,
    heatSensitive: true,
    breathingIssues: false,
    careTips:
      'Built for cold climates with a dense double coat; walk early morning or late evening in warm weather and never shave the coat.',
  },
  {
    id: 'breed-chihuahua',
    name: 'Chihuahua',
    size: 'SMALL',
    energyLevel: 3,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'Small teeth are prone to tartar—brush frequently. Protect from cold winters and avoid jumping from high furniture.',
  },
  {
    id: 'breed-boxer',
    name: 'Boxer',
    size: 'LARGE',
    energyLevel: 4,
    heatSensitive: true,
    breathingIssues: true,
    careTips:
      'Playful and athletic, but short muzzle causes sensitivity to heat and humidity; keep fresh water available on walks.',
  },
  {
    id: 'breed-bichon',
    name: 'Bichon Frise',
    size: 'SMALL',
    energyLevel: 3,
    heatSensitive: false,
    breathingIssues: false,
    careTips:
      'Curly low-shedding coat requires daily brushing to prevent mats and professional grooming every 4–6 weeks.',
  },
];
