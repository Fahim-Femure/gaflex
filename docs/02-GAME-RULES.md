# 02 — Aturan Gaple (Domino Double-Six)

## Set kartu
- 28 kartu: semua pasangan (a,b) dengan 0 ≤ a ≤ b ≤ 6.
- Balak (double): 0-0, 1-1, …, 6-6.
- 4 pemain × 7 kartu = 28 → semua kartu terbagi, tidak ada sisa (boneyard kosong).

## Pengacakan
- Fisher–Yates shuffle di server memakai `crypto.randomInt`.
- Seed tidak pernah dikirim ke client.

## Kursi & giliran
- Kursi: `N` (Utara), `E` (Timur), `S` (Selatan), `W` (Barat). Urutan giliran: N → E → S → W → N.
- Mode Tim: N & S = Tim A, E & W = Tim B (duduk berseberangan).

## Pembuka
- Ronde pertama: pemegang **6-6** jalan pertama dan wajib membuka dengan 6-6. (Konstanta `OPENER_TILE`, dapat diubah di `packages/shared/src/constants`.)
- Ronde berikutnya: pemenang ronde sebelumnya jalan pertama, bebas kartu apa pun.

## Langkah
- Meja punya 2 ujung terbuka (kiri & kanan). Pemain menaruh 1 kartu yang salah satu sisinya cocok dengan salah satu ujung.
- Jika kartu cocok di kedua ujung, pemain memilih ujung (UI menampilkan 2 target).
- Balak dipasang melintang (tegak lurus rantai) — hanya visual, nilai ujung tetap sama.
- Tidak punya kartu yang cocok → otomatis **PAS** (server yang menentukan; client menampilkan animasi "Pas").
- **Pemain terputus** (diputuskan 2026-11-22): giliran menunggu dia. Bila pemain yang sedang giliran sudah terputus ≥ 15 detik (`SKIP_AFTER_MS`), **host** boleh menekan "Lewati" → dihitung sebagai PAS. Jika yang dilewati adalah pembuka ronde 1 (pemegang 6-6) dan meja masih kosong, aturan wajib 6-6 gugur: pemain berikutnya boleh membuka dengan kartu apa pun (`GameState.openerWaived`).

## Akhir ronde
1. **Habis kartu**: pemain pertama yang menghabiskan 7 kartu menang.
2. **Gaple / buntu**: semua 4 pemain berturut-turut pas → ronde berhenti. Pemenang = total titik (pip) terkecil di tangan. Mode Tim: jumlah titik tim terkecil. Seri → pemain yang lebih dahulu dalam urutan giliran dari pemain terakhir yang menaruh kartu.

### Klarifikasi (diputuskan 2026-11-20)
- **Seri bersifat inklusif**: hitung urutan giliran mulai dari pemain terakhir yang menaruh kartu itu sendiri. Jika dia ikut seri, dia menang. Mode Tim seri total → tim dari pemain pertama dalam urutan itu.
- **Pembuka ronde berikutnya**: habis kartu → pemain yang habis. Buntu Solo → pemenang. Buntu Tim → anggota tim pemenang dengan titik tangan terkecil; sama → aturan seri di atas.

## Skor (default, dapat dikonfigurasi)
- Pemenang/tim pemenang mendapat poin = total titik kartu yang tersisa di tangan lawan. Mode Tim: hanya tangan 2 pemain tim lawan (titik rekan setim tidak dihitung).
- Game selesai saat ada yang mencapai `TARGET_SCORE` = 100 (konfigurasi host: 50/100/150).

## Validasi (semua di server)
- Bukan giliran → tolak `NOT_YOUR_TURN`.
- Kartu bukan milik pemain → tolak `TILE_NOT_OWNED`.
- Tidak cocok dengan ujung yang dipilih → tolak `INVALID_MOVE`.
- Pembuka ronde 1 bukan 6-6 → tolak `MUST_OPEN_WITH_DOUBLE_SIX`.

## Fungsi murni wajib (packages/shared/src/rules)
`createDeck()`, `shuffle(deck, rng)`, `deal(deck)`, `findOpener(hands)`, `legalMoves(hand, ends, isFirstMove)`, `applyMove(state, move)`, `nextTurn(state)`, `isBlocked(state)`, `scoreRound(state, mode)`. Semua dengan unit test, termasuk kasus buntu, seri, dan kartu cocok di dua ujung.
