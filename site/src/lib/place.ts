import { card } from '../strings/en';
import { titleCase } from './text';
import type { Group, GroupLocation } from './types';

// The pipeline marks addresses that are on file but may be someone's home with these labels, and
// publishes only the ZIP for them (docs/DATA_MODEL.md section 3). They are not meeting places.
export const MAILING_LABELS = ['Mailing address (IRS)', 'Contact address (City list)'];

export function isMailingLocation(l: GroupLocation): boolean {
  return l.label !== undefined && MAILING_LABELS.includes(l.label);
}

function hasPlace(l: GroupLocation): boolean {
  return Boolean(l.address || l.neighborhood || l.planning_district);
}

/**
 * The locations that say where a group is: its meeting places when any of them carries a place,
 * otherwise every location (a group known only by a mailing ZIP still belongs to a part of the city).
 */
export function placeLocations(g: Group): GroupLocation[] {
  const meeting = g.locations.filter((l) => !isMailingLocation(l));
  return meeting.some(hasPlace) ? meeting : g.locations;
}

/** True when the group has a real meeting place we can point to. */
export function hasMeetingPlace(g: Group): boolean {
  return g.locations.some((l) => !isMailingLocation(l) && Boolean(l.address || l.neighborhood));
}

/** The place to show under a group's name: its first neighborhood, or "Online", or nothing. */
export function placeLine(g: Group, places: Record<string, string> = {}): string | null {
  const here = placeLocations(g).find((l) => l.in_city && (l.neighborhood || l.planning_district));
  if (here) {
    if (here.neighborhood) return places[here.neighborhood] ?? titleCase(here.neighborhood);
    if (here.planning_district) return places[here.planning_district] ?? titleCase(here.planning_district);
  }
  if (g.locations.some((l) => !l.in_city)) return null;
  return g.online_ok ? card.online : null;
}
