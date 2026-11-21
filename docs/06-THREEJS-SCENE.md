# 06 — Scene Three.js (React Three Fiber)

## Model kartu gaple
- Geometri: `RoundedBox` (drei) rasio 1 : 2 : 0.3 (mis. 1 × 2 × 0.3 unit), warna gading.
- Titik: instanced spheres kecil yang sedikit tertanam (atau tekstur canvas yang dibuat sekali per nilai 0–6 dan di-cache). Garis pemisah tengah.
- Satu komponen `<Tile a b />` dipakai di tangan & meja. Material dibagi (shared) antar kartu.

## Scene
| Scene | File | Kamera |
|---|---|---|
| `PlayerScene` | `three/scenes/PlayerScene.tsx` | Layar pemain (landscape). Satu meja: kartu sendiri berdiri di tepi meja menghadap kamera, kartu lawan berdiri (punggung), rantai di tengah. Preset kamera `pov` (setinggi mata di belakang jajaran kartu sendiri) dan `peek` (Intip, tinggi di atas meja) |
| `TableScene` | `three/scenes/TableScene.tsx` | Table Display: top-down sedikit miring (orthographic-like) |

Area meja: felt `TABLE_BOUNDS` (±10 × ±8). Rantai hanya boleh di `CHAIN_BOUNDS` (±8,2 × ±6,2); jalur di tepi untuk kartu yang berdiri (`seatRow`).

## Layout rantai di meja
- Rantai dimulai di tengah; tumbuh ke kiri & kanan.
- Saat mendekati tepi meja, rantai berbelok 90° (pola ular) agar tetap dalam bidang meja.
- Balak diputar 90° (melintang).
- Posisi dihitung oleh fungsi murni `layoutChain(chain, tableBounds)` → array `{ position, rotation }` (punya unit test).

## Animasi (three/animations)
- `useTileFlight(from, to, duration)` — kurva Bézier dari arah kursi ke posisi target + rotasi slerp + bounce kecil saat mendarat.
- Camera rig (`three/animations/PlayerCamera.tsx` + `cameraRig.ts`) — tween posisi & target kamera 900 ms ease-in-out antara `pov` dan `peek` untuk tombol Intip; bisa diinterupsi.
- `useDealAnimation()` — shuffle & deal saat mulai ronde.
- Orientasi meja relatif: di layar pemain, kursi pemain selalu di bawah (rotasi meja sesuai seat). Di Table Display, Selatan di bawah.

## Performa
- `<Canvas dpr={[1, 2]} frameloop="demand">` di layar pemain; invalidate saat animasi berjalan.
- Maks 28 kartu → tanpa LOD. Bayangan: satu directional light, `ContactShadows` drei.
- Dispose geometri/material saat unmount.
