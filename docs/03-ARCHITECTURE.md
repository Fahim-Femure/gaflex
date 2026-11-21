# 03 — Arsitektur

## Monorepo (pnpm workspaces)
- `apps/client` — React 18 + Vite + TypeScript, React Three Fiber + @react-three/drei, Motion (`motion/react`), Zustand, Tailwind, React Router, `qrcode.react`.
- `apps/server` — Node 20 + TypeScript + Socket.IO (+ Express untuk health check). State room di memori (Map). Opsional Redis adapter nanti.
- `packages/shared` — tipe TS, aturan game murni, konstanta, nama event socket. Diimpor oleh client & server.

## Prinsip
- **Server-authoritative**: server memegang `GameState` penuh. Tiap client menerima **view** yang sudah disaring:
  - `PlayerView`: tangan sendiri, meja, jumlah kartu lawan, giliran, skor.
  - `TableView`: meja, jumlah kartu tiap pemain, giliran, skor (tanpa tangan siapa pun).
- Client hanya mengirim *intent* (`play_tile`, `take_seat`, …), server memvalidasi lalu broadcast.

## Model data inti (packages/shared/src/types)
```ts
type Seat = 'N' | 'E' | 'S' | 'W';
type Tile = { id: string; a: number; b: number };          // a <= b
type Placed = { tile: Tile; side: 'left' | 'right'; flipped: boolean; order: number };
type Mode = 'solo' | 'team';
type DeviceSetup = 4 | 5;
type Room = {
  code: string; hostId: string; mode: Mode; setup: DeviceSetup;
  seats: Record<Seat, { playerId: string; name: string; connected: boolean } | null>;
  tableDeviceId: string | null;
  status: 'lobby' | 'playing' | 'round_end' | 'game_end';
  game: GameState | null;
};
type GameState = {
  hands: Record<Seat, Tile[]>; chain: Placed[]; ends: [number, number] | null;
  turn: Seat; passStreak: number; round: number;
  scores: Record<string, number>;  // titik kalah game ini; > 100 = kalah (docs/02)
  tally: Record<string, number>;   // papan game: Tim = menang per tim, Solo = kalah per pemain
  lastActor: Seat | null; winner: Seat | 'A' | 'B' | null; openerWaived: boolean;
};
```

## Kode room
- 6 karakter dari alfabet tanpa karakter ambigu: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. Unik di antara room aktif.

## Routing client
- `/` Landing · `/create` · `/join` · `/join/:code` (dari QR) · `/room/:code/lobby` · `/room/:code/play` · `/room/:code/table`.

## State client
- Zustand store: `connection`, `room`, `view`, `ui` (isViewing, selectedTile, reducedMotion).

## Deploy
- Client: Vercel/Netlify. Server: Railway/Render/Fly (perlu WebSocket). ENV: `VITE_SERVER_URL`, `PORT`, `CORS_ORIGIN`.
