import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, UI } from '../../lib/motion';
import { useGameStore } from '../../store/useGameStore';

/**
 * docs/05: "Menyambung ulang…" slides down while the socket is away. Without a session
 * (landing, create, join) the same banner says the server cannot be reached.
 * Also hosts the one-off notice (room closed, session ended).
 */
export function ReconnectBanner() {
  const connection = useGameStore((s) => s.connection);
  const hasSession = useGameStore((s) => s.session !== null);
  const notice = useGameStore((s) => s.notice);
  const clearNotice = useGameStore((s) => s.clearNotice);
  const reduce = useReducedMotion();
  const offline = connection === 'offline';

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, 6000);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);

  const enter = reduce ? { opacity: 0 } : { transform: 'translateY(-100%)' };
  const shown = reduce ? { opacity: 1 } : { transform: 'translateY(0%)' };

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col">
      <AnimatePresence>
        {offline && (
          <motion.div
            key="offline"
            role="status"
            className="safe-top bg-pip-red px-4 py-2 text-center text-base font-bold text-ivory"
            initial={enter}
            animate={shown}
            exit={enter}
            transition={{ duration: UI.slow, ease: EASE_OUT }}
          >
            {hasSession ? 'Menyambung ulang…' : 'Tidak terhubung ke server. Mencoba lagi…'}
          </motion.div>
        )}
        {notice && (
          <motion.div
            key={`notice-${notice.at}`}
            role="alert"
            className="safe-top flex items-center justify-center gap-3 bg-ivory px-4 py-2 text-center text-base font-bold text-felt-deep"
            initial={enter}
            animate={shown}
            exit={enter}
            transition={{ duration: UI.slow, ease: EASE_OUT }}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={clearNotice} className="tappable min-h-11 rounded-full px-3 underline underline-offset-4">
              Tutup
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
