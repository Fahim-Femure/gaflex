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
- Ronde pertama: pemegang **0-0** jalan pertama dan wajib membuka dengan 0-0 (diputuskan 2026-11-26; sebelumnya 6-6). (Konstanta `OPENER_TILE`, dapat diubah di `packages/shared/src/constants`.)
- Ronde berikutnya (revisi 2026-11-26): pemenang ronde sebelumnya jalan pertama dan **wajib membuka dengan kartu balak** (`MUST_OPEN_WITH_DOUBLE`). Bila pemenang ronde sebelumnya tidak memegang balak sama sekali, giliran pembuka **bergeser searah jarum jam** ke pemain pertama yang memegang balak.

## Langkah
- Meja punya 2 ujung terbuka (kiri & kanan). Pemain menaruh 1 kartu yang salah satu sisinya cocok dengan salah satu ujung.
- Jika kartu cocok di kedua ujung, pemain memilih ujung (UI menampilkan 2 target; arah **Kiri/Kanan** menyesuaikan sudut pandang kursi masing-masing pemain).
- **Tanpa petunjuk** (diputuskan 2026-11-22): UI tidak menandai kartu mana yang bisa dimainkan; pemain berpikir sendiri. Kartu yang tidak cocok ditolak dengan pesan "Kartu itu tidak cocok dengan ujung meja." PAS otomatis tetap berlaku.
- Balak dipasang melintang (tegak lurus rantai) — hanya visual, nilai ujung tetap sama.
- Tidak punya kartu yang cocok → otomatis **PAS** (server yang menentukan; client menampilkan animasi "Pas").
- **Pemain terputus & kick** (diputuskan 2026-11-22, direvisi 2026-11-26): giliran menunggu dia. Bila pemain yang sedang giliran sudah terputus ≥ 15 detik (`SKIP_AFTER_MS`) atau kursinya telah dikosongkan (`member:kick`), **host** boleh menekan "Lewati" → dihitung sebagai PAS. Jika pembuka ronde pada meja kosong dilewati, aturan wajib kartu pembuka gugur agar pemain berikutnya boleh membuka bebas (`GameState.openerWaived`). Host juga dapat mengeluarkan pemain yang terputus di tengah permainan agar pemain pengganti bisa masuk memakai kode room dan melanjutkan sisa kartu kursi tersebut.

## Akhir ronde
1. **Habis kartu**: pemain pertama yang menghabiskan 7 kartu menang.
2. **Gaple / buntu**: semua 4 pemain berturut-turut pas → ronde berhenti. Pemenang = total titik terkecil di tangan (kartu **0-0** yang tersisa di tangan dihitung **25 titik**, `DEAD_DOUBLE_ZERO_POINTS`). Mode Tim: jumlah titik tim terkecil. Seri → pemain yang lebih dahulu dalam urutan giliran dari pemain terakhir yang menaruh kartu.

### Klarifikasi (diputuskan 2026-11-20)
- **Seri bersifat inklusif**: hitung urutan giliran mulai dari pemain terakhir yang menaruh kartu itu sendiri. Jika dia ikut seri, dia menang. Mode Tim seri total → tim dari pemain pertama dalam urutan itu.
- **Pembuka ronde berikutnya**: habis kartu → pemain yang habis. Buntu Solo → pemenang. Buntu Tim → anggota tim pemenang dengan titik tangan terkecil; sama → aturan seri di atas.

## Skor (diputuskan 2026-11-22 & direvisi 2026-11-26: titik kalah)
- Yang **kalah** ronde mengumpulkan sisa titik kartunya; pemenang tidak mendapat apa-apa (`RoundResult.penalties`).
  - **Balak 0-0 mati = 25** (`DEAD_DOUBLE_ZERO_POINTS`): sisa kartu `0-0` di tangan dihitung **25 titik** (berlaku baik saat menentukan pemenang buntu maupun menghitung penalti).
  - **Batas minimal 10** (`MIN_ROUND_PENALTY`): jika total sisa titik pihak yang kalah **di bawah 10** (0–9), penalti ronde itu **tidak dihitung (0)**.
  - Mode Tim: batas `< 10` dicek dari **jumlah gabungan 2 pemain** tim yang kalah.
  - Mode Solo: tiap pemain dari ketiga pemain yang kalah dicek sendiri-sendiri terhadap batas `< 10`.
- Titik dijumlahkan antar ronde. Yang melewati `SCORE_LIMIT` = 100 (mencapai **101**) **kalah satu game**; bila beberapa lewat sekaligus, yang tertinggi kalah (`gameLoser`). Batas tetap, tidak dipilih host.
- Papan game (`tally`, mis. **1-0**): Mode Tim = jumlah game yang dimenangkan tiap tim (tim lawan dari yang kalah +1). Mode Solo = jumlah game yang dikalahkan tiap pemain (yang lewat 101 +1).
- "Main lagi": titik kembali 0, ronde 1 dibuka 0-0, papan game dilanjutkan.

## Validasi (semua di server)
- Bukan giliran → tolak `NOT_YOUR_TURN`.
- Kartu bukan milik pemain → tolak `TILE_NOT_OWNED`.
- Tidak cocok dengan ujung yang dipilih → tolak `INVALID_MOVE`.
- Pembuka ronde 1 bukan 0-0 → tolak `MUST_OPEN_WITH_DOUBLE_ZERO`.
- Pembuka ronde 2+ bukan balak → tolak `MUST_OPEN_WITH_DOUBLE`.

## Fungsi murni wajib (packages/shared/src/rules)
`createDeck()`, `shuffle(deck, rng)`, `deal(deck)`, `findOpener(hands)`, `legalMoves(hand, ends, isFirstMove)`, `applyMove(state, move)`, `nextTurn(state)`, `isBlocked(state)`, `scoreRound(state, mode)`. Semua dengan unit test, termasuk kasus buntu, seri, dan kartu cocok di dua ujung.
