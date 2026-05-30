const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

var BASE_URL = "https://lazy-budget-app.onrender.com";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE_URL + path, { headers: authHeaders(), ...opts });
  if (res.status === 401) {
    window.location.href = "/login.html";
    return null;
  }
  return res.json();
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let categories = [];
let spendingChart = null;
let trendsChart = null;

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/login.html";
});

const monthSel = document.getElementById("month-select");
const yearSel = document.getElementById("year-select");
const now = new Date();

MONTHS.forEach((name, i) => {
  const opt = document.createElement("option");
  opt.value = i + 1;
  opt.textContent = name;
  if (i === now.getMonth()) opt.selected = true;
  monthSel.appendChild(opt);
});

for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
  const opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  if (y === now.getFullYear()) opt.selected = true;
  yearSel.appendChild(opt);
}

monthSel.addEventListener("change", loadOverview);
yearSel.addEventListener("change", loadOverview);

const TAB_NAMES = ["overview", "categories", "merchants", "upload"];

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    const active = b.dataset.tab === name;
    b.classList.toggle("border-indigo-500", active);
    b.classList.toggle("text-indigo-400", active);
    b.classList.toggle("border-transparent", !active);
    b.classList.toggle("text-gray-400", !active);
  });

  TAB_NAMES.forEach((t) => {
    document.getElementById("tab-" + t).classList.toggle("hidden", t !== name);
  });

  if (name === "overview") loadOverview();
  if (name === "categories") loadCategories();
  if (name === "merchants") loadMerchants();
}

async function loadOverview() {
  const month = monthSel.value;
  const year = yearSel.value;

  const [debits, credits, trends, topMerchants] = await Promise.all([
    apiFetch(`/transactions/sumDebits?month=${month}&year=${year}`),
    apiFetch(`/transactions/sumCredits?month=${month}&year=${year}`),
    apiFetch(`/transactions/monthlyTrends?months=6`),
    apiFetch(`/transactions/topMerchants?month=${month}&year=${year}&limit=5`),
  ]);

  if (!debits || !credits) return;

  const totalDebits = debits.reduce(
    (sum, r) => sum + parseFloat(r.sum || 0),
    0,
  );
  const totalCredits = parseFloat(credits[0]?.sum || 0);

  document.getElementById("total-credits").textContent =
    "€" + totalCredits.toFixed(2);
  document.getElementById("total-debits").textContent =
    "€" + totalDebits.toFixed(2);

  // Net savings
  const netSavings = totalCredits - totalDebits;
  const netEl = document.getElementById("net-savings");
  netEl.textContent = (netSavings >= 0 ? "€" : "-€") + Math.abs(netSavings).toFixed(2);
  netEl.classList.remove("text-emerald-400", "text-red-400");
  netEl.classList.add(netSavings >= 0 ? "text-emerald-400" : "text-red-400");

  renderChart(debits);
  if (trends) renderTrendsChart(trends);
  if (topMerchants) renderTopMerchants(topMerchants);
}

function renderChart(debits) {
  const canvas = document.getElementById("spending-chart");
  const noData = document.getElementById("no-chart-data");
  const rows = debits.filter((r) => parseFloat(r.sum) > 0);

  if (rows.length === 0) {
    noData.classList.remove("hidden");
    canvas.classList.add("hidden");
    if (spendingChart) {
      spendingChart.destroy();
      spendingChart = null;
    }
    return;
  }

  noData.classList.add("hidden");
  canvas.classList.remove("hidden");

  const labels = rows.map((r) => r.categoryname || "Uncategorised");
  const values = rows.map((r) => parseFloat(r.sum));
  const colors = rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (spendingChart) spendingChart.destroy();

  spendingChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: "#111827",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const row = rows[idx];
        if (!row.categoryid) return;
        window.location.href = `/category.html?categoryid=${row.categoryid}&categoryname=${encodeURIComponent(row.categoryname)}&month=${monthSel.value}&year=${yearSel.value}`;
      },
      plugins: {
        legend: {
          position: "right",
          labels: { color: "#d1d5db", font: { size: 12 }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` €${ctx.parsed.toFixed(2)}`,
          },
        },
      },
    },
  });
}

function renderTrendsChart(data) {
  const canvas = document.getElementById("trends-chart");
  if (trendsChart) trendsChart.destroy();

  if (!data || data.length === 0) {
    canvas.classList.add("hidden");
    return;
  }
  canvas.classList.remove("hidden");

  const labels = data.map((d) => MONTHS[d.mo - 1] + " " + d.yr);
  const debitsData = data.map((d) => parseFloat(d.total_debits || 0));
  const creditsData = data.map((d) => parseFloat(d.total_credits || 0));

  trendsChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: debitsData,
          backgroundColor: "#ef4444",
          borderRadius: 4,
        },
        {
          label: "Income",
          data: creditsData,
          backgroundColor: "#10b981",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#d1d5db", font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` €${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: "#9ca3af", font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: "#9ca3af", callback: (v) => "€" + v }, grid: { color: "#374151" } },
      },
    },
  });
}

function renderTopMerchants(data) {
  const list = document.getElementById("top-merchants-list");

  if (!data || data.length === 0) {
    list.innerHTML = '<p class="text-sm text-gray-500">No merchant data for this period.</p>';
    return;
  }

  list.innerHTML = data
    .map(
      (m, i) => `
    <div class="flex items-center justify-between bg-gray-700/50 rounded px-3 py-2">
      <span class="text-sm">
        <span class="text-gray-400 mr-2">${i + 1}.</span>
        ${escHtml(m.merchantname)}
      </span>
      <span class="text-sm text-red-400 font-medium">€${parseFloat(m.total).toFixed(2)}</span>
    </div>
  `,
    )
    .join("");
}

async function loadCategories() {
  categories = (await apiFetch("/categories")) || [];
  renderCategories();
}

function renderCategories() {
  const list = document.getElementById("categories-list");

  if (categories.length === 0) {
    list.innerHTML = '<p class="text-sm text-gray-500">No categories yet.</p>';
    return;
  }

  list.innerHTML = categories
    .map(
      (c) => `
    <div class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2" data-id="${c.categoryid}">
      <span class="flex-1 text-sm cat-name">${escHtml(c.categoryname)}</span>
      <input type="text" value="${escHtml(c.categoryname)}"
        class="cat-edit hidden flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500">
      <button class="edit-btn text-xs text-gray-400 hover:text-indigo-400 transition-colors">Edit</button>
      <button class="save-btn hidden text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Save</button>
      <button class="delete-btn text-xs text-gray-400 hover:text-red-400 transition-colors">Delete</button>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll("[data-id]").forEach((row) => {
    const id = row.dataset.id;
    const nameEl = row.querySelector(".cat-name");
    const editInp = row.querySelector(".cat-edit");
    const editBtn = row.querySelector(".edit-btn");
    const saveBtn = row.querySelector(".save-btn");
    const deleteBtn = row.querySelector(".delete-btn");

    editBtn.addEventListener("click", () => {
      nameEl.classList.add("hidden");
      editInp.classList.remove("hidden");
      editBtn.classList.add("hidden");
      saveBtn.classList.remove("hidden");
      editInp.focus();
    });

    saveBtn.addEventListener("click", async () => {
      const newName = editInp.value.trim();
      if (!newName) return;
      await apiFetch(`/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify({ categoryName: newName }),
      });
      await loadCategories();
    });

    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this category?")) return;
      await apiFetch(`/categories/${id}`, { method: "DELETE" });
      await loadCategories();
    });
  });
}

document.getElementById("add-cat-btn").addEventListener("click", async () => {
  const input = document.getElementById("new-cat-name");
  const name = input.value.trim();
  if (!name) return;
  await apiFetch("/categories", {
    method: "POST",
    body: JSON.stringify({ categoryName: name }),
  });
  input.value = "";
  await loadCategories();
});

async function loadMerchants() {
  if (categories.length === 0)
    categories = (await apiFetch("/categories")) || [];
  const [merchants, unmapped] = await Promise.all([
    apiFetch("/mappedMerchants"),
    apiFetch("/mappedMerchants/unmapped"),
  ]);
  renderUnmapped(unmapped || []);
  renderMerchants(merchants || []);
}

function catOptions() {
  return categories
    .map(
      (c) =>
        `<option value="${c.categoryid}">${escHtml(c.categoryname)}</option>`,
    )
    .join("");
}

function renderUnmapped(unmapped) {
  const list = document.getElementById("unmapped-list");

  if (unmapped.length === 0) {
    list.innerHTML =
      '<p class="text-sm text-gray-500">All merchants are mapped.</p>';
    return;
  }

  list.innerHTML = unmapped
    .map(
      (m) => `
    <div class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2" data-merchant="${escHtml(m.merchantname)}">
      <span class="flex-1 text-sm">${escHtml(m.merchantname)}</span>
      <span class="text-sm text-gray-400">€${parseFloat(m.total || 0).toFixed(2)}</span>
      <select class="unmapped-cat-sel bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
        <option value="">Category</option>
        ${catOptions()}
      </select>
      <button class="map-btn bg-indigo-600 hover:bg-indigo-500 rounded px-3 py-1.5 text-xs transition-colors">Map</button>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".map-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-merchant]");
      const categoryID = row.querySelector(".unmapped-cat-sel").value;
      if (!categoryID) return;
      await apiFetch("/mappedMerchants", {
        method: "POST",
        body: JSON.stringify({ merchantName: row.dataset.merchant, categoryID }),
      });
      await loadMerchants();
    });
  });
}

function renderMerchants(merchants) {
  const list = document.getElementById("merchants-list");
  const catMap = Object.fromEntries(
    categories.map((c) => [c.categoryid, c.categoryname]),
  );

  if (merchants.length === 0) {
    list.innerHTML =
      '<p class="text-sm text-gray-500">No merchant mappings yet.</p>';
    return;
  }

  list.innerHTML = merchants
    .map(
      (m) => `
    <div class="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded px-3 py-2">
      <span class="flex-1 text-sm">${escHtml(m.merchantname)}</span>
      <span class="text-sm text-gray-400">€${parseFloat(m.total || 0).toFixed(2)}</span>
      <span class="text-sm text-gray-400">${escHtml(catMap[m.categoryid] || "Unknown")}</span>
      <button class="del-merchant text-xs text-gray-400 hover:text-red-400 transition-colors" data-id="${m.mappedid}">Delete</button>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".del-merchant").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await apiFetch("/mappedMerchants", {
        method: "DELETE",
        body: JSON.stringify({ mappedID: btn.dataset.id }),
      });
      await loadMerchants();
    });
  });
}

// Add new category from merchants tab
document
  .getElementById("merchants-add-cat-btn")
  .addEventListener("click", async () => {
    const input = document.getElementById("merchants-new-cat-name");
    const name = input.value.trim();
    if (!name) return;
    await apiFetch("/categories", {
      method: "POST",
      body: JSON.stringify({ categoryName: name }),
    });
    input.value = "";
    categories = (await apiFetch("/categories")) || [];
    await loadMerchants();
  });

document.getElementById("upload-btn").addEventListener("click", async () => {
  const fileInput = document.getElementById("csv-file");
  const statusEl = document.getElementById("upload-status");
  const file = fileInput.files[0];

  if (!file) {
    statusEl.textContent = "Please select a file first.";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  statusEl.textContent = "Uploading…";

  const res = await fetch(BASE_URL + "/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: formData,
  });

  const data = await res.json();

  if (res.ok) {
    statusEl.textContent = `Uploaded ${data.rows} transactions. Redirecting…`;
    setTimeout(() => {
      window.location.href = "/categorise.html";
    }, 1000);
  } else {
    statusEl.textContent = "Upload failed: " + (data.error || "Unknown error");
  }
});

loadOverview();
