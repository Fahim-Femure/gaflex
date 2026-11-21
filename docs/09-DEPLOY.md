# 09 — Deploy

Dua bagian yang di-deploy terpisah (docs/03):

| Bagian | Isi | Host yang cocok | Catatan |
|---|---|---|---|
| Server | `apps/server` → satu file `dist/index.js` (semua dependensi di-bundle) | Render, Railway, Fly.io (perlu WebSocket, proses yang tetap hidup) | State room di memori: **jalankan 1 instance saja**. Restart = semua room hilang. |
| Client | `apps/client` → file statis `apps/client/dist` | Vercel, Netlify | SPA: semua path diarahkan ke `index.html` |

## Coolify (auto-deploy setiap push ke `main`)

Repo: `https://github.com/Fahim-Femure/gaflex`, branch `main`. Dua resource di satu project Coolify, keduanya build pack **Dockerfile** dari root repo:

| | Server | Client |
|---|---|---|
| Dockerfile location | `/Dockerfile` | `/Dockerfile.client` |
| Port (Ports Exposes) | `3001` | `80` |
| Domain | mis. `https://api.<domainmu>` | mis. `https://<domainmu>` |
| Env | `CORS_ORIGIN=https://<domain client>` | `VITE_SERVER_URL=https://<domain server>` — centang **Build Variable** (dibaca saat build; build gagal bila kosong) |
| Health check | path `/health` | path `/` |
| Watch paths (opsional) | `apps/server/**`, `packages/shared/**`, `Dockerfile`, `pnpm-lock.yaml` | `apps/client/**`, `packages/shared/**`, `Dockerfile.client`, `deploy/**`, `pnpm-lock.yaml` |

Langkah (dilakukan pemilik di dashboard Coolify):
1. **Sources → + Add → GitHub App**, buat app dan pasang di akun GitHub, beri akses ke repo `gaflex`. GitHub App ini yang mengirim webhook push ke Coolify.
2. **Projects → + Add → New Resource → Private Repository (with GitHub App)**, pilih repo `gaflex`, branch `main`, build pack Dockerfile. Isi kolom sesuai tabel. Ulangi untuk resource kedua.
3. Di tiap resource, **Advanced → Automatic Deployment** aktif (bawaan untuk GitHub App). Sejak itu setiap `git push` ke `main` mem-build dan men-deploy ulang.
4. Server **1 replika saja** (room disimpan di memori). Deploy ulang = room aktif hilang.
5. Deploy server dulu, lalu client (client butuh URL server saat build). Uji `GET https://<domain server>/health` → `{"ok":true}`.
6. Setelah Coolify jalan, matikan Railway/Vercel supaya tidak ada dua server dan biaya ganda.

## Variabel lingkungan

| Nama | Di mana | Isi |
|---|---|---|
| `PORT` | server | Disediakan host. Default 3001. |
| `CORS_ORIGIN` | server | **Wajib di produksi.** URL client, mis. `https://gaflex.vercel.app` (pisahkan dengan koma bila lebih dari satu). Bila kosong, server menerima semua origin (hanya untuk dev LAN). |
| `VITE_SERVER_URL` | client (saat build) | URL server, mis. `https://gaflex-server.onrender.com`. Bila kosong, client memakai host yang sama port 3001 (dev). |

## Server

Docker (dari root repo):
```
docker build -t gaflex-server .
docker run -p 3001:3001 -e CORS_ORIGIN=https://gaflex.vercel.app gaflex-server
```

Tanpa Docker (host Node biasa, mis. Railway/Render "Node"):
- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @gaflex/server build`
- Start: `node apps/server/dist/index.js`
- Health check: `GET /health` → `{"ok":true}`

Render: `render.yaml` di root adalah blueprint siap pakai (isi `CORS_ORIGIN` di dashboard).

Catatan host gratis: banyak yang menidurkan server setelah tidak aktif; bangun lagi butuh ~30–60 s dan room yang ada hilang.

## Client

Vercel: `vercel.json` di root sudah berisi install/build/output dan rewrite SPA.
Set `VITE_SERVER_URL` di Environment Variables proyek, lalu deploy dari root repo.
Bila pnpm versi proyek tidak terdeteksi, set `ENABLE_EXPERIMENTAL_COREPACK=1`.

Netlify: base `/`, build `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @gaflex/client build`, publish `apps/client/dist`. `apps/client/public/_redirects` menangani SPA.

## Uji setelah deploy (kriteria Fase 7)
1. Buka URL client di 5 device (4 HP + 1 iPad), buat room setup 5 device.
2. Pindai QR dari HP lain — QR memakai alamat client yang sedang dibuka.
3. Mainkan satu ronde penuh; cek suara "tak", getar saat giliran, dan reconnect (kunci layar HP sebentar lalu buka lagi).
