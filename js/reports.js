document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("reportsRoot");
  const yearSelect = document.getElementById("reportYearFilter");
  if (!root || !yearSelect) return;

  try {
    const years = await API.getYears();
    yearSelect.innerHTML = `<option value="">সব অর্থবছর</option>` +
      years.map(y => `<option value="${y}">${y}</option>`).join("");
    const requestedYear = new URLSearchParams(location.search).get("year");
    if (requestedYear && years.includes(requestedYear)) yearSelect.value = requestedYear;

    await loadReports(years, yearSelect.value);
    yearSelect.addEventListener("change", () => loadReports(years, yearSelect.value));
  } catch (e) {
    renderError(root);
  }
});

async function loadReports(years, filterYear) {
  const root = document.getElementById("reportsRoot");
  renderLoading(root);

  const targetYears = filterYear ? [filterYear] : years;
  const byYear = await Promise.all(targetYears.map(async y => ({ year: y, reports: await API.getReports(y) })));
  const flat = byYear.flatMap(({ year, reports }) => reports.map(r => ({ ...r, year })));

  if (!flat.length) return renderEmpty(root, "এই মুহূর্তে কোনো প্রতিবেদন পাওয়া যায়নি।");

  root.innerHTML = `<div class="report-list">${flat.map(r => `
    <div class="report-row">
      <div>
        <div class="rtitle">${r.title}</div>
        <div class="ryear">${r.reportType} · ${r.year}</div>
      </div>
      <div class="rlinks">
        ${r.pdfUrl ? `<a href="${r.pdfUrl}" target="_blank" rel="noopener">📄 PDF ডাউনলোড</a>` : ""}
        ${r.excelUrl ? `<a href="${r.excelUrl}" target="_blank" rel="noopener">📊 Excel ডাউনলোড</a>` : ""}
        ${!r.pdfUrl && !r.excelUrl ? `<span class="ryear">শীঘ্রই আসছে</span>` : ""}
      </div>
    </div>
  `).join("")}</div>`;
}
