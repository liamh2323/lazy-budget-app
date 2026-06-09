const express = require("express");
const router = express.Router();
const db = require("../db");

// display categories
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM categories WHERE userid = $1",
      [req.userid],
    );
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: "Error: Unable to Execute Request" });
  }
});

// add new category
router.post("/", async (req, res) => {
  const name = req.body.categoryName;
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: "categoryName must be between 1 and 100 characters" });
  }
  try {
    await db.query(
      "INSERT INTO categories (categoryName,userID) VALUES($1,$2)",
      [name.trim(), req.userid],
    );
    res.json({ message: "New category successfully added" });
  } catch (dbErr) {
    res.status(500).json({ error: "Error: Unable to Execute Request" });
  }
});

//update category name
router.put("/:id", async (req, res) => {
  const name = req.body.categoryName;
  if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: "categoryName must be between 1 and 100 characters" });
  }
  try {
    await db.query(
      "UPDATE categories SET categoryName = $1 WHERE categoryID = $2 AND userid = $3",
      [name.trim(), req.params.id, req.userid],
    );
    res.json({ message: "Category name successfully changed" });
  } catch (dbErr) {
    res.status(500).json({ error: "Error: Unable to Execute Request" });
  }
});

//delete category
router.delete("/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM categories WHERE categoryID = $1 AND userid = $2",
      [req.params.id, req.userid],
    );
    res.json({ message: "Category deleted" });
  } catch (dbErr) {
    res.status(500).json({ error: "Error: Unable to Execute Request" });
  }
});

module.exports = router;
