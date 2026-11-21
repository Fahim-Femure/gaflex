# GAFLEX

**GA**ple + **FLEX**ible — gaple (domino double-six) online, 4 pemain, multi-device, gaya join room seperti Kahoot.

## Konsep singkat
- 4 pemain, masing-masing pakai device sendiri (HP/laptop).
- Opsional device ke-5 = **Table Display** (biasanya iPad) yang menampilkan meja di tengah secara live.
- Mode: **Solo** (4 orang saling lawan) atau **Tim** (2 vs 2, duduk berseberangan).
- Host membuat room → dapat **kode 6 digit** → pemain lain masukkan kode → pilih kursi (Utara/Timur/Selatan/Barat) sesuai posisi duduk nyata.
- Tiap pemain melihat 7 kartu gaple miliknya (render Three.js), hasil acak dari 28 kartu.
- Mode 4 device: ada tombol **View** untuk mengintip meja (animasi kamera ke POV atas).
- Mode 5 device: tombol View **dihilangkan**, meja tampil langsung di device ke-5.

## Struktur folder
```
GAFLEX/
├─ CLAUDE.md                 # aturan kerja untuk AI agent
├─ README.md
├─ docs/                     # spesifikasi (baca berurutan)
│  ├─ 01-PRD.md
│  ├─ 02-GAME-RULES.md
│  ├─ 03-ARCHITECTURE.md
│  ├─ 04-REALTIME-PROTOCOL.md
│  ├─ 05-UI-UX-ANIMATION.md
│  ├─ 06-THREEJS-SCENE.md
│  ├─ 07-ROADMAP.md
│  └─ 08-SKILLS.md
├─ prompts/
│  └─ PROMPT-CLAUDE.md       # prompt siap tempel ke akun Claude lain
├─ apps/
│  ├─ client/                # React + Vite + TS + React Three Fiber
│  │  └─ src/{app,pages,components/{ui,lobby,hand,table},three/{scenes,models,animations},hooks,store,lib,styles,assets}
│  └─ server/                # Node + Socket.IO (server-authoritative)
│     └─ src/{rooms,game,socket,tests}
└─ packages/
   └─ shared/                # tipe, aturan game, konstanta (dipakai client & server)
      └─ src/{types,rules,constants}
```

## Stack
React 18 + Vite + TypeScript · React Three Fiber + drei · Motion (`motion/react`) · Zustand · Tailwind CSS · Node.js + Socket.IO · Vitest · pnpm workspaces.
