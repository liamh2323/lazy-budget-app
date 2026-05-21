fetch("/transactions/sumDebits", {
  method: "GET",
  headers: {
    "Content-Type" : "application/json",
    "Authorization" : "Bearer " + localStorage.getItem("token"),
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data)
  });

fetch("/transactions/sumCredits", {
  method: "GET",
  headers: {
    "Content-Type" : "application/json",
    "Authorization" : "Bearer " + localStorage.getItem("token"),
  },
})
  .then((res) => res.json())
  .then((data) => {
    console.log(data)
  });
