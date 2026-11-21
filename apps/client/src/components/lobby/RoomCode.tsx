import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { EASE_OUT, UI } from '../../lib/motion';
import { Button } from '../ui/Button';

function joinUrl(code: string) {
  return `${window.location.origin}/join/${code}`;
}

export function RoomCode({ code, large = false }: { code: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const reduce = useReducedMotion();
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section aria-label="Kode room" className="flex flex-col items-center gap-4 rounded-[28px] bg-felt-raised p-5">
      <p className="text-base font-bold text-ivory">Kode room</p>
      {/* docs/05: digits appear with a 40 ms stagger */}
      <p
        className={`flex font-black tracking-[0.12em] text-ivory tabular-nums ${large ? 'text-7xl' : 'text-5xl'}`}
        aria-label={code.split('').join(' ')}
      >
        {code.split('').map((ch, i) => (
          <motion.span
            key={`${code}-${i}`}
            aria-hidden="true"
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(10px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={{ duration: UI.base, ease: EASE_OUT, delay: i * 0.04 }}
          >
            {ch}
          </motion.span>
        ))}
      </p>
      <div className="rounded-3xl bg-ivory p-3">
        <QRCodeSVG value={joinUrl(code)} size={large ? 220 : 156} bgColor="#f8f1e0" fgColor="#0a2e22" title={`QR untuk gabung room ${code}`} />
      </div>
      <Button variant="secondary" onClick={copy}>
        Salin kode
      </Button>
      <p aria-live="polite" className="min-h-8">
        <AnimatePresence>
          {copied && (
            <motion.span
              className="inline-block rounded-full bg-ivory px-4 py-1 text-base font-bold text-felt-deep"
              initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(6px) scale(0.96)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: UI.base, ease: EASE_OUT }}
            >
              Kode tersalin
            </motion.span>
          )}
        </AnimatePresence>
      </p>
      {isLocalhost && (
        <p className="text-center text-sm text-ivory/80">
          QR berisi alamat localhost. Agar HP lain bisa memindai, buka GAFLEX lewat alamat IP jaringan komputer ini.
        </p>
      )}
    </section>
  );
}
