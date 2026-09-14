document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("archiveRoot");
  if (!root) return;
  renderLoading(root);

  try {
    const years = await API.getYears();
    const summaries = await Promise.all(years.map(y => API.getSummary(y)));
    if (!summaries.some(Boolean)) return renderEmpty(root, "কোনো অর্থবছরের তথ্য পাওয়া যায়নি।");

    root.innerHTML = `<div class="year-grid">${
      summaries.filter(Boolean).map(s => `
        <div class="year-card">
          <h3>${s.year}</h3>
          <dl>
            <dt>মোট বাজেট</dt><dd>${formatTaka(s.budget)}</dd>
            <dt>মোট আয়</dt><dd>${formatTaka(s.income)}</dd>
            <dt>মোট ব্যয়</dt><dd>${formatTaka(s.expense)}</dd>
            <dt>বর্তমান স্থিতি</dt><dd>${formatTaka(s.balance)}</dd>
          </dl>
          <div class="links">
            <a href="accounts.html?year=${s.year}">হিসাব দেখুন</a>
            <a href="reports.html?year=${s.year}">প্রতিবেদন</a>
          </div>
        </div>
      `).join("")
    }</div>`;
  } catch (e) {
    renderError(root);
  }
});
