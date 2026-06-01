// Toggle panels
document.getElementById("show-register").addEventListener("click", () => {
  document.getElementById("login-panel").classList.add("hidden");
  document.getElementById("register-panel").classList.remove("hidden");
});

document.getElementById("show-login").addEventListener("click", () => {
  document.getElementById("register-panel").classList.add("hidden");
  document.getElementById("login-panel").classList.remove("hidden");
});

const BASE_URL = "https://lazy-budget-app.onrender.com";

document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("login-error");

  errorEl.classList.add("hidden");

  const res = await fetch(BASE_URL + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (res.status == 200) {
    window.location.href = "/dashboard.html";
  } else {
    errorEl.textContent = data.message || "Login failed.";
    errorEl.classList.remove("hidden");
  }
});

document.getElementById("register-btn").addEventListener("click", async () => {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errorEl = document.getElementById("register-error");
  const successEl = document.getElementById("register-success");

  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  const res = await fetch(BASE_URL + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (res.status === 201) {
    successEl.classList.remove("hidden");
  } else {
    errorEl.textContent = data.error || "Registration failed.";
    errorEl.classList.remove("hidden");
  }
});
