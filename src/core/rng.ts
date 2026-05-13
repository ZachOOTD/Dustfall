// Seeded LCG for deterministic scatter

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
