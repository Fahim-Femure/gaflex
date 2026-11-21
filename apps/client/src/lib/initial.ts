const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

/** First user-perceived character of a name (emoji and accents stay whole), upper-cased. */
export function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const first = segmenter ? segmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment : Array.from(trimmed)[0];
  return (first ?? '?').toUpperCase();
}
