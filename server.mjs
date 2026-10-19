import express from 'express';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

const app = express();

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://127.0.0.1:5173,http://localhost:5173,https://localconvert-4w5.pages.dev'
).split(',').map(x => x.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
const MAX_BYTES = 300 * 1024 * 1024;
const TIMEOUT_MS = 4 * 60 * 1000;

function isPrivateAddress(address) {
  if (address.includes(':')) {
    const a = address.toLowerCase();
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80:') || a.startsWith('::ffff:127.') || a.startsWith('::ffff:10.') || a.startsWith('::ffff:192.168.') || a.startsWith('::ffff:172.');
  }
  const n = address.split('.').map(Number);
  if (n.length !== 4 || n.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  return n[0] === 10 || n[0] === 127 || n[0] === 0 || n[0] >= 224 || (n[0] === 169 && n[1] === 254) || (n[0] === 172 && n[1] >= 16 && n[1] <= 31) || (n[0] === 192 && n[1] === 168);
}

async function validateUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('URL không hợp lệ.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Chỉ hỗ trợ URL HTTP/HTTPS.');
  if (url.username || url.password) throw new Error('Không hỗ trợ URL có thông tin đăng nhập.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('URL nội bộ không được phép.');
  const records = await lookup(host, { all: true }).catch(() => []);
  if (!records.length || records.some(r => isPrivateAddress(r.address))) throw new Error('Không phân giải được host công khai hoặc URL trỏ tới mạng nội bộ.');
  return url;
}

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length > 12000) stderr = stderr.slice(-12000); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(code === null ? 'Quá thời gian xử lý.' : `FFmpeg không xử lý được nguồn này. ${stderr.slice(-500)}`));
    });
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/convert', async (req, res) => {
  const { url: rawUrl, format } = req.body || {};
  if (typeof rawUrl !== 'string' || !['mp3', 'mp4'].includes(format)) return res.status(400).json({ error: 'Hãy cung cấp URL và chọn MP3 hoặc MP4.' });
  let dir;
  try {
    const url = await validateUrl(rawUrl);
    // Deliberately accept direct media-file URLs only, not video-platform watch pages.
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname)) {
      return res.status(400).json({ error: 'Backend này không trích xuất từ trang YouTube. Hãy dùng URL file media trực tiếp mà bạn sở hữu hoặc được phép tải.' });
    }
    dir = await mkdtemp(path.join(tmpdir(), 'localconvert-'));
    const input = path.join(dir, 'source.media');
    const output = path.join(dir, `converted.${format}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, { redirect: 'error', signal: controller.signal, headers: { 'User-Agent': 'LocalConvert/1.1' } });
    } finally { clearTimeout(timer); }
    if (!response.ok || !response.body) throw new Error(`Nguồn trả về HTTP ${response.status}. Hãy dùng link file media trực tiếp, không phải trang xem hoặc trang đăng nhập.`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) throw new Error('File nguồn vượt giới hạn 300 MB.');
    let total = 0;
    async function* limitedChunks() {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES) { await reader.cancel(); throw new Error('File nguồn vượt giới hạn 300 MB.'); }
          yield Buffer.from(value);
        }
      } finally { reader.releaseLock(); }
    }
    await pipeline(Readable.from(limitedChunks()), createWriteStream(input));
    const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
    if (format === 'mp3') args.push('-vn', '-codec:a', 'libmp3lame', '-q:a', '2', output);
    else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output);
    await runFfmpeg(args);
    const info = await stat(output);
    if (!info.size) throw new Error('File đầu ra rỗng.');
    res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Length', info.size);
    res.setHeader('Content-Disposition', `attachment; filename="localconvert-${randomUUID().slice(0, 8)}.${format}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(output, err => { if (err && !res.headersSent) res.status(500).end('Không gửi được file đầu ra.'); });
    res.on('finish', () => rm(dir, { recursive: true, force: true }).catch(() => {}));
  } catch (err) {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    if (!res.headersSent) res.status(400).json({ error: err.message || 'Lỗi xử lý media.' });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`LocalConvert API listening on port ${PORT}`));
