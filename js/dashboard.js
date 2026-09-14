let budgetChart, monthlyChart, categoryChart;

document.addEventListener("DOMContentLoaded", async () => {
  const yearSelect = document.getElementById("yearSelect");
  if (!yearSelect) return;

  try {
    const years = await API.getYears();
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    const requestedYear = new URLSearchParams(location.search).get("year");
    yearSelect.value = years.includes(requestedYear) ? requestedYear
      : (years.includes(CONFIG.DEFAULT_YEAR) ? CONFIG.DEFAULT_YEAR : years[0]);
    yearSelect.addEventListener("change", () => loadDashboard(yearSelect.value));
    await loadDashboard(yearSelect.value);
  } catch (e) {
    renderError(document.getElementById("dashboardRoot"));
  }
});

async function loadDashboard(year) {
  const root = document.getElementById("dashboardRoot");
  renderLoading(root, "হিসাবের তথ্য লোড হচ্ছে...");

  let summary;
  try {
    summary = await API.getSummary(year);
  } catch (e) {
    return renderError(root, "হিসাবের তথ্য এই মুহূর্তে লোড করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
  }
  if (!summary) return renderEmpty(root, "এই অর্থবছরের কোনো তথ্য পাওয়া যায়নি।");

  root.innerHTML = dashboardTemplate();
  fillStats(summary);
  drawBudgetChart(summary);
  drawMonthlyChart(summary);
  drawCategoryChart(summary);
}

function dashboardTemplate() {
  return `
    <div class="stat-ledger">
      <div class="stat-row">
        <div class="stat"><label>মোট বাজেট</label><span class="amount" id="statBudget">—</span></div>
        <div class="stat"><label>মোট আয়</label><span class="amount income" id="statIncome">—</span></div>
        <div class="stat"><label>মোট ব্যয়</label><span class="amount expense" id="statExpense">—</span></div>
        <div class="stat"><label>বর্তমান স্থিতি</label><span class="amount" id="statBalance">—</span></div>
      </div>
    </div>
    <div class="budget-bar-wrap">
      <div class="budget-bar-label">
        <span>বাজেটের অবশিষ্ট: <strong id="statRemaining">—</strong></span>
        <span id="statUtilization">০%</span>
      </div>
      <div class="budget-bar"><span id="budgetBarFill" style="width:0%"></span></div>
    </div>
    <div class="chart-grid">
      <div class="chart-card">
        <h3>মাসিক আয় ও ব্যয়</h3>
        <p class="chart-note">অর্থবছর জুলাই থেকে জুন পর্যন্ত</p>
        <canvas id="monthlyChart" height="220"></canvas>
      </div>
      <div class="chart-card">
        <h3>বাজেট ব্যবহার</h3>
        <p class="chart-note">ব্যবহৃত বনাম অবশিষ্ট বাজেট</p>
        <canvas id="budgetChart" height="220"></canvas>
      </div>
    </div>
    <div class="chart-card" style="margin-top:24px;">
      <h3>ক্যাটাগরি অনুযায়ী ব্যয়</h3>
      <p class="chart-note">চলতি অর্থবছরের মোট ব্যয়ের বিভাজন</p>
      <canvas id="categoryChart" height="220"></canvas>
    </div>
  `;
}

function fillStats(s) {
  document.getElementById("statBudget").textContent = formatTaka(s.budget);
  document.getElementById("statIncome").textContent = formatTaka(s.income);
  document.getElementById("statExpense").textContent = formatTaka(s.expense);
  document.getElementById("statBalance").textContent = formatTaka(s.balance);
  document.getElementById("statRemaining").textContent = formatTaka(s.remainingBudget);
  document.getElementById("statUtilization").textContent = s.utilization + "%";
  document.getElementById("budgetBarFill").style.width = s.utilization + "%";
}

const GREEN = "#2B7A63", GOLD = "#C9A227", RED = "#9C3B34";

function drawBudgetChart(s) {
  const ctx = document.getElementById("budgetChart");
  if (budgetChart) budgetChart.destroy();
  const used = Math.min(s.expense, s.budget || s.expense);
  const remaining = Math.max((s.budget || 0) - s.expense, 0);
  budgetChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["ব্যবহৃত বাজেট", "অবশিষ্ট বাজেট"],
      datasets: [{ data: [used, remaining], backgroundColor: [GOLD, "#E7E4D9"], borderWidth: 0 }]
    },
    options: {
      cutout: "68%",
      plugins: { legend: { position: "bottom", labels: { font: { family: "'Noto Sans Bengali'" } } } }
    }
  });
}

function drawMonthlyChart(s) {
  const ctx = document.getElementById("monthlyChart");
  if (monthlyChart) monthlyChart.destroy();
  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: s.monthly.map(m => m.label),
      datasets: [
        { label: "আয়", data: s.monthly.map(m => m.income), backgroundColor: GREEN },
        { label: "ব্যয়", data: s.monthly.map(m => m.expense), backgroundColor: RED }
      ]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, ticks: { callback: v => formatTaka(v) } } },
      plugins: { legend: { position: "bottom", labels: { font: { family: "'Noto Sans Bengali'" } } } }
    }
  });
}

function drawCategoryChart(s) {
  const ctx = document.getElementById("categoryChart");
  const entries = Object.entries(s.categoryExpense || {});
  if (categoryChart) categoryChart.destroy();
  if (!entries.length) {
    ctx.closest(".chart-card").querySelector(".chart-note").insertAdjacentHTML(
      "afterend", '<div class="empty-state">এই অর্থবছরে কোনো ব্যয়ের তথ্য পাওয়া যায়নি।</div>'
    );
    ctx.style.display = "none";
    return;
  }
  const palette = ["#2B7A63","#C9A227","#9C3B34","#1F5C4B","#B8891F","#4B564F","#256B4E","#D8B85A","#6E4A3A"];
  categoryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map((_, i) => palette[i % palette.length]) }]
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { callback: v => formatTaka(v) } } }
    }
  });
}
