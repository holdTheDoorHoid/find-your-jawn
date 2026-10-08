import { card } from '../strings/en';
import { titleCase } from './text';
import type { Group } from './types';

/** The place to show under a group's name: its first neighborhood, or "Online", or nothing. */
export function placeLine(g: Group, places: Record<string, string> = {}): string | null {
  const here = g.locations.find((l) => l.in_city && (l.neighborhood || l.planning_district));
  if (here) {
    if (here.neighborhood) return places[here.neighborhood] ?? titleCase(here.neighborhood);
    if (here.planning_district) return places[here.planning_district] ?? titleCase(here.planning_district);
  }
  if (g.locations.some((l) => !l.in_city)) return null;
  return g.online_ok ? card.online : null;
}
