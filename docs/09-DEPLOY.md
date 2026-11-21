# 09 — Deploy

Dua bagian yang di-deploy terpisah (docs/03):

| Bagian | Isi | Host yang cocok | Catatan |
|---|---|---|---|
| Server | `apps/server` → satu file `dist/index.js` (semua dependensi di-bundle) | Render, Railway, Fly.io (perlu WebSocket, proses yang tetap hidup) | State room di memori: **jalankan 1 instance saja**. Restart = semua room hilang. |
| Client | `apps/client` → file statis `apps/client/dist` | Vercel, Netlify | SPA: semua path diarahkan ke `index.html` |

## Auto-deploy setiap push ke `main` (Railway + Vercel)

Repo: `https://github.com/Fahim-Femure/gaflex`, branch `main`. Kedua host terhubung langsung ke GitHub (tanpa GitHub Actions):

| | Server (Railway) | Client (Vercel) |
|---|---|---|
| Sumber | service `gaflex-server` ← repo, branch `main` (`railway service source connect`) | project `gaflex` ← repo (`vercel git connect`) |
| Build | `Dockerfile` di root | `vercel.json` (pnpm, `apps/client/dist`) |
| Env | `CORS_ORIGIN=https://gaflex.vercel.app` (di service) | `VITE_SERVER_URL=https://gaflex-server-production.up.railway.app` disimpan di project (Production + Preview), dibaca saat build |
| Lewati build | — (setiap push men-deploy server; room aktif hilang) | `ignoreCommand` di `vercel.json`: push yang tidak menyentuh client/shared/lockfile tidak di-build |

Catatan:
- Setiap deploy server me-restart proses → **semua room aktif hilang**. Hindari push saat ada yang bermain.
- Branch lain/PR di Vercel menjadi *Preview*, tidak mengganti produksi.
- `railway.json` sengaja tidak dipakai: config-as-code Railway deprecated (berlaku sampai 2026-12-01).

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
