# AGENTS.md — aturan kerja GAFLEX (untuk agen AI apa pun: Antigravity, Claude Code, dll.)

Mulai dari `HANDOFF.md` (status, produksi, keputusan, sisa pekerjaan), lalu `docs/01`–`docs/09`.
`docs/` adalah sumber kebenaran; keputusan pemilik yang tercatat di sana jangan dibuka ulang. Jika ambigu, tanya pemilik.

## Aturan
1. Server-authoritative: logika game (acak, validasi langkah, giliran, skor) hanya di server. Client tidak pernah menerima kartu pemain lain (ada test yang menjaganya).
2. Aturan game = fungsi murni di `packages/shared/src/rules`, ditulis test dulu (TDD).
3. UI berbahasa Indonesia; kode & nama variabel bahasa Inggris.
4. Animasi menghormati `prefers-reduced-motion`; DOM hanya `transform`/`opacity`; Three.js lewat `useFrame` + `invalidate()` (frameloop `demand`), bukan re-render React per frame.
5. Layar Main: HP **landscape**, POV 3D dari kursi pemain. Layar lain nyaman di portrait. Table Display: iPad landscape.
6. Jangan klaim selesai tanpa menjalankan dan menunjukkan hasil `pnpm test`, `pnpm build`, `pnpm lint`.
7. Push ke `main` = deploy produksi otomatis (Vercel; Railway lihat HANDOFF §6.3) dan **menghapus semua room aktif** di server. Jangan push saat ada yang bermain; jangan push tanpa persetujuan pemilik.
8. Rahasia: jangan commit `.env*`, `.vercel/`. Nilai env diisi tanpa BOM/spasi (pernah memutus koneksi produksi, lihat HANDOFF §8).

## Perintah
```
pnpm install
pnpm dev     # client :5173, server :3001
pnpm test
pnpm build
pnpm lint
```
