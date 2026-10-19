# Deploy LocalConvert miễn phí (frontend Cloudflare Pages + backend Render)

## Kiến trúc và giới hạn
- Cloudflare Pages host frontend Vite (build command `npm run build`, output `dist`).
- Render Web Service chạy Express + FFmpeg. Gói free có thể sleep khi không có traffic và filesystem tạm; file đầu ra phải được stream ngay, không lưu lâu dài.
- Backend hiện chỉ nhận URL HTTP(S) trực tiếp tới media mà bạn có quyền tải/chuyển đổi. URL trang YouTube `watch` không phải direct media URL và sẽ bị từ chối. Không coi deploy miễn phí là đảm bảo xử lý video dài/nặng.

## A. Đưa project lên GitHub
1. Giải nén ZIP, mở PowerShell trong thư mục `localconvert`.
2. Tạo repo GitHub rồi push toàn bộ project lên repo (không upload `node_modules`).

## B. Deploy backend trên Render
1. Render Dashboard → New → Web Service → kết nối repo.
2. Root Directory: `localconvert` nếu repo chứa thư mục cha; để trống nếu `package.json` ở root.
3. Build Command: `npm install`
4. Start Command: `npm run dev:api`
5. Health Check Path: `/api/health`
6. Environment variable `ALLOWED_ORIGINS`: tạm nhập `https://YOUR-PROJECT.pages.dev` sau khi tạo Pages. Không đặt `*` cho website công khai.
7. Deploy và kiểm tra `https://YOUR-SERVICE.onrender.com/api/health` trả về `{"ok":true}`.

## C. Deploy frontend trên Cloudflare Pages
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Build command: `npm run build`; output directory: `dist`; root directory phải là nơi có `package.json`.
3. Environment variable cho Production: `VITE_API_BASE_URL=https://YOUR-SERVICE.onrender.com` (không có dấu `/` ở cuối).
4. Deploy lại sau khi thêm biến môi trường. Mở website Pages và thử với một URL direct-media được phép tải.
5. Quay lại Render, cập nhật `ALLOWED_ORIGINS=https://YOUR-PROJECT.pages.dev` đúng origin thật, rồi redeploy backend.

## D. Test
- `GET /api/health` phải trả `{"ok":true}`.
- Frontend phải gửi request tới `https://YOUR-SERVICE.onrender.com/api/convert`.
- Link trang YouTube sẽ bị từ chối trong bản này; backend không trích xuất nội dung từ trang xem YouTube.

## Bảo mật / giới hạn
- Không để backend công khai mà không giới hạn sử dụng nếu bạn chưa có rate limiting / quota. Bản demo có kiểm tra URL cơ bản nhưng chưa phải dịch vụ production-hardening.
- Dùng nội dung bạn sở hữu hoặc được phép tải/chuyển đổi. Không gửi cookie hay thông tin đăng nhập.
- Render Free có thể sleep, thời gian phản hồi đầu tiên lâu; job nặng có thể timeout. Với media dài hoặc nhiều người dùng, cần worker/queue và storage riêng, thường không còn miễn phí hoàn toàn.
