# 07 — Roadmap (kerjakan berurutan)

| Fase | Isi | Selesai bila |
|---|---|---|
| 0. Setup | pnpm workspace, Vite React TS, server TS, shared package, Tailwind, ESLint, Vitest | `pnpm dev` jalan client+server; `pnpm test` hijau |
| 1. Aturan game | Fungsi murni di `packages/shared/src/rules` (lihat 02) via TDD | Semua test lulus, termasuk buntu/seri/dua ujung |
| 2. Room & lobby | create/join/seat/table device, kode 6 digit, QR, reconnect | 5 tab browser bisa masuk room & duduk realtime |
| 3. Game loop server | start, deal, play, auto-pass, akhir ronde, skor, view tersaring | Satu ronde penuh bisa dimainkan lewat UI sederhana (2D) |
| 4. Three.js | `<Tile>`, HandScene, TableScene, layoutChain | Tangan & meja tampil 3D di HP dan iPad |
| 5. Animasi | Semua animasi di 05 + reduced motion | Dicek manual di HP & iPad, 60 fps |
| 6. Mode setup | 4 device (tombol View + kamera) vs 5 device (tanpa View, Table Display) | Kedua mode diuji end-to-end |
| 7. Polish & deploy | suara, haptic, error state, deploy client & server | URL publik bisa dimainkan 5 device |
