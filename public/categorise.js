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

let transactions = [];
let categories = [];

function buildCatOptions() {
  return categories
    .map(
      (c) =>
        `<option value="${c.categoryid}">${escHtml(c.categoryname)}</option>`,
    )
    .join("");
}

function refreshCategoryDropdowns() {
  const opts = buildCatOptions();
  document.querySelectorAll(".cat-sel").forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = `<option value="">— skip —</option>${opts}`;
    sel.value = current;
  });
}

function renderSplitEditor(row, transaction) {
  const amount = parseFloat(transaction.amount).toFixed(2);
  const opts = buildCatOptions();

  row.innerHTML = `
    <div class="w-full space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">${escHtml(transaction.merchantname)}
          <span class="text-gray-400 ml-2">€${amount}</span>
        </p>
        <button class="split-cancel text-xs text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
      </div>
      <div class="split-rows space-y-2"></div>
      <div class="flex items-center gap-3">
        <button class="split-add-row text-xs bg-gray-700 hover:bg-gray-600 rounded px-3 py-1 transition-colors">+ Add row</button>
        <span class="text-xs text-gray-400">Remaining: <span class="split-remaining text-white">€${amount}</span></span>
      </div>
      <button class="split-save text-xs bg-indigo-600 hover:bg-indigo-500 rounded px-4 py-1.5 transition-colors">Save Split</button>
    </div>
  `;

  const splitRowsEl = row.querySelector(".split-rows");
  const remainingEl = row.querySelector(".split-remaining");

  function addSplitRow() {
    const div = document.createElement("div");
    div.className = "flex items-center gap-2 split-row";
    div.innerHTML = `
      <select class="split-cat bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500 flex-1">
        <option value="">— select —</option>
        ${opts}
      </select>
      <input type="number" step="0.01" min="0" class="split-amount bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm w-28 focus:outline-none focus:border-indigo-500" placeholder="€0.00">
      <button class="split-remove-row text-xs text-gray-400 hover:text-red-400 transition-colors">✕</button>
    `;
    splitRowsEl.appendChild(div);

    div.querySelector(".split-amount").addEventListener("input", updateRemaining);
    div.querySelector(".split-remove-row").addEventListener("click", () => {
      div.remove();
      updateRemaining();
    });
  }

  function updateRemaining() {
    const total = parseFloat(amount);
    let used = 0;
    splitRowsEl.querySelectorAll(".split-amount").forEach((inp) => {
      used += parseFloat(inp.value) || 0;
    });
    const rem = (total - used).toFixed(2);
    remainingEl.textContent = "€" + rem;
    remainingEl.classList.toggle("text-red-400", parseFloat(rem) < 0);
    remainingEl.classList.toggle("text-emerald-400", parseFloat(rem) === 0);
    remainingEl.classList.toggle("text-white", parseFloat(rem) > 0);
  }

  // Start with 2 rows
  addSplitRow();
  addSplitRow();

  row.querySelector(".split-add-row").addEventListener("click", addSplitRow);

  row.querySelector(".split-cancel").addEventListener("click", () => {
    // Re-render this transaction normally by re-running init
    init();
  });

  row.querySelector(".split-save").addEventListener("click", async () => {
    const splitRows = splitRowsEl.querySelectorAll(".split-row");
    const splits = [];
    for (const sr of splitRows) {
      const categoryid = sr.querySelector(".split-cat").value;
      const amt = parseFloat(sr.querySelector(".split-amount").value);
      if (!categoryid || isNaN(amt) || amt <= 0) continue;
      splits.push({ categoryid: parseInt(categoryid), amount: amt });
    }

    if (splits.length < 2) {
      alert("Need at least 2 valid split rows.");
      return;
    }

    const splitTotal = splits.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(splitTotal - parseFloat(amount)) > 0.01) {
      alert("Split amounts must sum to €" + amount);
      return;
    }

    const result = await apiFetch(`/transactions/${transaction.transactionid}/split`, {
      method: "POST",
      body: JSON.stringify({ splits }),
    });

    if (result && result.success) {
      // Remove this row since it's now categorised
      row.remove();
    }
  });
}

async function init() {
  [transactions, categories] = await Promise.all([
    apiFetch("/transactions/uncategorised"),
    apiFetch("/categories"),
  ]);

  if (!transactions || !categories) return;

  const list = document.getElementById("transactions-list");
  const actionBar = document.getElementById("action-bar");

  if (transactions.length === 0) {
    list.innerHTML =
      '<p class="text-sm text-gray-400">All transactions are already categorised.</p>';
    actionBar.classList.remove("hidden");
    return;
  }

  const opts = buildCatOptions();

  list.innerHTML = transactions
    .map(
      (t) => `
    <div class="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded px-4 py-3"
         data-id="${t.transactionid}" data-merchant="${escHtml(t.merchantname)}">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${escHtml(t.merchantname)}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${new Date(t.transactiondate).toLocaleDateString("en-IE")}
          &nbsp;·&nbsp;
          <span class="${t.type === "debit" ? "text-red-400" : "text-emerald-400"}">
            €${parseFloat(t.amount).toFixed(2)}
          </span>
        </p>
      </div>
      <select class="cat-sel bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
        <option value="">— skip —</option>
        ${opts}
      </select>
      <label class="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap select-none cursor-pointer">
        <input type="checkbox" class="save-map-cb accent-indigo-500" checked>
        save mapping
      </label>
      <button class="writeoff-btn text-xs px-2 py-1 rounded transition-colors
        ${t.written_off ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}"
        data-written-off="${t.written_off ? "true" : "false"}">
        ${t.written_off ? "Undo write-off" : "Write off"}
      </button>
      <button class="split-btn text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        data-amount="${parseFloat(t.amount).toFixed(2)}">
        Split
      </button>
    </div>
  `,
    )
    .join("");

  list.querySelectorAll(".cat-sel").forEach((sel) => {
    sel.addEventListener("change", () => {
      const row = sel.closest("[data-merchant]");
      const merchant = row.dataset.merchant;
      const chosen = sel.value;
      if (!chosen) return;

      list.querySelectorAll(`[data-merchant="${CSS.escape(merchant)}"] .cat-sel`).forEach((other) => {
        if (other !== sel && !other.value) {
          other.value = chosen;
        }
      });
    });
  });

  list.querySelectorAll(".writeoff-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-id]");
      const id = row.dataset.id;
      const result = await apiFetch(`/transactions/${id}/writeoff`, {
        method: "PUT",
      });
      if (!result) return;
      const isOff = result.written_off;
      btn.dataset.writtenOff = isOff ? "true" : "false";
      btn.textContent = isOff ? "Undo write-off" : "Write off";
      btn.classList.toggle("bg-yellow-600", isOff);
      btn.classList.toggle("hover:bg-yellow-500", isOff);
      btn.classList.toggle("text-white", isOff);
      btn.classList.toggle("bg-gray-700", !isOff);
      btn.classList.toggle("hover:bg-gray-600", !isOff);
      btn.classList.toggle("text-gray-300", !isOff);
      // Visual indicator on the row
      const nameEl = row.querySelector(".flex-1");
      nameEl.classList.toggle("opacity-50", isOff);
      nameEl.classList.toggle("line-through", isOff);
    });
  });

  list.querySelectorAll(".split-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("[data-id]");
      const id = row.dataset.id;
      const tx = transactions.find((t) => String(t.transactionid) === id);
      if (tx) renderSplitEditor(row, tx);
    });
  });

  actionBar.classList.remove("hidden");
}

document.getElementById("new-cat-btn").addEventListener("click", async () => {
  const input = document.getElementById("new-cat-input");
  const msg = document.getElementById("new-cat-msg");
  const name = input.value.trim();
  if (!name) return;

  await apiFetch("/categories", {
    method: "POST",
    body: JSON.stringify({ categoryName: name }),
  });

  categories = (await apiFetch("/categories")) || [];
  input.value = "";
  refreshCategoryDropdowns();

  msg.classList.remove("hidden");
  setTimeout(() => msg.classList.add("hidden"), 2000);
});

document.getElementById("save-all-btn").addEventListener("click", async () => {
  const rows = document.querySelectorAll("[data-id]");
  const btn = document.getElementById("save-all-btn");

  btn.disabled = true;
  btn.textContent = "Saving…";

  for (const row of rows) {
    const id = row.dataset.id;
    const merchant = row.dataset.merchant;
    const catSel = row.querySelector(".cat-sel");
    if (!catSel) continue; // skip split-editor rows
    const categoryid = catSel.value;
    const saveMap = row.querySelector(".save-map-cb").checked;

    if (!categoryid) continue;

    await apiFetch(`/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify({ categoryid }),
    });

    if (saveMap) {
      await apiFetch("/mappedMerchants", {
        method: "POST",
        body: JSON.stringify({
          merchantName: merchant,
          categoryID: categoryid,
        }),
      });
    }
  }

  window.location.href = "/dashboard.html";
});

init();
