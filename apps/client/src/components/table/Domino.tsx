import { PIP_SPOTS } from '../../lib/chain';

const SIZES = {
  sm: { half: 'h-7 w-7', pip: 'h-1.5 w-1.5', pad: 'p-[3px]' },
  md: { half: 'h-11 w-11', pip: 'h-2 w-2', pad: 'p-1' },
  lg: { half: 'h-14 w-14', pip: 'h-2.5 w-2.5', pad: 'p-1.5' },
} as const;

function Half({ value, size }: { value: number; size: keyof typeof SIZES }) {
  const s = SIZES[size];
  const spots = PIP_SPOTS[value] ?? [];
  return (
    <span className={`grid grid-cols-3 grid-rows-3 place-items-center ${s.half} ${s.pad}`}>
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          key={cell}
          className={`${s.pip} rounded-full ${spots.includes(cell) ? (value === 1 ? 'bg-pip-red' : 'bg-pip') : ''}`}
        />
      ))}
    </span>
  );
}

/** Flat 2D domino. Vertical reads top -> bottom, horizontal left -> right. */
export function Domino({
  first,
  second,
  vertical = false,
  size = 'md',
}: {
  first: number;
  second: number;
  vertical?: boolean;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      role="img"
      aria-label={`Kartu ${first}-${second}`}
      className={`inline-flex shrink-0 items-center rounded-lg bg-ivory ${vertical ? 'flex-col' : 'flex-row'}`}
    >
      <Half value={first} size={size} />
      <span aria-hidden="true" className={`bg-pip/60 ${vertical ? 'h-[2px] w-[70%]' : 'h-[70%] w-[2px] self-stretch my-1'}`} />
      <Half value={second} size={size} />
    </span>
  );
}
