import type { Placed } from '@gaflex/shared';
import { chainSequence } from '../../lib/chain';
import { Domino } from './Domino';

/** 2D chain; the 3D layout with snake turns arrives in Phase 4. */
export function ChainView({
  chain,
  ends,
  size = 'sm',
}: {
  chain: Placed[];
  ends: [number, number] | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const items = chainSequence(chain);
  return (
    <section aria-label="Meja" className="flex flex-col gap-3 rounded-[28px] bg-felt-deep p-4">
      {items.length === 0 ? (
        <p className="py-6 text-center text-lg font-bold">Meja masih kosong</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-1">
          {items.map((it) => (
            <Domino key={it.id} first={it.left} second={it.right} vertical={it.double} size={size} />
          ))}
        </div>
      )}
      <p className="text-center text-base font-bold">
        {ends ? `Ujung kiri ${ends[0]} · ujung kanan ${ends[1]}` : 'Belum ada ujung terbuka'}
      </p>
    </section>
  );
}
