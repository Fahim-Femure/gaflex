# 04 — Protokol Realtime (Socket.IO)

Nama event disimpan sebagai konstanta di `packages/shared/src/constants/events.ts`.

## Client → Server
| Event | Payload | Keterangan |
|---|---|---|
| `room:create` | `{ name, mode, setup }` (batas skor tetap 100, docs/02) | Balas `SessionData` (`{ memberId, role, sessionToken, room }`; `room.code` = kode) |
| `room:peek` | `{ code }` | Balas `{ code, mode, setup, freeSeats, tableAvailable }` untuk layar Gabung (menampilkan opsi Meja hanya bila setup 5). Error `ROOM_NOT_FOUND` |
| `room:join` | `{ code, name }` | Balas `SessionData` atau error `ROOM_NOT_FOUND`/`ROOM_FULL` |
| `room:join_table` | `{ code }` | Hanya bila `setup === 5` dan meja kosong; balas `SessionData`, error `TABLE_UNAVAILABLE` |
| `room:leave` | `{}` | Keluar room. Di lobby: slot & kursi langsung bebas, sesi tidak berlaku lagi. Saat game: kursi tetap dipegang (terputus). Client mengirimnya saat lobby ditinggalkan (logo, Back, "Keluar room") |
| `room:disband` | `{}` | Hanya host di lobby: menutup room, memutus sesi semua peserta, dan mengirim error `ROOM_DISBANDED` ke peserta lain |
| `member:kick` | `{ seat }` | Hanya host (lobby maupun tengah game): mengeluarkan pemain yang terputus di kursi tersebut (`ROOM_KICKED`) dan membebaskan kursi untuk pemain pengganti |
| `seat:take` | `{ seat }` | Error `SEAT_TAKEN` (pemain pengganti tanpa kursi saat game dapat memilih kursi kosong) |
| `seat:leave` | `{}` | |
| `game:start` | `{}` | Hanya host; syarat 4 kursi terisi (+ meja bila setup 5) |
| `game:play` | `{ tileId, side, slam? }` | `side`: `'left'`/`'right'`; `slam: true` bila kartu didorong ke depan ("cetas") |
| `game:skip` | `{}` | Hanya host; pemain yang giliran harus terputus ≥ 15 detik (atau kursi sudah dikosongkan lewat `member:kick`), selain itu error `SKIP_NOT_ALLOWED`. Server emit `game:event` `{ type: 'passed', seat, skipped: true }` |
| `round:next` | `{}` | Hanya host |
| `session:resume` | `{ sessionToken }` | Reconnect |

`memberId` = `playerId` untuk pemain, id device untuk meja. Kode error tambahan: `TABLE_UNAVAILABLE`, `SESSION_INVALID`, `NOT_IN_ROOM`, `INVALID_PAYLOAD`, `MUST_OPEN_WITH_DOUBLE`, `SKIP_NOT_ALLOWED`, `KICK_NOT_ALLOWED`, `ROOM_KICKED`, `ROOM_DISBANDED`.

Semua memakai acknowledgement callback `(res: { ok: true, data } | { ok: false, error: ErrorCode })`.

## Server → Client
| Event | Ke | Payload |
|---|---|---|
| `room:state` | semua di room | `Room` tanpa `game` |
| `game:player_view` | per pemain | `PlayerView` |
| `game:table_view` | device meja + semua pemain (untuk mode View) | `TableView` |
| `game:event` | semua | `{ type: 'played' | 'passed' | 'round_end' | 'game_end', seat, tile?, side?, slam? }` — pemicu animasi & suara |
| `error` | pengirim | `{ code, message }` |

## Socket rooms
- `room:<code>` semua peserta; `seat:<code>:<seat>` per pemain; `table:<code>` device meja.

## Aturan
- Room penuh = 4 member pemain. Di lobby, pemain yang terputus (mis. tab ditutup) tidak menahan slot: saat pemain baru bergabung ke room penuh, pemain yang paling lama terputus dikeluarkan (kursinya bebas). Selama tidak ada yang butuh slot, refresh tetap bisa menyambung lagi.
- Server mengirim `game:event` **sebelum** view baru agar client dapat memutar animasi dari state lama ke state baru.
- Auto-pass: setelah langkah, jika pemain berikutnya tidak punya langkah legal, server emit `passed` dengan jeda 900 ms per pemain agar animasi terlihat.
