import { describe, expect, it } from 'vitest';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it('maps lobby error codes to Indonesian sentences', () => {
    expect(errorMessage('ROOM_NOT_FOUND')).toBe('Kode room tidak ditemukan.');
    expect(errorMessage('ROOM_FULL')).toBe('Room sudah penuh (4 pemain).');
    expect(errorMessage('SEAT_TAKEN')).toBe('Kursi itu sudah diambil.');
    expect(errorMessage('TABLE_UNAVAILABLE')).toBe('Room ini tidak memakai device meja, atau meja sudah terhubung.');
  });

  it('explains why the host cannot skip yet', () => {
    expect(errorMessage('SKIP_NOT_ALLOWED')).toBe('Pemain itu belum bisa dilewati: tunggu sampai 15 detik terputus.');
  });

  it('explains the round-1 0-0 opener rule', () => {
    expect(errorMessage('MUST_OPEN_WITH_DOUBLE_ZERO')).toBe('Ronde pertama harus dibuka dengan balak 0-0.');
  });

  it('falls back for timeouts and unknown codes', () => {
    expect(errorMessage('TIMEOUT')).toBe('Server tidak menjawab. Cek koneksi lalu coba lagi.');
    expect(errorMessage('SOMETHING_ELSE')).toBe('Terjadi kesalahan. Coba lagi.');
  });
});
