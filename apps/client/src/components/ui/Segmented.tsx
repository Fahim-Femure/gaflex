import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Option<T> = { value: T; label: string; hint?: string };

/** Segmented choice; the highlight slides between options (docs/05: layout animation). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-base font-bold text-ivory">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[28px] bg-felt-deep p-1">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className="tappable relative flex min-h-12 flex-1 flex-col items-center justify-center rounded-3xl px-3 py-2"
            >
              {selected && (
                <motion.span
                  layoutId={`seg-${id}`}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-3xl bg-ivory"
                  transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.28, bounce: 0 }}
                />
              )}
              <span className={`relative text-lg font-extrabold ${selected ? 'text-felt-deep' : 'text-ivory'}`}>
                {opt.label}
              </span>
              {opt.hint && (
                <span className={`relative text-sm font-semibold ${selected ? 'text-felt-deep/80' : 'text-ivory/75'}`}>
                  {opt.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
