/* ==========================================================================
   CONFIG.js
   The ONE place that knows about the backend and the financial-year rules.
   Everything else in the app reads through window.CONFIG / window.DEMO_DATA
   and never hard-codes a number.

   TO GO LIVE:
   1. Deploy the Apps Script (see /google-apps-script/Code.gs) as a Web App.
   2. Paste its URL into API_URL below.
   3. Set USE_DEMO_DATA to false.
   Nothing else in the site needs to change.
   ========================================================================== */

const CONFIG = {
  // Paste your deployed Google Apps Script Web App URL here, e.g.
  // "https://script.google.com/macros/s/AKfycbxBho70nd0atHx1f6wyXRvN03CEmfMY66i8FcUd3btLU_sk9l4eqkCYX7FZ5yj_Lq4V/exec"
  API_URL: "https://script.google.com/macros/s/AKfycbzI5epj9sXVKJhQFbX4_GezG2RdGQPcQeEvXd94woKquQuO_YCe5bUcIMtaVDJ3UQamcA/exec",

  // While API_URL is empty (or this stays true) the site runs on the demo
  // dataset below so the frontend can be built/tested without a backend.
  USE_DEMO_DATA: false,

  DEFAULT_YEAR: "2026-27",
  ORG_NAME: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি",
  SITE_TITLE: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি — আর্থিক স্বচ্ছতা",

  // Financial year runs July -> June, never January -> December.
  MONTH_ORDER: [
    "জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর",
    "জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন"
  ],
  MONTH_KEYS: [
    "july","august","september","october","november","december",
    "january","february","march","april","may","june"
  ],

  CACHE_TTL_MS: 5 * 60 * 1000 // avoid refetching the same year/month within 5 min
};

/* --------------------------------------------------------------------------
   DEMO DATA
   Shape mirrors exactly what getSummary/getTransactions/getCommittee/getReports
   return from Apps Script (see section 31/45-48 of the spec). Replace by
   pointing CONFIG.API_URL at the real backend — do not edit this in place
   to "add real data"; real data belongs in Google Sheets.
   -------------------------------------------------------------------------- */
const DEMO_DATA = {
  isDemo: true,

  settings: {
    "2026-27": {
      financialYear: "2026-27",
      organizationName: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি",
      committeeName: "মাঠের উপকমিটি",
      totalBudget: 500000,
      openingBalance: 40000,
      logoUrl: ""
    },
    "2025-26": {
      financialYear: "2025-26",
      organizationName: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি",
      committeeName: "মাঠের উপকমিটি",
      totalBudget: 420000,
      openingBalance: 15000,
      logoUrl: ""
    },
    "2024-25": {
      financialYear: "2024-25",
      organizationName: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি",
      committeeName: "মাঠের উপকমিটি",
      totalBudget: 350000,
      openingBalance: 0,
      logoUrl: ""
    }
  },

  years: ["2026-27", "2025-26", "2024-25"],

  categories: {
    income: ["সদস্য চাঁদা", "অনুদান", "দান", "অন্যান্য আয়"],
    expense: ["মাঠ উন্নয়ন", "মাঠ পরিষ্কার-পরিচ্ছন্নতা", "মাটি/বালু/ইট", "শ্রমিক/মজুরি",
              "রক্ষণাবেক্ষণ", "বিদ্যুৎ/পানি", "খেলাধুলা/অনুষ্ঠান", "সরঞ্জাম", "অন্যান্য"]
  },

  committee: {
    main: [
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সভাপতি", photoUrl: "", order: 1, president: true },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সাধারণ সম্পাদক", photoUrl: "", order: 2 },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "কোষাধ্যক্ষ", photoUrl: "", order: 3 },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সদস্য", photoUrl: "", order: 4 },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সদস্য", photoUrl: "", order: 5 }
    ],
    field: [
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সভাপতি (মাঠ উপকমিটি)", photoUrl: "", order: 1, president: true },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সম্পাদক", photoUrl: "", order: 2 },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সদস্য", photoUrl: "", order: 3 },
      { name: "নাম শীঘ্রই যুক্ত হবে", position: "সদস্য", photoUrl: "", order: 4 }
    ]
  },

  // transactions[year][monthKey] = array of {date, particulars, category, income, expense, voucherUrl, remarks}
  transactions: {
    "2026-27": {
      july: [
        { date: "01-07-26", particulars: "সদস্য চাঁদা সংগ্রহ", category: "সদস্য চাঁদা", income: 12000, expense: 0, voucherUrl: "", remarks: "" },
        { date: "08-07-26", particulars: "মাঠ পরিষ্কার মজুরি", category: "শ্রমিক/মজুরি", income: 0, expense: 3500, voucherUrl: "https://drive.google.com/", remarks: "৩ জন শ্রমিক" },
        { date: "19-07-26", particulars: "অনুদান — স্থানীয় ব্যবসায়ী", category: "অনুদান", income: 10000, expense: 0, voucherUrl: "", remarks: "" }
      ],
      august: [
        { date: "03-08-26", particulars: "মাঠের ঘাস কাটা", category: "মাঠ উন্নয়ন", income: 0, expense: 4200, voucherUrl: "https://drive.google.com/", remarks: "" },
        { date: "14-08-26", particulars: "সদস্য চাঁদা সংগ্রহ", category: "সদস্য চাঁদা", income: 9000, expense: 0, voucherUrl: "", remarks: "" }
      ],
      september: [
        { date: "01-09-26", particulars: "সদস্য চাঁদা", category: "সদস্য চাঁদা", income: 5000, expense: 0, voucherUrl: "", remarks: "" },
        { date: "03-09-26", particulars: "মাঠ পরিষ্কার", category: "মাঠ পরিষ্কার-পরিচ্ছন্নতা", income: 0, expense: 1000, voucherUrl: "", remarks: "" }
      ],
      october: [], november: [], december: [],
      january: [], february: [], march: [], april: [], may: [], june: []
    },
    "2025-26": {
      july: [{ date: "05-07-25", particulars: "সদস্য চাঁদা", category: "সদস্য চাঁদা", income: 15000, expense: 0, voucherUrl: "", remarks: "" }],
      august: [{ date: "10-08-25", particulars: "বিদ্যুৎ বিল", category: "বিদ্যুৎ/পানি", income: 0, expense: 1800, voucherUrl: "", remarks: "" }],
      september: [], october: [], november: [], december: [],
      january: [{ date: "12-01-26", particulars: "খেলাধুলা সরঞ্জাম", category: "সরঞ্জাম", income: 0, expense: 6500, voucherUrl: "", remarks: "" }],
      february: [], march: [], april: [], may: [], june: []
    },
    "2024-25": {
      july: [], august: [], september: [], october: [], november: [], december: [],
      january: [], february: [], march: [], april: [], may: [], june: []
    }
  },

  reports: {
    "2026-27": [
      { reportType: "ত্রৈমাসিক প্রতিবেদন", title: "১ম ত্রৈমাসিক প্রতিবেদন (জুলাই–সেপ্টেম্বর)", pdfUrl: "", excelUrl: "" }
    ],
    "2025-26": [
      { reportType: "বার্ষিক প্রতিবেদন", title: "বার্ষিক আর্থিক প্রতিবেদন ২০২৫-২৬", pdfUrl: "", excelUrl: "" }
    ],
    "2024-25": [
      { reportType: "বার্ষিক প্রতিবেদন", title: "বার্ষিক আর্থিক প্রতিবেদন ২০২৪-২৫", pdfUrl: "", excelUrl: "" }
    ]
  },

  organization: {
    description: "ঘিওর কুড়িকাহুনিয়া জন কল্যান সমিতি স্থানীয় জনকল্যাণ ও মাঠ উন্নয়নের কাজে নিয়োজিত একটি সংগঠন। এই ওয়েবসাইটে সংগঠনের আর্থিক কার্যক্রমের হিসাব সর্বসাধারণের জন্য উন্মুক্তভাবে প্রকাশ করা হয়।",
    purpose: "সংগঠনের উদ্দেশ্য ও কার্যক্রমের বিস্তারিত তথ্য শীঘ্রই যুক্ত করা হবে।"
  },

  contact: {
    address: "",
    phone: "",
    email: ""
  }
};
