import "./style.css";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const app = document.querySelector("#app");
app.innerHTML = `
  <main class="converter-card">
    <header class="brand-row">
      <div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg></div>
      <div class="brand-copy"><h1>LocalConvert</h1><p>YOUTUBE MEDIA TOOLKIT</p></div>
      <span class="personal-badge">Personal</span>
    </header>

    <form id="converter-form" novalidate>
      <label class="section-label" for="youtube-url">01 / VIDEO SOURCE</label>
      <div class="url-field">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10.5a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.2l1.7-1.7"/></svg>
        <input id="youtube-url" name="url" type="url" placeholder="Dán link media trực tiếp được phép tải..." autocomplete="url" spellcheck="false" required />
        <button class="paste-button" type="button" id="paste-button" title="Dán từ clipboard">Dán</button>
      </div>

      <div class="section-label format-label">02 / OUTPUT FORMAT</div>
      <div class="format-options" role="group" aria-label="Chọn định dạng đầu ra">
        <button class="format-option selected" type="button" data-format="mp3" aria-pressed="true">
          <svg class="format-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z"/></svg>
          <span class="format-copy"><strong>MP3 Audio</strong><small>Chỉ âm thanh</small></span>
        </button>
        <button class="format-option" type="button" data-format="mp4" aria-pressed="false">
          <svg class="format-icon video-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>
          <span class="format-copy"><strong>MP4 Video</strong><small>Video + âm thanh</small></span>
        </button>
      </div>

      <button class="get-button" type="submit"><span aria-hidden="true">↓</span> Get media</button>
      <p class="status-message" id="status-message" role="status" aria-live="polite"></p>
    </form>
    <footer>Dark theme · Desktop-style · Responsive</footer>
  </main>
`;

const form = document.querySelector("#converter-form");
const urlInput = document.querySelector("#youtube-url");
const status = document.querySelector("#status-message");
const getButton = document.querySelector(".get-button");
let outputFormat = "mp3";

function showStatus(message, type = "info") {
  status.textContent = message;
  status.className = `status-message ${type}`;
}

document.querySelectorAll(".format-option").forEach((button) => {
  button.addEventListener("click", () => {
    outputFormat = button.dataset.format;
    document.querySelectorAll(".format-option").forEach((option) => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
    showStatus("");
  });
});

document.querySelector("#paste-button").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      urlInput.focus();
      showStatus("Đã dán link. Nhấn Get media để tiếp tục.", "success");
    }
  } catch {
    showStatus("Trình duyệt không cho phép đọc clipboard. Hãy nhấn Ctrl + V vào ô link.", "error");
  }
});

urlInput.addEventListener("input", () => showStatus(""));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("");
  let parsed;
  try {
    parsed = new URL(urlInput.value.trim());
  } catch {
    showStatus("Hãy nhập một URL hợp lệ.", "error");
    urlInput.focus();
    return;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    showStatus("Chỉ hỗ trợ URL bắt đầu bằng http:// hoặc https://.", "error");
    return;
  }
  getButton.disabled = true;
  getButton.innerHTML = '<span aria-hidden="true">⏳</span> Đang xử lý...';
  showStatus("Đang tải nguồn và chuyển đổi. Với file lớn, quá trình có thể mất vài phút.", "info");
  try {
    const response = await fetch(`${API_BASE_URL}/api/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: parsed.href, format: outputFormat })
    });
    if (!response.ok) {
      let message = "Không thể chuyển đổi nguồn này.";
      try { message = (await response.json()).error || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/i);
    const filename = match?.[1] || `localconvert.${outputFormat}`;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    showStatus("Hoàn tất! File đã được gửi về trình duyệt.", "success");
  } catch (error) {
    showStatus(error.message || "Có lỗi khi kết nối backend. Hãy kiểm tra terminal.", "error");
  } finally {
    getButton.disabled = false;
    getButton.innerHTML = '<span aria-hidden="true">↓</span> Get media';
  }
});
