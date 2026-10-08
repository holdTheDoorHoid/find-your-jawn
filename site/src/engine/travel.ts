import type { LatLng } from './centroids';
import type { TravelMode } from './types';

// Travel time estimates. This is the ONE place that knows how people get around.
//
// Today it is a straight line guess: the distance between two points, stretched a little for
// streets, divided by a speed that depends on how the person travels. The matching engine only
// calls `TravelModel.minutes`, so real transit times (SEPTA schedules, a routing service, a
// precomputed table of neighborhood to neighborhood times) can replace `straightLineTravel` later
// without touching anything else. Keep it pure: no network, no storage.

export type MovingMode = Exclude<TravelMode, 'anywhere'>;

export interface TravelModel {
  /** Minutes door to door, always at least 0. */
  minutes(from: LatLng, to: LatLng, mode: MovingMode): number;
}

/** Streets are longer than the straight line. Philadelphia's grid is gentle, so about 30 percent. */
export const ROUTE_FACTOR = 1.3;
/** Walking pace in miles per hour. */
export const WALK_MPH = 3;
/** SEPTA door to door, including the walk to the stop and the wait: 8 to 10 miles per hour. */
export const SEPTA_MPH = 9;
/** No trip on SEPTA takes less than this, because of the wait. */
export const SEPTA_MIN_MINUTES = 10;
/** Driving in the city, including lights and slow streets. */
export const DRIVE_MPH = 18;
/** Finding a place to park. */
export const PARK_MINUTES = 5;

const KM_PER_MILE = 1.609344;

/** Straight line distance in kilometers between two latitude and longitude points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(s)));
}

function minutesAt(routedKm: number, mph: number): number {
  return (routedKm / (mph * KM_PER_MILE)) * 60;
}

export const straightLineTravel: TravelModel = {
  minutes(from, to, mode) {
    const routed = haversineKm(from, to) * ROUTE_FACTOR;
    const walk = minutesAt(routed, WALK_MPH);
    if (mode === 'walk') return walk;
    if (mode === 'drive') return Math.max(PARK_MINUTES + 3, minutesAt(routed, DRIVE_MPH) + PARK_MINUTES);
    // On SEPTA, a short trip is faster on foot.
    return Math.min(walk, Math.max(SEPTA_MIN_MINUTES, minutesAt(routed, SEPTA_MPH)));
  },
};

/** Round to the nearest 5 minutes for display, never below 5. "About 25 minutes". */
export function roundMinutes(m: number): number {
  return Math.max(5, Math.round(m / 5) * 5);
}
