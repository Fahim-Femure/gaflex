# CLAUDE.md — aturan kerja GAFLEX

1. Baca `docs/01` s.d. `docs/08` sebelum menulis kode. Spesifikasi di `docs/` adalah sumber kebenaran.
2. Server-authoritative: semua logika game (acak, validasi langkah, giliran, skor) hanya di server. Client tidak pernah menerima kartu pemain lain.
3. Aturan game ditulis sebagai fungsi murni di `packages/shared/src/rules` dan wajib punya unit test (TDD) sebelum dipakai.
4. Bahasa UI: Indonesia. Kode & nama variabel: Inggris.
5. Semua animasi wajib menghormati `prefers-reduced-motion` dan hanya menganimasikan `transform`/`opacity` (DOM) atau transform objek (Three.js).
6. Mobile-first: layar Main pemain didesain untuk HP **landscape** (POV 3D dari kursi pemain); layar lain (landing, buat/gabung, lobby) tetap nyaman di portrait. Table Display untuk iPad landscape.
7. Jangan klaim selesai tanpa menjalankan `pnpm test` dan `pnpm build` dan menunjukkan hasilnya.
8. Kerjakan per fase sesuai `docs/07-ROADMAP.md`; satu fase selesai & terverifikasi sebelum lanjut.
