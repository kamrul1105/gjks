document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("transactionRoot");
  if (!root) return;

  const yearSelect = document.getElementById("filterYear");
  const monthSelect = document.getElementById("filterMonth");
  const categorySelect = document.getElementById("filterCategory");
  const typeSelect = document.getElementById("filterType");
  const searchInput = document.getElementById("filterSearch");
  const form = document.getElementById("filterForm");

  try {
    const years = await API.getYears();
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
    yearSelect.value = years.includes(CONFIG.DEFAULT_YEAR) ? CONFIG.DEFAULT_YEAR : years[0];

    monthSelect.innerHTML = CONFIG.MONTH_KEYS
      .map((mk, i) => `<option value="${mk}">${CONFIG.MONTH_ORDER[i]}</option>`).join("");

    await populateCategories(yearSelect.value, categorySelect);
    await loadTable(yearSelect.value, monthSelect.value, categorySelect.value, typeSelect.value, searchInput.value);
  } catch (e) {
    return renderError(root);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadTable(yearSelect.value, monthSelect.value, categorySelect.value, typeSelect.value, searchInput.value);
  });
  yearSelect.addEventListener("change", () => populateCategories(yearSelect.value, categorySelect));
});

async function populateCategories(year, select) {
  const current = select.value;
  const cats = await API.getCategories(year);
  const all = [...cats.income, ...cats.expense];
  select.innerHTML = `<option value="">সব ক্যাটাগরি</option>` +
    all.map(c => `<option value="${c}">${c}</option>`).join("");
  if (all.includes(current)) select.value = current;
}

async function loadTable(year, monthKey, category, type, search) {
  const root = document.getElementById("transactionRoot");
  renderLoading(root, "হিসাবের তথ্য লোড হচ্ছে...");

  let rows;
  try {
    rows = await API.getTransactions(year, monthKey);
  } catch (e) {
    return renderError(root);
  }

  let filtered = rows.filter(r => {
    if (category && r.category !== category) return false;
    if (type === "income" && !(r.income > 0)) return false;
    if (type === "expense" && !(r.expense > 0)) return false;
    if (search && !r.particulars.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!filtered.length) {
    return renderEmpty(root, "এই মাসে কোনো লেনদেনের তথ্য পাওয়া যায়নি।");
  }

  root.innerHTML = `
    <div class="table-wrap">
      <table class="ledger">
        <thead>
          <tr>
            <th>তারিখ</th><th>বিবরণ</th><th>ক্যাটাগরি</th><th>আয়</th><th>ব্যয়</th>
            <th>চলতি স্থিতি</th><th>ভাউচার</th><th>মন্তব্য</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(rowHtml).join("")}
        </tbody>
      </table>
    </div>`;

  root.querySelectorAll("[data-voucher]").forEach(btn => {
    btn.addEventListener("click", () => openVoucher(btn.getAttribute("data-voucher")));
  });
}

function rowHtml(r) {
  return `
    <tr>
      <td>${r.date}</td>
      <td style="text-align:right;white-space:normal;">${r.particulars}</td>
      <td>${r.category}</td>
      <td class="${r.income ? "income" : ""}">${r.income ? formatTaka(r.income) : "-"}</td>
      <td class="${r.expense ? "expense" : ""}">${r.expense ? formatTaka(r.expense) : "-"}</td>
      <td>${formatTaka(r.runningBalance)}</td>
      <td>${r.voucherUrl ? `<button class="voucher-link" data-voucher="${r.voucherUrl}">দেখুন</button>` : "-"}</td>
      <td class="remarks">${r.remarks || "-"}</td>
    </tr>`;
}
