import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, UI } from '../../lib/motion';

/**
 * A seat's panel during play. The seat whose turn it is gets a rotating ring of light
 * (docs/05; CSS animation, transform only, static under reduced motion) and a text label.
 * A PAS badge scales in and leaves after 900 ms (timing owned by the store).
 */
export function SeatStatus({
  name,
  count,
  isTurn,
  passed,
  offline = false,
  large = false,
  compact = false,
  className = '',
}: {
  name: ReactNode;
  count: number;
  isTurn: boolean;
  passed: boolean;
  /** The player dropped out; their turn waits for them to reconnect (2 min). */
  offline?: boolean;
  large?: boolean;
  /** One-line pill for the 3D play screen, so it does not hide the opponent's tiles. */
  compact?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const style = isTurn ? ({ '--turn-fill': 'var(--color-ivory)' } as CSSProperties) : undefined;
  if (compact) {
    return (
      <div
        style={style}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold ${
          isTurn ? 'turn-ring bg-ivory text-felt-deep' : 'bg-felt-deep/85'
        } ${className}`}
      >
        <span className="max-w-28 truncate" title={typeof name === 'string' ? name : undefined}>
          {name}
        </span>
        <span className="tabular-nums opacity-80">{count}</span>
        {offline && <span className="rounded-full bg-pip-red px-2 text-xs font-black text-ivory">putus</span>}
        <AnimatePresence initial={false}>
          {passed && (
            <motion.span
              key="pas"
              className="rounded-full bg-pip-red px-2 text-xs font-black text-ivory"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.9)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: UI.fast } : { type: 'spring', duration: 0.3, bounce: 0.25 }}
            >
              PAS
            </motion.span>
          )}
        </AnimatePresence>
        {isTurn && !passed && <span className="sr-only">sedang giliran</span>}
      </div>
    );
  }
  return (
    <div
      style={style}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-3xl px-2 py-3 text-center ${
        isTurn ? 'turn-ring bg-ivory text-felt-deep' : 'bg-felt-raised'
      } ${className}`}
    >
      <span className={`max-w-full truncate font-extrabold ${large ? 'text-xl' : 'text-lg'}`}>{name}</span>
      <span className={`font-bold ${large ? 'text-base' : 'text-sm'}`}>{count} kartu</span>
      {offline && <span className="text-sm font-bold text-pip-red-soft">Terputus</span>}
      <span className="relative flex min-h-6 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {passed ? (
            <motion.span
              key="pas"
              className="rounded-full bg-pip-red px-3 text-sm font-black text-ivory"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'scale(0.9)' }}
              animate={{ opacity: 1, transform: 'scale(1)' }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: UI.fast } : { type: 'spring', duration: 0.3, bounce: 0.25 }}
            >
              PAS
            </motion.span>
          ) : isTurn ? (
            <motion.span
              key="turn"
              className="text-sm font-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: UI.fast, ease: EASE_OUT }}
            >
              Giliran
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </div>
  );
}
