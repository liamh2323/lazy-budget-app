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
    res.status(500).json({ error: dbErr.message });
  }
});

// add new category
router.post("/", async (req, res) => {
  try {
    await db.query(
      "INSERT INTO categories (categoryName,userID) VALUES($1,$2)",
      [req.body.categoryName, req.userid],
    );
    res.json("new category successfully added :)");
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

//update category name
router.put("/:id", async (req, res) => {
  try {
    await db.query(
      "UPDATE categories SET categoryName = $1 WHERE categoryID = $2 AND userid = $3",
      [req.body.categoryName, req.params.id, req.userid],
    );
    res.json("category name sucessfully changed");
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

//delete category
router.delete("/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM categories WHERE categoryID = $1 AND userid = $2",
      [req.params.id, req.userid],
    );
    res.json("category deleted");
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

module.exports = router;
