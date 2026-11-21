import { useId, type InputHTMLAttributes } from 'react';

export function TextField({
  label,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-bold text-ivory">
        {label}
      </label>
      <input
        id={id}
        className={`min-h-14 rounded-3xl bg-felt-deep px-5 text-lg font-bold text-ivory placeholder:text-ivory/50 ${className}`}
        {...props}
      />
    </div>
  );
}
