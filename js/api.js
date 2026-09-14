/* ==========================================================================
   API.js
   Every page talks to data ONLY through the functions below. Swapping the
   backend in (CONFIG.API_URL + USE_DEMO_DATA = false) requires no changes
   anywhere else in the codebase — every function keeps the same shape.
   ========================================================================== */

const API = (() => {
  const cache = new Map();

  function cacheKey(fn, args) {
    return fn + "::" + JSON.stringify(args);
  }

  function fromCache(key) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.time > CONFIG.CACHE_TTL_MS) { cache.delete(key); return null; }
    return hit.value;
  }

  async function callBackend(action, params) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set("action", action);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error("network");
    const json = await res.json();
    if (json && json.error) throw new Error(json.error);
    return json;
  }

  function useDemo() {
    return CONFIG.USE_DEMO_DATA || !CONFIG.API_URL;
  }

  async function request(action, params, demoResolver) {
    const key = cacheKey(action, params);
    const cached = fromCache(key);
    if (cached) return cached;

    let value;
    if (useDemo()) {
      // Simulate a tiny bit of latency so loading states are visible/testable.
      await new Promise(r => setTimeout(r, 120));
      value = demoResolver(DEMO_DATA);
    } else {
      value = await callBackend(action, params);
    }
    cache.set(key, { value, time: Date.now() });
    return value;
  }

  return {
    getYears() {
      return request("getYears", {}, d => d.years.slice());
    },

    getSettings(year) {
      return request("getSettings", { year }, d => d.settings[year] || null);
    },

    getCategories(year) {
      return request("getCategories", { year }, d => d.categories);
    },

    getCommittee() {
      return request("getCommittee", {}, d => d.committee);
    },

    getReports(year) {
      return request("getReports", { year }, d => d.reports[year] || []);
    },

    getOrganization() {
      return request("getOrganization", {}, d => d.organization);
    },

    getContact() {
      return request("getContact", {}, d => d.contact);
    },

    // Returns totals + all 12 months of income/expense for charts.
    async getSummary(year) {
      return request("getSummary", { year }, (d) => {
        const settings = d.settings[year];
        if (!settings) return null;
        const monthsData = d.transactions[year] || {};
        let income = 0, expense = 0;
        const monthly = CONFIG.MONTH_KEYS.map((mk, i) => {
          const rows = monthsData[mk] || [];
          const mIncome = rows.reduce((s, r) => s + (r.income || 0), 0);
          const mExpense = rows.reduce((s, r) => s + (r.expense || 0), 0);
          income += mIncome; expense += mExpense;
          return { label: CONFIG.MONTH_ORDER[i], income: mIncome, expense: mExpense };
        });
        const opening = settings.openingBalance || 0;
        const budget = settings.totalBudget || 0;
        const balance = opening + income - expense;
        const remainingBudget = budget - expense;
        const utilization = budget > 0 ? Math.min(100, Math.round((expense / budget) * 100)) : 0;

        // category-wise expense breakdown across the whole year
        const catTotals = {};
        Object.values(monthsData).flat().forEach(r => {
          if (r.expense) catTotals[r.category] = (catTotals[r.category] || 0) + r.expense;
        });

        return {
          year, budget, openingBalance: opening, income, expense, balance,
          remainingBudget, utilization, monthly, categoryExpense: catTotals
        };
      });
    },

    getTransactions(year, monthKey) {
      return request("getTransactions", { year, month: monthKey }, (d) => {
        const rows = (d.transactions[year] && d.transactions[year][monthKey]) || [];
        // attach running balance within the month view
        let running = 0;
        return rows.map(r => {
          running += (r.income || 0) - (r.expense || 0);
          return { ...r, runningBalance: running };
        });
      });
    }
  };
})();
