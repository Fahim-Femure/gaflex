# HANDOFF — GAFLEX

Dokumen serah-terima untuk melanjutkan proyek di akun Claude Code lain.
Dibuat 2026-11-22. Baca ini dulu, lalu `CLAUDE.md`, lalu `docs/01`–`docs/09`.

---

## 1. Status singkat

GAFLEX (gaple double-six online, 4 pemain, multi-device) **sudah berjalan end-to-end dan sudah online**.

| Fase (docs/07) | Status | Bukti terakhir |
|---|---|---|
| 0. Setup | Selesai | `pnpm dev` jalan client+server |
| 1. Aturan game | Selesai | Fungsi murni + TDD di `packages/shared/src/rules` |
| 2. Room & lobby | Selesai | 5 tab browser masuk room & duduk realtime |
| 3. Game loop server | Selesai | Satu ronde penuh lewat UI |
| 4. Three.js | Selesai | Diganti di tahap berikutnya menjadi POV 3D (lihat §4) |
| 5. Animasi | Selesai di desktop | ~60 fps terukur di browser desktop; **belum di HP/iPad nyata** |
| 6. Mode setup | Selesai | Ronde penuh mode 4 device (Intip) dan 5 device (Table Display) |
| 7. Polish & deploy | **Hampir selesai** | Online; tinggal uji 5 device nyata di URL publik (§6) |

Verifikasi terakhir (2026-11-22, setelah revisi pemilik "tanpa petunjuk / acak ulang 5 balak / titik kalah 101 / keluar lobby"): `pnpm test` → shared 89, server 69, client 134 = **292 lulus** (setelah perbaikan kamera Timur/Barat/iPad); `pnpm build` dan `pnpm lint` bersih. Diuji di browser desktop (viewport 844×390) dengan bot socket: "Keluar room" langsung membebaskan slot (pemain baru masuk setelah sebelumnya `ROOM_FULL`); kartu tampil seragam tanpa penanda; ketuk kartu salah saat buka ronde 1 → pesan 6-6; panel hasil menambah sisa titik ke yang kalah. Sebelumnya "Lewati" juga diuji di browser (tombol setelah 15 detik).

---

## 2. Produksi

| Bagian | URL | Host |
|---|---|---|
| Client | https://gaflex.vercel.app | Vercel, proyek `gaflex` (tim `fahim-femures-projects`) |
| Server | https://gaflex-server-production.up.railway.app | Railway, proyek `gaflex`, service `gaflex-server`, environment `production` |

- Health check: `GET /health` → `{"ok":true}`.
- Server env: `CORS_ORIGIN=https://gaflex.vercel.app` (origin lain ditolak — sudah diuji).
- Client dibuild dengan `VITE_SERVER_URL=https://gaflex-server-production.up.railway.app`.
- Room disimpan **di memori**: server harus **1 instance**; setiap restart/redeploy menghapus semua room aktif.
- Railway berbayar setelah kredit trial habis.

### Deploy ulang
Otomatis: cukup `git push origin main` (Railway & Vercel terhubung ke GitHub, docs/09).
Manual (darurat, dari root repo, setelah login CLI):
```
railway up --service gaflex-server --detach        # server (build Dockerfile di cloud)
vercel deploy --prod --yes --build-env VITE_SERVER_URL=https://gaflex-server-production.up.railway.app
```
- Login: `railway login`, `vercel login` (harus dilakukan pemilik akun sendiri).
- Akun baru Claude Code tidak mewarisi login CLI; folder `.vercel/` (link proyek) ada di root dan diabaikan git.
- Detail lengkap: `docs/09-DEPLOY.md`.

---

## 3. Menjalankan lokal

```
pnpm install
pnpm dev        # client http://localhost:5173, server http://localhost:3001
pnpm test
pnpm build
pnpm lint
```

Jebakan lingkungan yang sudah ditemui:
- **pnpm 12** dipasang lewat corepack ke `%APPDATA%\npm` (tanpa admin). pnpm 12 memblokir install script; esbuild diizinkan di `pnpm-workspace.yaml` (`allowBuilds: esbuild: true`).
- Menghentikan `pnpm dev` dari tool background sering **meninggalkan proses node** di port 3001/5173. Cek & matikan:
  `Get-NetTCPConnection -LocalPort 3001,5173 -State Listen` lalu `Stop-Process` untuk proses `node`.
- Windows tidak membedakan huruf besar/kecil nama file: `CameraRig.tsx` vs `cameraRig.ts` bentrok → komponen kamera dinamai `PlayerCamera.tsx`.
- Bash di lingkungan ini memotong backslash dalam heredoc (ada hook yang menolak) — tulis file pakai tool Write/Edit.
- Untuk uji di HP dalam satu LAN: buka client lewat IP komputer (`http://<IP>:5173`); bila `CORS_ORIGIN` kosong, server dev menerima semua origin.
- Menguji banyak pemain di satu browser: sesi disimpan **per tab** (`sessionStorage`), jadi 5 tab = 5 pemain.

---

## 4. Keputusan penting (sudah tercatat di docs)

Aturan game (docs/02, keputusan pemilik 2026-11-20):
- Seri saat buntu **inklusif**: dihitung mulai dari pemain terakhir yang menaruh kartu.
- Buntu mode Tim: anggota tim pemenang dengan titik terkecil jalan pertama ronde berikutnya.

Revisi pemilik 2026-11-22 (docs/02):
- **Titik kalah**: yang kalah ronde menambah sisa titiknya (Tim: gabungan 2 pemain tim kalah; Solo: tiap dari 3 pemain kalah, sendiri-sendiri). Lewat 100 (mencapai 101) = kalah game. Batas tetap 100 (pilihan target dihapus). Papan game `tally`: Tim = menang per tim (mis. 1-0); Solo = kalah per pemain. "Main lagi" mempertahankan papan.
- **Acak ulang** bila satu tangan memegang ≥ 5 balak.
- **Tanpa petunjuk kartu**: tidak ada kartu menyala/redup; ketuk kartu salah → pesan singkat ("tidak cocok", "harus 6-6", "belum giliranmu") 3 detik.
- **Keluar lobby**: event `room:leave`; tombol "Keluar room", logo, atau Back dari lobby langsung membebaskan slot. Tab yang ditutup di lobby tidak menahan room penuh (pemain baru menggeser yang paling lama terputus).

Desain layar (permintaan pemilik):
- **Layar Main dimainkan landscape** dengan **POV 3D dari kursi pemain**: kartu sendiri **berdiri** di tepi meja menghadap kamera, kartu lawan berdiri di tepi masing-masing (punggung + jumlah saja), rantai di tengah meja. Portrait → ajakan memutar HP + tombol layar penuh.
- Tombol **Intip** (dulu "View") menaikkan kamera ke atas meja (900 ms, bisa diinterupsi). **Hanya di mode 4 device** (docs/01); di mode 5 device meja tampil di iPad.
- Giliran searah jarum jam → pemain berikutnya ada di **kiri** kita (diverifikasi geometri).

Keputusan teknis yang menyimpang dari spec awal (sudah ditulis di docs):
- Token sesi per tab di `sessionStorage`; salinan di `localStorage` hanya dipakai lewat tombol "Kembali ke room" (docs/01).
- Event tambahan `room:peek` + kode error `TABLE_UNAVAILABLE`, `SESSION_INVALID`, `NOT_IN_ROOM`, `INVALID_PAYLOAD`, `NOT_HOST`, `NOT_READY`, `GAME_IN_PROGRESS`, `ROUND_IN_PROGRESS` (docs/04).
- Saat buntu, ronde langsung selesai (tidak menayangkan 4 PAS berturut-turut).
- "Main lagi" setelah game selesai: skor nol, ronde 1, dibuka 6-6.
- Socket yang membuat/bergabung lagi melepas member lamanya (cegah pemain hantu yang memakan jatah 4 pemain).
- Pemain yang putus di tengah game memegang kursinya; giliran menunggu dia sampai host menekan "Lewati" (tersedia setelah 15 detik terputus).
- Suara "tak" disintesis WebAudio (tanpa file aset), bunyi saat kartu mendarat; tombol "Suara" per device.
- Reduced motion: kartu di meja 3D muncul dengan sedikit membesar di tempat (bukan fade, karena material dibagi antar kartu).

---

## 5. Peta kode

```
packages/shared/src/
  rules/        deck, moves, round (skor/buntu/seri), game (ronde/skor game), view (view tersaring) — semua ber-test
  room/         kode room, nama (maks 16)
  types/, constants/ (EVENTS, SEAT_ORDER, OPENER_TILE, batas waktu)
apps/server/src/
  rooms/RoomManager.ts     room, kursi, meja, resume, sweep (2 menit grace, 30 menit idle), release
  game/GameService.ts      start/play/auto-pass/nextRound/views
  socket/handlers.ts       Socket.IO: event dulu baru view, auto-pass 900 ms, ganti sesi
  tests/                   test integrasi socket (lobby, game, 5 device)
apps/client/src/
  pages/                   Landing, Create, Join, Lobby, Play (POV landscape), Table (iPad)
  three/scenes/            PlayerScene (POV + Intip), TableScene (Table Display)
  three/layout/            layoutChain (ular, ber-test), seatRow, orientation
  three/animations/        curves (ber-test), cameraRig, TableTile (terbang), SeatTile, DealAnimation, PlayerCamera
  lib/                     socket, realtime, session, sound, settings, chain, initial, names
  store/useGameStore.ts    Zustand
Dockerfile, render.yaml, vercel.json, apps/client/public/_redirects
GLOSSARY.md                istilah domain (balak, pas, gaple, ujung, …)
```

---

## 6. Sisa pekerjaan (urut prioritas)

1. **Kriteria Fase 7**: mainkan satu ronde penuh di https://gaflex.vercel.app dengan **4 HP + 1 iPad** (setup 5 device), lalu satu ronde setup 4 device. Cek: POV landscape, ketuk/geser kartu, Intip, suara "tak", getar, reconnect (kunci layar sebentar), QR dari HP lain.
2. **60 fps di HP menengah** (syarat Fase 5) — baru terukur di desktop (median 16,7 ms).
3. **Git**: remote `origin` = https://github.com/Fahim-Femure/gaflex, branch `main` sudah di-push (2026-11-22). Pemilik memilih tetap di Railway + Vercel (Coolify dibatalkan, filenya dihapus). **Auto-deploy**: Vercel terhubung ke repo dan sudah terbukti men-deploy dari push (`e92a662`). Railway: source service sudah menunjuk repo (deploy `40ca12d` sukses), tetapi **trigger push belum ada** — API menolak "no one in the project has access to it": Railway GitHub App harus diberi akses ke repo `gaflex` oleh pemilik, lalu trigger dibuat (`deploymentTriggerCreate`, branch `main`). Sampai itu, server di-deploy manual (`railway up`).
4. ~~Pemain putus di tengah game~~ — **selesai 2026-11-22**: host bisa "Lewati" pemain yang giliran setelah terputus ≥ 15 detik (dihitung PAS; pembuka 6-6 yang dilewati → pemain berikutnya buka bebas). Event `game:skip`, docs/02 & 04. Belum diuji di HP nyata.
5. Batas nama 16 karakter memotong di tengah kata ("Bang Jago Kart"); pemilik bisa menaikkan `PLAYER_NAME_MAX`.
6. Belum dicek: RTL, zoom 200%, pesan "room penuh" di browser (sudah dites di server).
7. ~~Kursi Timur/Barat & iPad: kartu sendiri terpotong~~ — **selesai 2026-11-22**: kamera POV & Intip kini memakai ukuran meja setelah diputar per kursi (`viewFrame`), dan jarak POV dicari dengan proyeksi sampai barisan sendiri (termasuk kartu terangkat) dan barisan seberang masuk layar (`cameraRig.ts`, diuji 4 kursi × HP 2,4/2,16 & iPad 1,6/1,44/1,33). Dicek di browser: Barat di 844×390 dan 1180×820, Intip utuh. Belum di iPad nyata.
8. Kecil: panel skor di HUD Main patah ke 2 baris bila tombol "Lewati" tampil. Panel nama lawan di sisi atas sedikit menutup tepi barisan lawan saat Intip; layar lain (landing/lobby) masih ukuran portrait.

---

## 7. Cara kerja yang dipakai (pertahankan)

- TDD untuk semua logika murni (lihat test di tiap paket); test integrasi socket memakai `socket.io-client`.
- Sebelum klaim selesai: `pnpm test`, `pnpm build`, `pnpm lint` dan tunjukkan hasilnya (CLAUDE.md #7).
- Uji UI di browser bawaan dengan banyak tab; viewport HP landscape 844×390, iPad 1180×820.
- Skill per fase: `docs/08-SKILLS.md`.
