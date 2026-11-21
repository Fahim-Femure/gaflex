import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Domino } from '../table/Domino';

const TILES: [number, number][] = [
  [6, 6],
  [6, 3],
  [3, 1],
  [1, 5],
];

/** Plays once per app session, not on every visit to the landing page. */
let played = false;

/** Landing logo: gaple tiles drop in and settle side by side (docs/05: spring, 600 ms, once). */
export function LogoTiles() {
  const reduce = useReducedMotion();
  const [animateIn] = useState(() => !played);
  useEffect(() => {
    played = true;
  }, []);

  return (
    <div aria-hidden="true" className="flex items-end gap-1.5">
      {TILES.map(([a, b], i) => (
        <motion.span
          key={`${a}-${b}`}
          className="inline-flex"
          initial={
            animateIn
              ? reduce
                ? { opacity: 0 }
                : { opacity: 0, transform: `translateY(-90px) rotate(${i % 2 ? 18 : -18}deg)` }
              : false
          }
          animate={{ opacity: 1, transform: 'translateY(0px) rotate(0deg)' }}
          transition={
            reduce
              ? { duration: 0.2, delay: i * 0.05 }
              : { type: 'spring', duration: 0.6, bounce: 0.25, delay: i * 0.06 }
          }
        >
          <Domino first={a} second={b} vertical size="sm" />
        </motion.span>
      ))}
    </div>
  );
}
