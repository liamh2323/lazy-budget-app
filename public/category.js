const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

let categories = [];

const params = new URLSearchParams(window.location.search);
const categoryId = params.get("categoryid");
const categoryName = decodeURIComponent(params.get("categoryname") || "Category");

document.getElementById("category-title").textContent = categoryName;

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
  if (String(i + 1) === params.get("month")) opt.selected = true;
  else if (!params.get("month") && i === now.getMonth()) opt.selected = true;
  monthSel.appendChild(opt);
});

for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
  const opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  if (String(y) === params.get("year")) opt.selected = true;
  else if (!params.get("year") && y === now.getFullYear()) opt.selected = true;
  yearSel.appendChild(opt);
}

monthSel.addEventListener("change", loadTransactions);
yearSel.addEventListener("change", loadTransactions);

function buildCatOptions() {
  return categories
    .map(
      (c) =>
        `<option value="${c.categoryid}">${escHtml(c.categoryname)}</option>`,
    )
    .join("");
}

function renderSplitEditor(row, transactionId, fullAmount, merchantName) {
  const amount = parseFloat(fullAmount).toFixed(2);
  const opts = buildCatOptions();

  row.innerHTML = `
    <div class="w-full space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">${escHtml(merchantName)}
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

  addSplitRow();
  addSplitRow();

  row.querySelector(".split-add-row").addEventListener("click", addSplitRow);
  row.querySelector(".split-cancel").addEventListener("click", () => loadTransactions());

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

    const result = await apiFetch(`/transactions/${transactionId}/split`, {
      method: "POST",
      body: JSON.stringify({ splits }),
    });

    if (result && result.success) {
      loadTransactions();
    }
  });
}

async function loadTransactions() {
  const month = monthSel.value;
  const year = yearSel.value;
  const list = document.getElementById("transactions-list");

  // Fetch categories if not loaded yet
  if (categories.length === 0) {
    categories = (await apiFetch("/categories")) || [];
  }

  const data = await apiFetch(
    `/transactions/byCategory?categoryid=${categoryId}&month=${month}&year=${year}`
  );

  if (!data) return;

  if (data.length === 0) {
    list.innerHTML =
      '<p class="text-sm text-gray-500">No transactions in this category for this period.</p>';
    document.getElementById("category-total").textContent = "€0.00";
    return;
  }

  // Compute total (exclude written-off)
  const total = data.reduce((sum, t) => {
    if (t.written_off) return sum;
    return sum + parseFloat(t.amount);
  }, 0);
  document.getElementById("category-total").textContent = "€" + total.toFixed(2);

  list.innerHTML = data
    .map(
      (t) => `
    <div class="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded px-4 py-3${t.written_off ? " opacity-50" : ""}"
         data-id="${t.transactionid}">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate${t.written_off ? " line-through" : ""}">
          ${escHtml(t.merchantname)}
          ${t.source === "split" ? '<span class="ml-1 text-xs bg-indigo-600/30 text-indigo-300 rounded px-1.5 py-0.5">split</span>' : ""}
          ${t.written_off ? '<span class="ml-1 text-xs bg-yellow-600/30 text-yellow-300 rounded px-1.5 py-0.5">written off</span>' : ""}
        </p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${new Date(t.transactiondate).toLocaleDateString("en-IE")}
        </p>
      </div>
      <span class="text-sm font-medium ${t.type === "debit" ? "text-red-400" : "text-emerald-400"}${t.written_off ? " line-through" : ""}">
        €${parseFloat(t.amount).toFixed(2)}
      </span>
      <button class="writeoff-btn text-xs px-2 py-1 rounded transition-colors
        ${t.written_off ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"}">
        ${t.written_off ? "Undo" : "Write off"}
      </button>
      <button class="split-btn text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        data-full-amount="${parseFloat(t.full_amount).toFixed(2)}"
        data-merchant="${escHtml(t.merchantname)}">
        Split
      </button>
      <button class="move-btn text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        data-merchant="${escHtml(t.merchantname)}">
        Move
      </button>
    </div>
  `,
    )
    .join("");

  // Attach write-off handlers
  list.querySelectorAll(".writeoff-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("[data-id]");
      const id = row.dataset.id;
      const result = await apiFetch(`/transactions/${id}/writeoff`, {
        method: "PUT",
      });
      if (!result) return;
      // Reload to update totals and visuals
      loadTransactions();
    });
  });

  // Attach split handlers
  list.querySelectorAll(".split-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("[data-id]");
      const id = row.dataset.id;
      const fullAmount = btn.dataset.fullAmount;
      const merchant = btn.dataset.merchant;
      renderSplitEditor(row, id, fullAmount, merchant);
    });
  });

  // Attach move handlers
  list.querySelectorAll(".move-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest("[data-id]");
      const merchant = btn.dataset.merchant;

      // Replace the button area with a category picker
      const otherCats = categories.filter((c) => String(c.categoryid) !== categoryId);
      if (otherCats.length === 0) {
        alert("No other categories to move to.");
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "flex items-center gap-2 move-picker";
      wrapper.innerHTML = `
        <select class="move-cat-sel bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-500">
          <option value="">Move to…</option>
          ${otherCats.map((c) => `<option value="${c.categoryid}">${escHtml(c.categoryname)}</option>`).join("")}
        </select>
        <label class="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap select-none cursor-pointer">
          <input type="checkbox" class="remove-mapping-cb accent-indigo-500" checked>
          remove mapping
        </label>
        <button class="move-confirm text-xs bg-indigo-600 hover:bg-indigo-500 rounded px-3 py-1 transition-colors">Confirm</button>
        <button class="move-cancel text-xs text-gray-400 hover:text-gray-200 transition-colors">Cancel</button>
      `;

      // Hide the action buttons and show the picker
      const actions = row.querySelectorAll(".writeoff-btn, .split-btn, .move-btn");
      actions.forEach((el) => el.classList.add("hidden"));
      row.appendChild(wrapper);

      wrapper.querySelector(".move-cancel").addEventListener("click", () => {
        wrapper.remove();
        actions.forEach((el) => el.classList.remove("hidden"));
      });

      wrapper.querySelector(".move-confirm").addEventListener("click", async () => {
        const newCatId = wrapper.querySelector(".move-cat-sel").value;
        if (!newCatId) return;

        const removeMapping = wrapper.querySelector(".remove-mapping-cb").checked;

        // Move the transaction to the new category
        await apiFetch(`/transactions/${row.dataset.id}`, {
          method: "PUT",
          body: JSON.stringify({ categoryid: newCatId }),
        });

        // Optionally remove the merchant mapping
        if (removeMapping) {
          await apiFetch("/mappedMerchants/byMerchant", {
            method: "DELETE",
            body: JSON.stringify({ merchantName: merchant }),
          });
        }

        loadTransactions();
      });
    });
  });
}

loadTransactions();
