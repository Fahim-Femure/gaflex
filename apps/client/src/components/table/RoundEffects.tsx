import { useEffect, useRef, type CSSProperties } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '../../lib/motion';

/** Score counting up (docs/05). Writes text directly: no React render per frame. */
export function CountUp({ from, to }: { from: number; to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || from === to) {
      el.textContent = String(to);
      return;
    }
    const controls = animate(from, to, {
      duration: 0.9,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [from, to, reduce]);

  return <span ref={ref}>{from}</span>;
}

const COLORS = ['#f8f1e0', '#b3362b', '#1c5c46', '#f3d27a'];

/**
 * Light confetti for the winner (docs/05): 24 pieces, one 1.2 s burst, transform/opacity only.
 * Values are derived from the index so render stays pure. Hidden under reduced motion (CSS).
 */
export function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {Array.from({ length: 24 }, (_, i) => {
        const left = ((i * 37) % 100) + 0.5;
        const dx = (((i * 53) % 120) - 60).toFixed(0);
        const rot = 240 + ((i * 71) % 300);
        const style = {
          left: `${left}%`,
          '--dx': `${dx}px`,
          '--rot': `${rot}deg`,
          animationDelay: `${(i % 6) * 40}ms`,
          background: COLORS[i % COLORS.length],
        } as CSSProperties;
        return <span key={i} className="confetti-piece absolute top-0 h-3 w-2 rounded-sm" style={style} />;
      })}
    </div>
  );
}
