/**
 * ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি — Backend API (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Reads everything from the "Ghior_JKS" Google Drive folder and returns JSON
 * whose shape matches, action-for-action, what js/api.js expects. This file
 * is the ONLY place that touches Google Sheets/Drive — the website never
 * talks to Google directly.
 *
 * DRIVE LAYOUT THIS SCRIPT EXPECTS (see README.md for full setup steps):
 *
 * Ghior_JKS/
 *   Website_Config            <- one Google Sheet, tabs: Organization, Committee, Reports, Contact
 *   Website_Media/             <- logo.png, president photos, member photos
 *   Accounts/
 *     2026-27/Accounts_2026-27 <- one Google Sheet per year, tabs: Settings, July..June
 *     2025-26/Accounts_2025-26
 *     ...
 *   Vouchers/...                <- referenced only via links pasted into monthly sheets
 *   Reports/...                 <- referenced only via links pasted into Website_Config > Reports
 *
 * DEPLOY: Extensions > Apps Script in any Sheet (or a standalone script) ->
 * paste this file -> Deploy > New deployment > Web app -> Execute as: Me,
 * Who has access: Anyone -> copy the /exec URL into CONFIG.API_URL in
 * js/config.js and set CONFIG.USE_DEMO_DATA = false.
 */

const ROOT_FOLDER_NAME = "Ghior_JKS";
const CONFIG_FILE_NAME = "Website_Config";
const ACCOUNTS_SUBFOLDER = "Accounts";
const CACHE_SECONDS = 300; // 5 minutes, mirrors CONFIG.CACHE_TTL_MS on the frontend

const MONTH_KEYS = ["july","august","september","october","november","december",
                    "january","february","march","april","may","june"];
const MONTH_SHEET_NAMES = ["July","August","September","October","November","December",
                            "January","February","March","April","May","June"];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function doGet(e) {
  const action = (e.parameter.action || "").trim();
  let result;
  try {
    switch (action) {
      case "getYears": result = getYears(); break;
      case "getSettings": result = getSettings(e.parameter.year); break;
      case "getCategories": result = getCategories(e.parameter.year); break;
      case "getCommittee": result = getCommittee(); break;
      case "getReports": result = getReports(e.parameter.year); break;
      case "getOrganization": result = getOrganization(); break;
      case "getContact": result = getContact(); break;
      case "getSummary": result = getSummary(e.parameter.year); break;
      case "getTransactions": result = getTransactions(e.parameter.year, e.parameter.month); break;
      default: result = { error: "unknown action: " + action };
    }
  } catch (err) {
    result = { error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Folder / file lookup helpers (cached — Drive search is the slow part)
// ---------------------------------------------------------------------------
function cacheGet(key) {
  const v = CacheService.getScriptCache().get(key);
  return v ? JSON.parse(v) : null;
}
function cacheSet(key, value) {
  CacheService.getScriptCache().put(key, JSON.stringify(value), CACHE_SECONDS);
}

function getRootFolder() {
  const it = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (!it.hasNext()) throw new Error(ROOT_FOLDER_NAME + " ফোল্ডার পাওয়া যায়নি।");
  return it.next();
}

function getConfigSpreadsheet() {
  const root = getRootFolder();
  const it = root.getFilesByName(CONFIG_FILE_NAME);
  if (!it.hasNext()) throw new Error(CONFIG_FILE_NAME + " শীট পাওয়া যায়নি।");
  return SpreadsheetApp.open(it.next());
}

function getAccountsFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName(ACCOUNTS_SUBFOLDER);
  if (!it.hasNext()) throw new Error(ACCOUNTS_SUBFOLDER + " ফোল্ডার পাওয়া যায়নি।");
  return it.next();
}

// Finds the "Accounts_<year>" spreadsheet inside Accounts/<year>/
function getYearSpreadsheet(year) {
  const accountsFolder = getAccountsFolder();
  const yearFolders = accountsFolder.getFoldersByName(year);
  if (!yearFolders.hasNext()) return null;
  const yearFolder = yearFolders.next();
  const files = yearFolder.getFilesByName("Accounts_" + year);
  if (!files.hasNext()) return null;
  return SpreadsheetApp.open(files.next());
}

// All year-folder names under Accounts/, newest first
function getYears() {
  const cached = cacheGet("years");
  if (cached) return cached;

  const accountsFolder = getAccountsFolder();
  const folders = accountsFolder.getFolders();
  const years = [];
  while (folders.hasNext()) years.push(folders.next().getName());
  years.sort().reverse();

  cacheSet("years", years);
  return years;
}

// ---------------------------------------------------------------------------
// Settings (per-year key/value sheet)
// ---------------------------------------------------------------------------
function getSettings(year) {
  const cacheKey = "settings_" + year;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const ss = getYearSpreadsheet(year);
  if (!ss) return null;
  const sheet = ss.getSheetByName("Settings");
  if (!sheet) return null;

  const rows = sheet.getDataRange().getValues(); // [ [label, value], ... ]
  const map = {};
  rows.forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[1]; });

  const settings = {
    financialYear: year,
    organizationName: map["Organization Name"] || "",
    committeeName: map["Committee Name"] || "",
    totalBudget: Number(map["Total Budget"]) || 0,
    openingBalance: Number(map["Opening Balance"]) || 0,
    logoUrl: map["Logo URL"] || ""
  };
  cacheSet(cacheKey, settings);
  return settings;
}

// ---------------------------------------------------------------------------
// Categories (per-year "Categories" sheet: Type | Category Name | Active)
// ---------------------------------------------------------------------------
function getCategories(year) {
  const ss = getYearSpreadsheet(year);
  const fallback = { income: [], expense: [] };
  if (!ss) return fallback;
  const sheet = ss.getSheetByName("Categories");
  if (!sheet) return fallback;

  const rows = sheet.getDataRange().getValues();
  const out = { income: [], expense: [] };
  rows.slice(1).forEach(r => {
    const type = String(r[0] || "").trim().toLowerCase();
    const name = r[1];
    const active = r[2] === undefined || r[2] === "" || r[2] === true || String(r[2]).toLowerCase() === "true";
    if (!name || !active) return;
    if (type === "income") out.income.push(name);
    if (type === "expense") out.expense.push(name);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Committee (Website_Config > "Committee" sheet)
// Columns: Committee Type | Name | Position | Photo URL | Display Order
// Committee Type is "Main" or "Field"
// ---------------------------------------------------------------------------
function getCommittee() {
  const cached = cacheGet("committee");
  if (cached) return cached;

  const cfg = getConfigSpreadsheet();
  const sheet = cfg.getSheetByName("Committee");
  const result = { main: [], field: [] };
  if (!sheet) return result;

  const rows = sheet.getDataRange().getValues();
  rows.slice(1).forEach(r => {
    const [type, name, position, photoUrl, order] = r;
    if (!name) return;
    const person = { name, position, photoUrl: photoUrl || "", order: Number(order) || 0 };
    const bucket = String(type).trim().toLowerCase() === "field" ? result.field : result.main;
    if (bucket.length === 0 || Number(order) === 1) person.president = true;
    bucket.push(person);
  });
  result.main.sort((a, b) => a.order - b.order);
  result.field.sort((a, b) => a.order - b.order);
  result.main.forEach((p, i) => p.president = i === 0);
  result.field.forEach((p, i) => p.president = i === 0);

  cacheSet("committee", result);
  return result;
}

// ---------------------------------------------------------------------------
// Reports (Website_Config > "Reports" sheet)
// Columns: Financial Year | Report Type | Title | PDF URL | Excel URL
// ---------------------------------------------------------------------------
function getReports(year) {
  const cfg = getConfigSpreadsheet();
  const sheet = cfg.getSheetByName("Reports");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .filter(r => String(r[0]).trim() === year)
    .map(r => ({ reportType: r[1] || "", title: r[2] || "", pdfUrl: r[3] || "", excelUrl: r[4] || "" }));
}

// ---------------------------------------------------------------------------
// Organization text (Website_Config > "Organization" sheet, label/value)
// ---------------------------------------------------------------------------
function getOrganization() {
  const cfg = getConfigSpreadsheet();
  const sheet = cfg.getSheetByName("Organization");
  if (!sheet) return { description: "", purpose: "" };
  const rows = sheet.getDataRange().getValues();
  const map = {};
  rows.forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[1]; });
  return { description: map["Description"] || "", purpose: map["Purpose"] || "" };
}

// ---------------------------------------------------------------------------
// Contact (Website_Config > "Contact" sheet, label/value)
// ---------------------------------------------------------------------------
function getContact() {
  const cfg = getConfigSpreadsheet();
  const sheet = cfg.getSheetByName("Contact");
  if (!sheet) return { address: "", phone: "", email: "" };
  const rows = sheet.getDataRange().getValues();
  const map = {};
  rows.forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[1]; });
  return { address: map["Address"] || "", phone: map["Phone"] || "", email: map["Email"] || "" };
}

// ---------------------------------------------------------------------------
// Transactions for one month
// Monthly sheet columns (row 1 header): Date | Particulars | Category | Income | Expense | Voucher Link | Remarks
// ---------------------------------------------------------------------------
function readMonthRows(ss, monthSheetName) {
  const sheet = ss.getSheetByName(monthSheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  return rows
    .filter(r => r[0]) // has a date
    .map(r => ({
      date: formatDate(r[0]),
      particulars: r[1] || "",
      category: r[2] || "",
      income: Number(r[3]) || 0,
      expense: Number(r[4]) || 0,
      voucherUrl: r[5] || "",
      remarks: r[6] || ""
    }));
}

function formatDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yy = String(value.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }
  return String(value);
}

function getTransactions(year, monthKey) {
  const ss = getYearSpreadsheet(year);
  if (!ss) return [];
  const idx = MONTH_KEYS.indexOf(monthKey);
  if (idx === -1) return [];
  const rows = readMonthRows(ss, MONTH_SHEET_NAMES[idx]);
  let running = 0;
  return rows.map(r => {
    running += r.income - r.expense;
    return Object.assign({}, r, { runningBalance: running });
  });
}

// ---------------------------------------------------------------------------
// Summary: totals + all 12 months + category breakdown, for the dashboard
// ---------------------------------------------------------------------------
function getSummary(year) {
  const cacheKey = "summary_" + year;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const settings = getSettings(year);
  if (!settings) return null;
  const ss = getYearSpreadsheet(year);

  let income = 0, expense = 0;
  const catTotals = {};
  const monthly = MONTH_SHEET_NAMES.map((sheetName, i) => {
    const rows = readMonthRows(ss, sheetName);
    const mIncome = rows.reduce((s, r) => s + r.income, 0);
    const mExpense = rows.reduce((s, r) => s + r.expense, 0);
    rows.forEach(r => { if (r.expense) catTotals[r.category] = (catTotals[r.category] || 0) + r.expense; });
    income += mIncome; expense += mExpense;
    return { label: BN_MONTHS[i], income: mIncome, expense: mExpense };
  });

  const opening = settings.openingBalance || 0;
  const budget = settings.totalBudget || 0;
  const balance = opening + income - expense;
  const remainingBudget = budget - expense;
  const utilization = budget > 0 ? Math.min(100, Math.round((expense / budget) * 100)) : 0;

  const summary = {
    year, budget, openingBalance: opening, income, expense, balance,
    remainingBudget, utilization, monthly, categoryExpense: catTotals
  };
  cacheSet(cacheKey, summary);
  return summary;
}

const BN_MONTHS = ["জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর",
                    "জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন"];
