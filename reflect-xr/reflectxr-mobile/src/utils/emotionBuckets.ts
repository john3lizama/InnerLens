/**
 * emotionBuckets — map each day's mood signal onto 3 legend buckets
 * (positive / negative / neutral) for the Home-tab mood graph.
 *
 * The backend already aggregates per-entry emotions by valence sign and
 * returns shares keyed as "positive" / "negative" / "neutral", so the
 * runtime work here is trivial. The valence-sign fallback in
 * `bucketFor` only matters for legacy / in-flight responses that might
 * still carry a raw emotion string.
 *
 * The bucket key indexes into `colors.mood.<bucket>` on the theme.
 */

export type BucketKey = 'positive' | 'negative' | 'neutral';

/** Display order for the legend. */
export const MOOD_BUCKETS: BucketKey[] = ['positive', 'negative', 'neutral'];

export interface BucketInfo {
  bucket: BucketKey;
  /** True if the emotion string was already one of the canonical bucket
   *  names; false if we had to fall back on the valence arg. */
  matched: boolean;
}

/**
 * Resolve an emotion string to a bucket. The backend emits
 * "positive" | "negative" | "neutral" directly, so the happy path is a
 * pure passthrough. For any legacy or in-flight raw emotion, fall back
 * on the valence sign.
 */
export function bucketFor(emotion: string, valence: number): BucketInfo {
  const e = (emotion ?? '').toLowerCase();
  if (e === 'positive' || e === 'negative' || e === 'neutral') {
    return { bucket: e as BucketKey, matched: true };
  }
  const fallback: BucketKey =
    valence > 0 ? 'positive' : valence < 0 ? 'negative' : 'neutral';
  return { bucket: fallback, matched: false };
}

/** One colored band in a stacked pill. */
export interface Segment {
  bucket: BucketKey;
  /** Fraction of the pill this band should fill (0..1). */
  share: number;
}

/**
 * Max bands to draw per day. With only 3 buckets this is the ceiling
 * anyway, but the cap stays explicit so the render code reads the same
 * as before.
 */
const MAX_SEGMENTS = 3;

/**
 * Minimum share a band needs to be visible. Slivers under ~6% of a
 * 96px pill are <6px tall — the eye reads them as compression artifacts,
 * not meaningful signal.
 */
const MIN_SHARE = 0.06;

/**
 * Collapse a day's raw `{emotion, share, valence}` list onto the 3
 * legend buckets, then trim the long tail (top-N + share threshold)
 * and renormalize so the kept bands still fill 100% of the pill.
 *
 * Sorted largest-share first — callers stack largest at the base so
 * the dominant bucket reads as the visual foundation of the pill.
 */
export function toSegments(
  emotions: ReadonlyArray<{ emotion: string; share: number; valence: number }>,
): Segment[] {
  const byBucket = new Map<BucketKey, number>();
  for (const e of emotions) {
    const { bucket } = bucketFor(e.emotion, e.valence);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + e.share);
  }

  const kept = [...byBucket.entries()]
    .map(([bucket, share]) => ({ bucket, share }))
    .sort((a, b) => b.share - a.share)
    .filter((s) => s.share >= MIN_SHARE)
    .slice(0, MAX_SEGMENTS);

  // Renormalize so kept bands refill the pill to 100%. If the threshold
  // wiped everything out (all three buckets under 6% — not actually
  // reachable since at most 3 non-negative numbers summing to 1 can't
  // all be below 1/3), fall back to the unfiltered top-1.
  const total = kept.reduce((sum, s) => sum + s.share, 0);
  if (total <= 0) {
    const fallback = [...byBucket.entries()]
      .sort(([, a], [, b]) => b - a)[0];
    return fallback ? [{ bucket: fallback[0], share: 1 }] : [];
  }
  return kept.map((s) => ({ bucket: s.bucket, share: s.share / total }));
}
