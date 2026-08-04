/** Deterministic seeded RNG so sample data is stable across reloads. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export const intBetween = (rng: Rng, min: number, max: number) =>
  Math.floor(between(rng, min, max + 1));

export const chance = (rng: Rng, p: number) => rng() < p;

/** Roughly normal (sum of 3 uniforms), centred 0, ~[-1.5, 1.5] */
export const jitter = (rng: Rng) => (rng() + rng() + rng()) / 3 - 0.5;

export const pickWeighted = <T,>(rng: Rng, items: readonly [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [item, w] of items) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return items[items.length - 1][0];
};
