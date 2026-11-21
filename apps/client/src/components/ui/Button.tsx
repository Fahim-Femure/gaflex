import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ivory text-felt-deep hover:bg-white',
  secondary: 'bg-felt-raised text-ivory hover:bg-felt-high',
  ghost: 'bg-transparent text-ivory hover:bg-felt-raised',
};

/**
 * Press: scale 0.97 in 150 ms. Enabling (e.g. host "Mulai") fades from 45% to full opacity,
 * so the state change reads without animating colour (docs/05: transform/opacity only).
 */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`tappable inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-lg font-extrabold transition-[transform,opacity] duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 motion-reduce:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
