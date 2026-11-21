# 04 — Protokol Realtime (Socket.IO)

Nama event disimpan sebagai konstanta di `packages/shared/src/constants/events.ts`.

## Client → Server
| Event | Payload | Keterangan |
|---|---|---|
| `room:create` | `{ name, mode, setup, targetScore }` | Balas `SessionData` (`{ memberId, role, sessionToken, room }`; `room.code` = kode) |
| `room:peek` | `{ code }` | Balas `{ code, mode, setup, freeSeats, tableAvailable }` untuk layar Gabung (menampilkan opsi Meja hanya bila setup 5). Error `ROOM_NOT_FOUND` |
| `room:join` | `{ code, name }` | Balas `SessionData` atau error `ROOM_NOT_FOUND`/`ROOM_FULL` |
| `room:join_table` | `{ code }` | Hanya bila `setup === 5` dan meja kosong; balas `SessionData`, error `TABLE_UNAVAILABLE` |
| `seat:take` | `{ seat }` | Error `SEAT_TAKEN` |
| `seat:leave` | `{}` | |
| `game:start` | `{}` | Hanya host; syarat 4 kursi terisi (+ meja bila setup 5) |
| `game:play` | `{ tileId, side }` | `side`: `'left'`/`'right'` |
| `game:skip` | `{}` | Hanya host; pemain yang giliran harus terputus ≥ 15 detik, selain itu error `SKIP_NOT_ALLOWED`. Server emit `game:event` `{ type: 'passed', seat, skipped: true }` |
| `round:next` | `{}` | Hanya host |
| `session:resume` | `{ sessionToken }` | Reconnect |

`memberId` = `playerId` untuk pemain, id device untuk meja. Kode error tambahan: `TABLE_UNAVAILABLE`, `SESSION_INVALID`, `NOT_IN_ROOM`, `INVALID_PAYLOAD`, `SKIP_NOT_ALLOWED`.

Semua memakai acknowledgement callback `(res: { ok: true, data } | { ok: false, error: ErrorCode })`.

## Server → Client
| Event | Ke | Payload |
|---|---|---|
| `room:state` | semua di room | `Room` tanpa `game` |
| `game:player_view` | per pemain | `PlayerView` |
| `game:table_view` | device meja + semua pemain (untuk mode View) | `TableView` |
| `game:event` | semua | `{ type: 'played' | 'passed' | 'round_end' | 'game_end', seat, tile?, side? }` — pemicu animasi |
| `error` | pengirim | `{ code, message }` |

## Socket rooms
- `room:<code>` semua peserta; `seat:<code>:<seat>` per pemain; `table:<code>` device meja.

## Aturan
- Server mengirim `game:event` **sebelum** view baru agar client dapat memutar animasi dari state lama ke state baru.
- Auto-pass: setelah langkah, jika pemain berikutnya tidak punya langkah legal, server emit `passed` dengan jeda 900 ms per pemain agar animasi terlihat.
