# 05 — UI/UX & Animasi

## Arah visual
- Nuansa meja gaple Indonesia: kain felt hijau tua / kayu jati, kartu gaple putih gading dengan titik hitam, aksen merah untuk titik 1 (opsional).
- Tipografi tebal & ramah. Kontras tinggi agar terbaca di HP.
- Layar Main pemain: HP **landscape**, satu adegan 3D dari kursi pemain (POV). Layar lain mobile-first portrait. iPad landscape untuk meja.

## Layar & animasi
| Layar | Elemen | Animasi |
|---|---|---|
| Landing | Logo GAFLEX, 2 tombol besar | Logo: kartu gaple jatuh & tersusun (spring, 600 ms, sekali) |
| Buat Room | Pilihan mode & setup (segmented) | Highlight geser antar opsi (layout animation) |
| Kode room | Kode 6 digit besar + QR | Digit muncul stagger 40 ms; tombol salin → toast |
| Gabung | Input kode besar ala Kahoot | Salah kode: shake horizontal 300 ms; benar: scale-out ke pilih kursi |
| Pilih kursi | Denah meja dari atas, 4 kursi | Kursi tersedia berdenyut lembut; saat dipilih: avatar meluncur ke kursi; kursi lain realtime terkunci (fade + ikon gembok) |
| Lobby | Denah + status meja | Pemain baru masuk: pop-in; host "Mulai" aktif dengan transisi warna; host dapat mengeluarkan pemain terputus ("Keluarkan") atau membubarkan lobby ("Bubarkan lobby" dengan konfirmasi) |
| Mulai | Shuffle | 28 kartu berputar di tengah (Three.js) lalu dibagikan 7 ke tiap arah, 1.2 s total |
| Tangan pemain | 7 kartu 3D **berdiri berjajar** di tepi meja di depan kamera (POV, seperti duduk di meja) | Setelah deal, kartu yang tertelungkup berdiri satu-satu (stagger 80 ms) menghadap pemain; **semua kartu tampil sama** — tidak ada penanda kartu yang bisa dimainkan (diputuskan 2026-11-22) |
| Kartu lawan | Berdiri di tepi meja masing-masing, punggung menghadap kita | Barisan merapat (damping) saat kartu berkurang; host dapat mengetuk "Kick" saat lawan terputus agar pemain pengganti masuk |
| Pilih kartu | Tap kartu | Kartu naik; jika cocok di 2 ujung, muncul 2 target panah kiri/kanan + pad target 3D di meja sesuai sudut pandang kursi pemain |
| Main kartu | Ketuk kartu (suara "tak") atau **dorong ke depan** di atas meja (`slam: true`, kartu lebih kuat & cepat, suara `"cetas"` dari `cetas.mp3` tepat saat mendarat, plus hentakan ringan meja) | Kartu terangkat dari jajarannya (pemain) atau dari barisan lawan, meluncur ke tempatnya di rantai, berputar ke orientasi, mendarat dengan pantulan + suara `"tak"` atau `"cetas"` |
| Giliran | Indikator & HUD | Ring kuning emas berputar + badge `GILIRAN` kontras tinggi di kartu lawan maupun pill giliran kiri atas; panel skor (termasuk kode room) di **pojok kiri bawah** agar tidak bertumpuk dengan nama pemain lain; HP pemain bergetar (`navigator.vibrate(30)`) saat gilirannya; footer hak cipta `© 2026 Fahim` di bagian bawah layar |
| Pas | Badge "PAS" | Badge muncul di kursi pemain, scale in, hilang setelah 900 ms |
| Intip (4 device) | Tombol "Intip" + kontrol Zoom (`−`, `%`, `+`) | Kamera bertransisi dari POV kursi ke atas meja (900 ms, ease-in-out, bisa diinterupsi); kontrol zoom memperbesar/memperkecil tampilan meja dengan tween 260 ms; tombol Kembali membalik animasi |
| Akhir ronde | Panel hasil | Kartu sisa tiap pemain terbuka (flip), angka skor menghitung naik, confetti ringan untuk pemenang |
| Reconnect | Banner | Slide-down "Menyambung ulang…" |

## Aturan animasi
- Durasi UI 150–300 ms; animasi panggung (shuffle, View, kartu ke meja) 600–1200 ms.
- Semua animasi dapat diinterupsi (state baru membatalkan animasi lama, tidak menumpuk).
- `prefers-reduced-motion`: ganti terbang/berputar dengan fade/cross-fade singkat; kamera View langsung pindah dengan fade.
- DOM: hanya `transform` & `opacity`. Three.js: interpolasi transform dengan `useFrame` + damping, bukan re-render React per frame.
- Target 60 fps di HP menengah; batasi `dpr` ke `[1, 2]`.

## Aksesibilitas
- Tombol ≥ 44 px. Semua aksi kartu juga bisa via tombol (bukan hanya gesture).
- Label teks untuk status giliran/pas (bukan warna saja).
