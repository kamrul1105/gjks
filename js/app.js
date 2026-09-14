/* ==========================================================================
   APP.js — shared across every page
   ========================================================================== */

// ---- Mobile nav toggle -----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Highlight the current page in the nav
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a").forEach(a => {
    const target = a.getAttribute("href").split("/").pop();
    if (target === here) a.classList.add("active");
  });
});

// ---- Currency formatting: Bangladeshi digit grouping, e.g. ৳ 1,25,000 -----
function formatTaka(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString();
  let formatted;
  if (abs.length <= 3) {
    formatted = abs;
  } else {
    const last3 = abs.slice(-3);
    const rest = abs.slice(0, -3);
    const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    formatted = grouped + "," + last3;
  }
  return "৳ " + sign + formatted;
}

// ---- Generic state-rendering helpers --------------------------------------
function renderLoading(container, message) {
  container.innerHTML = `<div class="loading-state"><span class="spinner"></span>${message || "তথ্য লোড হচ্ছে..."}</div>`;
}
function renderError(container, message) {
  container.innerHTML = `<div class="error-state">${message || "তথ্য এই মুহূর্তে লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।"}</div>`;
}
function renderEmpty(container, message) {
  container.innerHTML = `<div class="empty-state">${message || "কোনো তথ্য পাওয়া যায়নি।"}</div>`;
}

// ---- Voucher modal ----------------------------------------------------------
function ensureVoucherModal() {
  if (document.getElementById("voucherModal")) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "voucherModal";
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="voucherModalTitle">
      <button class="modal-close" aria-label="বন্ধ করুন">&times;</button>
      <h3 id="voucherModalTitle">🧾 ভাউচার</h3>
      <div class="modal-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeVoucherModal(); });
  overlay.querySelector(".modal-close").addEventListener("click", closeVoucherModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeVoucherModal(); });
}
function closeVoucherModal() {
  const overlay = document.getElementById("voucherModal");
  if (overlay) overlay.classList.remove("open");
}
function openVoucher(url) {
  if (!url) return;
  ensureVoucherModal();
  const overlay = document.getElementById("voucherModal");
  const body = overlay.querySelector(".modal-body");
  const lower = url.toLowerCase();
  let inner;
  if (lower.endsWith(".pdf") || lower.includes("/pdf")) {
    inner = `<iframe src="${url}" title="ভাউচার প্রিভিউ"></iframe>
             <a class="btn modal-open-link" href="${url}" target="_blank" rel="noopener">ভাউচার খুলুন</a>`;
  } else if (lower.match(/\.(jpg|jpeg|png|gif)(\?|$)/) || lower.includes("=view") || lower.includes("uc?")) {
    inner = `<img src="${url}" alt="ভাউচার ছবি">
             <a class="btn modal-open-link" href="${url}" target="_blank" rel="noopener">ভাউচার খুলুন</a>`;
  } else {
    inner = `<p>এই ভাউচারের প্রিভিউ এখানে দেখানো সম্ভব নয়।</p>
             <a class="btn modal-open-link" href="${url}" target="_blank" rel="noopener">ভাউচার খুলুন</a>`;
  }
  body.innerHTML = inner;
  overlay.classList.add("open");
}
