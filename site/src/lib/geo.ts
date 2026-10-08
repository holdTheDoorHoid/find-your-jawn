// Philadelphia's 18 planning districts and the six broad parts of the city we group them into.
// A vocabulary file may supply its own region for a district; this table is the fallback.

export const REGIONS: { id: string; label: string }[] = [
  { id: 'center-city', label: 'Center City' },
  { id: 'north', label: 'North and River Wards' },
  { id: 'northeast', label: 'Northeast' },
  { id: 'northwest', label: 'Northwest' },
  { id: 'west-southwest', label: 'West and Southwest' },
  { id: 'south', label: 'South' },
];

/** district id (slug) to region id */
export const DISTRICT_REGION: Record<string, string> = {
  central: 'center-city',
  'lower-north': 'north',
  north: 'north',
  'upper-north': 'north',
  'river-wards': 'north',
  'north-delaware': 'northeast',
  'lower-northeast': 'northeast',
  'central-northeast': 'northeast',
  'lower-far-northeast': 'northeast',
  'upper-far-northeast': 'northeast',
  'lower-northwest': 'northwest',
  'upper-northwest': 'northwest',
  west: 'west-southwest',
  'west-park': 'west-southwest',
  'university-southwest': 'west-southwest',
  'lower-southwest': 'west-southwest',
  south: 'south',
  'lower-south': 'south',
};

export const OTHER_REGION = { id: 'other', label: 'Other' };

export function regionLabel(id: string): string {
  return REGIONS.find((r) => r.id === id)?.label ?? OTHER_REGION.label;
}
