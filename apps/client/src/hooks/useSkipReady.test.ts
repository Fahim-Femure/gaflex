import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SKIP_AFTER_MS } from '@gaflex/shared';
import { useSkipReady } from './useSkipReady';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useSkipReady', () => {
  it('stays false while nobody on turn is offline', () => {
    const { result } = renderHook(() => useSkipReady(null));
    act(() => vi.advanceTimersByTime(SKIP_AFTER_MS * 2));
    expect(result.current).toBe(false);
  });

  it('turns true only after SKIP_AFTER_MS offline', () => {
    const { result } = renderHook(() => useSkipReady('E'));
    act(() => vi.advanceTimersByTime(SKIP_AFTER_MS - 1));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('a player who comes back and drops again makes the host wait again', () => {
    const { result, rerender } = renderHook(({ seat }) => useSkipReady(seat), {
      initialProps: { seat: 'E' as string | null },
    });
    act(() => vi.advanceTimersByTime(SKIP_AFTER_MS));
    expect(result.current).toBe(true);
    rerender({ seat: null });
    rerender({ seat: 'E' });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(SKIP_AFTER_MS));
    expect(result.current).toBe(true);
  });
});
