const MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'Kode room tidak ditemukan.',
  ROOM_FULL: 'Room sudah penuh (4 pemain).',
  SEAT_TAKEN: 'Kursi itu sudah diambil.',
  TABLE_UNAVAILABLE: 'Room ini tidak memakai device meja, atau meja sudah terhubung.',
  SESSION_INVALID: 'Sesi kamu sudah berakhir. Gabung lagi dengan kode room.',
  NOT_IN_ROOM: 'Kamu belum bergabung di room ini.',
  INVALID_PAYLOAD: 'Data belum lengkap. Periksa isian kamu.',
  NOT_HOST: 'Hanya host yang bisa melakukan ini.',
  NOT_READY: 'Belum siap: 4 kursi harus terisi (dan meja terhubung bila 5 device).',
  GAME_IN_PROGRESS: 'Permainan sedang berjalan.',
  ROUND_IN_PROGRESS: 'Ronde masih berjalan.',
  NOT_YOUR_TURN: 'Belum giliranmu.',
  TILE_NOT_OWNED: 'Kartu itu bukan milikmu.',
  INVALID_MOVE: 'Kartu itu tidak cocok dengan ujung meja.',
  MUST_OPEN_WITH_DOUBLE_SIX: 'Ronde pertama harus dibuka dengan balak 6-6.',
  TIMEOUT: 'Server tidak menjawab. Cek koneksi lalu coba lagi.',
};

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? 'Terjadi kesalahan. Coba lagi.';
}
