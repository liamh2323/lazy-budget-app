document.getElementById("login").addEventListener("click", function () {
  console.log("clicked");
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  console.log(email, password);

  fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
    });
});
