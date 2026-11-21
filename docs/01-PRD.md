# 01 — Product Requirements (PRD)

## Tujuan
Memainkan gaple bersama teman secara online/semi-offline (satu ruangan) dengan pengalaman semirip mungkin dengan duduk di meja nyata.

## Peran device
| Peran | Jumlah | Fungsi |
|---|---|---|
| Host | 1 (salah satu pemain) | Membuat room, memilih mode (Solo/Tim) & jumlah device (4/5), memulai game |
| Player | 4 | Melihat & memainkan 7 kartu miliknya |
| Table Display | 0 atau 1 | Hanya menampilkan meja (read-only), tidak memegang kartu |

## Alur utama
1. **Landing**: tombol "Buat Room" dan "Gabung Room".
2. **Buat Room**: host isi nama → pilih mode (Solo/Tim) → pilih setup (4 device / 5 device) → dapat kode 6 digit + QR code.
3. **Gabung Room**: input kode (seperti Kahoot, input besar, auto-uppercase) → isi nama → **pilih kursi** pada denah meja (Utara, Timur, Selatan, Barat). Kursi terisi tampil terkunci beserta nama.
4. **Gabung sebagai Meja** (hanya jika setup 5 device): pilihan "Jadikan device ini Meja" di layar gabung.
5. **Lobby**: semua lihat denah kursi realtime. Mode Tim: Utara+Selatan = Tim A, Timur+Barat = Tim B. Host menekan "Mulai" saat 4 kursi terisi (dan meja terhubung bila setup 5). Tombol "Keluar room" (atau meninggalkan lobby lewat logo/Back) langsung membebaskan slot & kursi.
6. **Bermain**: server mengacak 28 kartu → tiap pemain dapat 7. Giliran berputar searah jarum jam (Utara → Timur → Selatan → Barat).
7. **Akhir ronde**: tampil hasil, skor, tombol "Ronde berikutnya".

## Layar bermain (diputuskan 2026-11-20)
- Dimainkan dengan HP **landscape**. Layar portrait menampilkan ajakan memutar HP + tombol layar penuh.
- Sudut pandang 3D dari kursi pemain sendiri (POV): kartu sendiri **berdiri** berjajar di tepi meja menghadap pemain, rantai terbentang di meja, kartu lawan berdiri di tepi meja masing-masing (terlihat punggungnya + jumlahnya saja).

## Fitur per setup
- **4 device**: tombol **Intip** (dulu "View") di layar pemain → kamera naik ke atas meja untuk melihat semua kartu di meja dan sisa kartu lawan (punggung), lalu tombol Kembali.
- **5 device**: tombol Intip disembunyikan. Table Display menampilkan meja live (kartu dipasang, giliran, kartu tersisa tiap pemain, status pas).

## Non-fungsional
- Latensi aksi < 300 ms di jaringan yang sama.
- Reconnect: pemain yang refresh/terputus kembali ke kursi & tangannya (room bertahan 2 menit). Token sesi disimpan per tab di `sessionStorage` (tahan refresh, tidak bocor ke tab lain sehingga 5 tab di satu browser bisa diuji), plus salinan di `localStorage` yang dipakai lewat tombol "Kembali ke room" di Landing bila tab tertutup.
- Room kedaluwarsa setelah 30 menit tidak aktif.
- Tidak perlu akun/login.

## Di luar cakupan v1
Chat suara, taruhan/uang, matchmaking publik, akun, leaderboard global.
