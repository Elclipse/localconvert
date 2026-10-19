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

## Scope and limitations
This backend only processes direct HTTP(S) media-file URLs. It does not extract media from YouTube watch pages or bypass access controls. Use content you own or are permitted to download/convert. Free hosting may sleep, time out, or run out of temporary storage for large media; it is suitable for personal testing, not guaranteed always-on service.
