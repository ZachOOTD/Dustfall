// Shared procedural-noise GLSL (ACAU, D207 stretch).
//
// Every procedural material factory (metal / hull / stone / paint / wood / glass /
// bone / skin / fabric / concrete / terrain) injects the SAME Inigo-Quilez integer-
// hash value-noise + fBm block into its `onBeforeCompile`. Until now each file
// hand-copied a byte-identical block; this lifts the math to ONE source of truth.
//
// The block is emitted with caller-supplied function NAMES + octave count so each
// factory keeps the exact identifiers its colour logic already calls. The generated
// GLSL is byte-for-byte what each file declared inline, so shaders compile to the
// same program — materials stay pixel-identical and the per-factory program count
// (the D207 win) is unchanged. (Hash names vary by lineage: most use `<x>Hash`,
// the terrain-derived ones — terrain/hull/concrete — use `<x>Hash21`.)
//
// FOOTGUN (D207): never put a backtick or a dollar-brace in a GLSL COMMENT inside a
// template literal — it closes the literal / interpolates. This file has none.

export interface NoiseFnNames {
  /** IQ hash21 fn name, e.g. 'stoneHash' or 'terrainHash21'. */
  hash: string;
  /** Bilinear value-noise fn name, e.g. 'stoneValueNoise'. */
  valueNoise: string;
  /** fBm fn name, e.g. 'stoneFbm'. */
  fbm: string;
  /** fBm octave count — material factories use 3 or 4. */
  octaves: number;
}

/** Emit the shared IQ hash / value-noise / fBm GLSL with the given function names.
 *  Splice into a shader's `#include <common>` injection (vertex or fragment). */
export function iqNoise2D({ hash, valueNoise, fbm, octaves }: NoiseFnNames): string {
  return /* glsl */ `
        float ${hash}(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }
        float ${valueNoise}(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = ${hash}(i + vec2(0.0, 0.0));
          float b = ${hash}(i + vec2(1.0, 0.0));
          float c = ${hash}(i + vec2(0.0, 1.0));
          float d = ${hash}(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float ${fbm}(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < ${octaves}; i++) {
            v += a * ${valueNoise}(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }`;
}
