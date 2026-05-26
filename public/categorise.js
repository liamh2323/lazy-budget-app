const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { headers: authHeaders(), ...opts });
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
    </div>
  `,
    )
    .join("");

  // When a category is selected, auto-select the same category for all rows
  // with the same merchant name
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
    const categoryid = row.querySelector(".cat-sel").value;
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
