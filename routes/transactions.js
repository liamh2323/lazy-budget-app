const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/sumDebits", async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = `
      SELECT SUM(t.amount) AS sum, t.categoryid, c.categoryname
      FROM transactions t
      LEFT JOIN categories c ON t.categoryid = c.categoryid
      WHERE t.type = 'debit' AND t.userid = $1
    `;
    const params = [req.userid];

    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM t.transactiondate) = $2
                 AND EXTRACT(YEAR  FROM t.transactiondate) = $3`;
    }

    query += ` GROUP BY t.categoryid, c.categoryname`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/sumCredits", async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = `SELECT SUM(amount) AS sum FROM transactions WHERE type = 'credit' AND userid = $1`;
    const params = [req.userid];

    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM transactiondate) = $2
                 AND EXTRACT(YEAR  FROM transactiondate) = $3`;
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/uncategorised", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM transactions
       WHERE categorised = false AND userid = $1
       ORDER BY transactiondate DESC`,
      [req.userid]
    );
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    await db.query(
      `UPDATE transactions
       SET categoryid = $1, categorised = true
       WHERE transactionid = $2 AND userid = $3`,
      [req.body.categoryid, req.params.id, req.userid]
    );
    res.json({ success: true });
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

module.exports = router;
