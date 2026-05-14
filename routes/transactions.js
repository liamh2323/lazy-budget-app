const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/sumDebits", async (req, res) => {
    console.log(req.userid);
  try {
    const sumDebits = await db.query(
      `SELECT SUM(amount), categoryid FROM transactions 
        WHERE type = 'debit'AND userid = $1 
        GROUP BY categoryid`,
      [req.userid],
    );
    res.json({ sum: sumDebits.rows });
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/sumCredits", async (req, res) => {
  try {
    const sumCredits = await db.query(
      `SELECT SUM(amount) FROM transactions 
        WHERE type = 'credit' AND userid = $1`,
      [req.userid],
    );
    res.json({sum : sumCredits.rows});
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

module.exports = router;
