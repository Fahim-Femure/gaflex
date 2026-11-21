# 02 — Aturan Gaple (Domino Double-Six)

## Set kartu
- 28 kartu: semua pasangan (a,b) dengan 0 ≤ a ≤ b ≤ 6.
- Balak (double): 0-0, 1-1, …, 6-6.
- 4 pemain × 7 kartu = 28 → semua kartu terbagi, tidak ada sisa (boneyard kosong).

## Pengacakan
- Fisher–Yates shuffle di server memakai `crypto.randomInt`.
- **Acak ulang** (diputuskan 2026-11-22): bila satu pemain mendapat **≥ 5 balak** (`REDEAL_MIN_DOUBLES`), kartu dikocok & dibagi ulang sebelum siapa pun melihat tangannya (`needsRedeal`, `dealUntilFair`).
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
- **Tanpa petunjuk** (diputuskan 2026-11-22): UI tidak menandai kartu mana yang bisa dimainkan; pemain berpikir sendiri. Kartu yang tidak cocok ditolak dengan pesan "Kartu itu tidak cocok dengan ujung meja." PAS otomatis tetap berlaku.
- Balak dipasang melintang (tegak lurus rantai) — hanya visual, nilai ujung tetap sama.
- Tidak punya kartu yang cocok → otomatis **PAS** (server yang menentukan; client menampilkan animasi "Pas").
- **Pemain terputus** (diputuskan 2026-11-22): giliran menunggu dia. Bila pemain yang sedang giliran sudah terputus ≥ 15 detik (`SKIP_AFTER_MS`), **host** boleh menekan "Lewati" → dihitung sebagai PAS. Jika yang dilewati adalah pembuka ronde 1 (pemegang 6-6) dan meja masih kosong, aturan wajib 6-6 gugur: pemain berikutnya boleh membuka dengan kartu apa pun (`GameState.openerWaived`).

## Akhir ronde
1. **Habis kartu**: pemain pertama yang menghabiskan 7 kartu menang.
2. **Gaple / buntu**: semua 4 pemain berturut-turut pas → ronde berhenti. Pemenang = total titik (pip) terkecil di tangan. Mode Tim: jumlah titik tim terkecil. Seri → pemain yang lebih dahulu dalam urutan giliran dari pemain terakhir yang menaruh kartu.

### Klarifikasi (diputuskan 2026-11-20)
- **Seri bersifat inklusif**: hitung urutan giliran mulai dari pemain terakhir yang menaruh kartu itu sendiri. Jika dia ikut seri, dia menang. Mode Tim seri total → tim dari pemain pertama dalam urutan itu.
- **Pembuka ronde berikutnya**: habis kartu → pemain yang habis. Buntu Solo → pemenang. Buntu Tim → anggota tim pemenang dengan titik tangan terkecil; sama → aturan seri di atas.

## Skor (diputuskan 2026-11-22: titik kalah)
- Yang **kalah** ronde mengumpulkan sisa titik kartunya; pemenang tidak mendapat apa-apa (`RoundResult.penalties`).
  - Mode Tim: tim yang kalah menambah jumlah titik **2 pemainnya**.
  - Mode Solo: ketiga pemain yang kalah masing-masing menambah sisa titiknya sendiri.
- Titik dijumlahkan antar ronde. Yang melewati `SCORE_LIMIT` = 100 (mencapai **101**) **kalah satu game**; bila beberapa lewat sekaligus, yang tertinggi kalah (`gameLoser`). Batas tetap, tidak dipilih host.
- Papan game (`tally`, mis. **1-0**): Mode Tim = jumlah game yang dimenangkan tiap tim (tim lawan dari yang kalah +1). Mode Solo = jumlah game yang dikalahkan tiap pemain (yang lewat 101 +1).
- "Main lagi": titik kembali 0, ronde 1 dibuka 6-6, papan game dilanjutkan.

## Validasi (semua di server)
- Bukan giliran → tolak `NOT_YOUR_TURN`.
- Kartu bukan milik pemain → tolak `TILE_NOT_OWNED`.
- Tidak cocok dengan ujung yang dipilih → tolak `INVALID_MOVE`.
- Pembuka ronde 1 bukan 6-6 → tolak `MUST_OPEN_WITH_DOUBLE_SIX`.

## Fungsi murni wajib (packages/shared/src/rules)
`createDeck()`, `shuffle(deck, rng)`, `deal(deck)`, `findOpener(hands)`, `legalMoves(hand, ends, isFirstMove)`, `applyMove(state, move)`, `nextTurn(state)`, `isBlocked(state)`, `scoreRound(state, mode)`. Semua dengan unit test, termasuk kasus buntu, seri, dan kartu cocok di dua ujung.
