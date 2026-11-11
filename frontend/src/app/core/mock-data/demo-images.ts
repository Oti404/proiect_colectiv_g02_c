export interface DemoImageOption {
  id: string;
  label: string;
  dataUri: string;
}

function svgDataUri(title: string, bg: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320"><rect width="640" height="320" fill="${bg}"/><circle cx="520" cy="70" r="42" fill="${accent}" opacity="0.35"/><path d="M0 245 Q180 185 360 235 T640 215 L640 320 L0 320 Z" fill="${accent}" opacity="0.45"/><text x="36" y="160" font-family="sans-serif" font-size="26" font-weight="bold" fill="#1f2937">${title}</text><text x="36" y="196" font-family="sans-serif" font-size="16" fill="#4b5563">DogApp Demo Photo</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEMO_POST_IMAGES: DemoImageOption[] = [
  {
    id: 'img-park-walk',
    label: 'Autumn Walk in Parcul Central',
    dataUri: svgDataUri('Autumn Walk in Parcul Central', '#fef3c7', '#f59e0b'),
  },
  {
    id: 'img-dog-park',
    label: 'Gheorgheni Dog Park Playtime',
    dataUri: svgDataUri('Gheorgheni Dog Park Playtime', '#dcfce7', '#22c55e'),
  },
  {
    id: 'img-coffee-terrace',
    label: 'Dog-Friendly Coffee Terrace',
    dataUri: svgDataUri('Dog-Friendly Coffee Terrace', '#dbeafe', '#3b82f6'),
  },
];
