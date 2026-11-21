/** Easing tokens (same values as --ease-out / --ease-in-out in index.css). */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** UI durations in seconds (docs/05: UI 150–300 ms). */
export const UI = { fast: 0.15, base: 0.2, slow: 0.28 } as const;
