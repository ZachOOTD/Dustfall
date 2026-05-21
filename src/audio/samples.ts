// Tolerant audio-sample preloader. Fetches OGG files from /public/audio and
// decodes them via the active AudioContext. Missing or undecodable files
// resolve to `null` so the soundscape can degrade gracefully — the build
// is never blocked by an absent stem.
//
// Files live in `public/audio/`. See session-X plan for the file contract.

export type SampleId =
  | 'wind-calm' | 'wind-mid' | 'wind-storm'
  | 'day-bed' | 'night-bed'
  | 'music-calm' | 'music-tense';

const URLS: Record<SampleId, string> = {
  'wind-calm':   '/audio/wind-calm.ogg',
  'wind-mid':    '/audio/wind-mid.ogg',
  'wind-storm':  '/audio/wind-storm.ogg',
  'day-bed':     '/audio/day-bed.ogg',
  'night-bed':   '/audio/night-bed.ogg',
  'music-calm':  '/audio/music-calm.ogg',
  'music-tense': '/audio/music-tense.ogg',
};

const _buffers = new Map<SampleId, AudioBuffer | null>();
let _started = false;

/** Resolves once every fetch+decode has settled (success or fail). Idempotent. */
export async function preloadSamples(ctx: AudioContext): Promise<void> {
  if (_started) return;
  _started = true;
  await Promise.all(
    (Object.keys(URLS) as SampleId[]).map(async (id) => {
      try {
        const res = await fetch(URLS[id]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        _buffers.set(id, buf);
      } catch (e) {
        // AAL — was console.warn (flooded the preview tab when .ogg
        // samples aren't shipped). Silent fallback to null; soundscape.ts
        // already gracefully skips samples whose buffer is null.
        void e;
        _buffers.set(id, null);
      }
    }),
  );
}

export function getSample(id: SampleId): AudioBuffer | null {
  return _buffers.get(id) ?? null;
}
