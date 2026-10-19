# LocalConvert — Personal Media Studio

A minimal dark-themed Vite frontend and Express/FFmpeg backend for converting direct media-file URLs you own or are allowed to download. Supports MP3 audio and MP4 video output.

## Local Windows development
Requirements: Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the Vite URL shown in terminal. The local Vite server proxies `/api` to `http://127.0.0.1:8787`.

## Free deployment guide
See [`DEPLOY_FREE_VI.md`](./DEPLOY_FREE_VI.md) for Cloudflare Pages frontend + Render backend setup.
