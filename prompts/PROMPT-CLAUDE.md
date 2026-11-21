# Prompt untuk akun Claude lain (Claude Code)

## Melanjutkan proyek yang sudah berjalan (pakai ini sekarang)

Buka Claude Code dengan folder `D:\GAFLEX`, lalu tempel:

```
Kamu melanjutkan proyek GAFLEX yang sudah berjalan dan sudah online.

LANGKAH WAJIB SEBELUM KODE:
1. Baca HANDOFF.md (status, URL produksi, keputusan, sisa pekerjaan), lalu CLAUDE.md, lalu docs/01-PRD.md sampai docs/09-DEPLOY.md. Spesifikasi di docs/ adalah sumber kebenaran; keputusan yang sudah diambil pemilik tercatat di sana — jangan dibuka ulang. Jika ada yang ambigu, tanya saya dulu.
2. Jalankan `pnpm install`, `pnpm test`, `pnpm build`, `pnpm lint` dan tunjukkan hasilnya sebagai titik awal.
3. Panggil skill yang tercantum di docs/08-SKILLS.md untuk pekerjaan yang dikerjakan (Skill tool, nama persis).

TUGAS: kerjakan "Sisa pekerjaan" di HANDOFF.md §6 berurutan, mulai dari nomor [ISI NOMOR, mulai 1]. Untuk hal yang butuh perangkat nyata atau akun saya (uji di HP/iPad, login Railway/Vercel, git push), beri tahu saya langkahnya dan tunggu.

CARA KERJA: TDD untuk logika murni; jangan klaim selesai tanpa `pnpm test` + `pnpm build` + bukti; UI berbahasa Indonesia, kode berbahasa Inggris; perbarui HANDOFF.md di akhir sesi.
```

---

## Prompt awal (dari nol, per fase) — arsip

Satu sesi = satu fase agar token hemat.

---

```
Kamu membangun GAFLEX: website gaple (domino double-six) online untuk 4 pemain, multi-device, dengan React.

LANGKAH WAJIB SEBELUM KODE:
1. Baca CLAUDE.md, README.md, lalu docs/01-PRD.md sampai docs/08-SKILLS.md secara berurutan. Spesifikasi di docs/ adalah sumber kebenaran; jangan mengarang aturan di luarnya. Jika ada yang ambigu, tanya saya dulu.
2. Panggil skill yang tercantum di docs/08-SKILLS.md untuk fase yang sedang dikerjakan (gunakan Skill tool, nama persis). Jika skill tidak tersedia di akun ini, sebutkan lalu lanjut dengan prinsip yang sama.

RINGKASAN PRODUK (detail di docs/):
- 4 pemain, tiap pemain 1 device. Opsional device ke-5 = Table Display (iPad) yang hanya menampilkan meja.
- Mode Solo (4 saling lawan) atau Tim (N+S vs E+W).
- Host buat room -> kode 6 digit + QR (ala Kahoot) -> pemain masukkan kode -> pilih kursi N/E/S/W sesuai duduk nyata.
- Server mengacak 28 kartu, tiap pemain dapat 7, ditampilkan 3D dengan React Three Fiber.
- Setup 4 device: ada tombol View -> animasi kamera ke POV atas meja. Setup 5 device: tombol View dihilangkan, meja tampil live di device ke-5.
- Server-authoritative (Socket.IO). Client tidak pernah menerima kartu pemain lain.
- Semua animasi sesuai docs/05-UI-UX-ANIMATION.md, hormati prefers-reduced-motion.

STACK: pnpm workspaces, React 18 + Vite + TypeScript, @react-three/fiber + @react-three/drei, motion (import dari "motion/react"), Zustand, Tailwind, React Router, Node 20 + Socket.IO, Vitest.

CARA KERJA:
- Kerjakan FASE [ISI NOMOR, mulai 0] dari docs/07-ROADMAP.md saja. Jangan lompat fase.
- Aturan game ditulis sebagai fungsi murni di packages/shared/src/rules dengan TDD (test dulu).
- Di akhir fase: jalankan `pnpm test` dan `pnpm build`, tunjukkan output, dan cek kriteria "Selesai bila" di roadmap. Jangan klaim selesai tanpa bukti.
- Akhiri dengan ringkasan: file yang dibuat, cara menjalankan, dan apa yang belum diverifikasi.
- UI berbahasa Indonesia, kode berbahasa Inggris.
```

---

## Tips hemat token
- Sesi baru per fase: ganti `[ISI NOMOR]` dengan 0, lalu 1, dst.
- Fase 5 (animasi) paling berat; boleh dipecah: "Fase 5 bagian tangan pemain", "Fase 5 bagian meja & View".
