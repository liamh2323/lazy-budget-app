const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/sumDebits", async (req, res) => {
  const { month, year } = req.query;
  try {
    const params = [req.userid];
    let dateFilter = "";

    if (month && year) {
      params.push(month, year);
      dateFilter = ` AND EXTRACT(MONTH FROM t.transactiondate) = $2
                     AND EXTRACT(YEAR  FROM t.transactiondate) = $3`;
    }

    const query = `
      SELECT SUM(sub.sum) AS sum, sub.categoryid, sub.categoryname
      FROM (
        -- Non-split transactions
        SELECT SUM(t.amount) AS sum, t.categoryid, c.categoryname
        FROM transactions t
        LEFT JOIN categories c ON t.categoryid = c.categoryid
        WHERE t.type = 'debit' AND t.userid = $1
              AND (t.written_off = false OR t.written_off IS NULL)
              AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transactionid = t.transactionid)
              ${dateFilter}
        GROUP BY t.categoryid, c.categoryname

        UNION ALL

        -- Split transactions
        SELECT SUM(ts.amount) AS sum, ts.categoryid, c.categoryname
        FROM transaction_splits ts
        JOIN transactions t ON ts.transactionid = t.transactionid
        LEFT JOIN categories c ON ts.categoryid = c.categoryid
        WHERE t.type = 'debit' AND t.userid = $1
              AND (t.written_off = false OR t.written_off IS NULL)
              ${dateFilter}
        GROUP BY ts.categoryid, c.categoryname
      ) sub
      GROUP BY sub.categoryid, sub.categoryname
    `;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/sumCredits", async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = `SELECT SUM(amount) AS sum FROM transactions WHERE type = 'credit' AND userid = $1 AND (written_off = false OR written_off IS NULL)`;
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

router.post("/:id/split", async (req, res) => {
  const { splits } = req.body;
  if (!Array.isArray(splits) || splits.length < 2) {
    return res.status(400).json({ error: "At least 2 splits required" });
  }

  try {
        const txResult = await db.query(
      `SELECT amount FROM transactions WHERE transactionid = $1 AND userid = $2`,
      [req.params.id, req.userid]
    );
    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const txAmount = parseFloat(txResult.rows[0].amount);
    const splitTotal = splits.reduce((s, r) => s + parseFloat(r.amount), 0);

    if (Math.abs(splitTotal - txAmount) > 0.01) {
      return res.status(400).json({ error: "Split amounts must sum to transaction total" });
    }

    await db.query("BEGIN");

    await db.query(
      `DELETE FROM transaction_splits WHERE transactionid = $1 AND userid = $2`,
      [req.params.id, req.userid]
    );

    for (const split of splits) {
      await db.query(
        `INSERT INTO transaction_splits (transactionid, categoryid, amount, userid)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, split.categoryid, split.amount, req.userid]
      );
    }

    await db.query(
      `UPDATE transactions SET categoryid = NULL, categorised = true
       WHERE transactionid = $1 AND userid = $2`,
      [req.params.id, req.userid]
    );

    await db.query("COMMIT");
    res.json({ success: true });
  } catch (dbErr) {
    await db.query("ROLLBACK");
    res.status(500).json({ error: dbErr.message });
  }
});

router.put("/:id/writeoff", async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE transactions
       SET written_off = NOT COALESCE(written_off, false)
       WHERE transactionid = $1 AND userid = $2
       RETURNING written_off`,
      [req.params.id, req.userid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    res.json(result.rows[0]);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/monthlyTrends", async (req, res) => {
  const months = parseInt(req.query.months) || 6;
  try {
    const result = await db.query(
      `SELECT yr, mo,
              SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) AS total_debits,
              SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) AS total_credits
       FROM (
         -- Non-split transactions
         SELECT EXTRACT(YEAR FROM t.transactiondate)::int AS yr,
                EXTRACT(MONTH FROM t.transactiondate)::int AS mo,
                t.amount, t.type
         FROM transactions t
         WHERE t.userid = $1
           AND (t.written_off = false OR t.written_off IS NULL)
           AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transactionid = t.transactionid)
           AND t.transactiondate >= CURRENT_DATE - INTERVAL '1 month' * $2

         UNION ALL

         -- Split debits (use split amounts)
         SELECT EXTRACT(YEAR FROM t.transactiondate)::int AS yr,
                EXTRACT(MONTH FROM t.transactiondate)::int AS mo,
                ts.amount, t.type
         FROM transaction_splits ts
         JOIN transactions t ON ts.transactionid = t.transactionid
         WHERE t.userid = $1
           AND (t.written_off = false OR t.written_off IS NULL)
           AND t.transactiondate >= CURRENT_DATE - INTERVAL '1 month' * $2
       ) sub
       GROUP BY yr, mo
       ORDER BY yr, mo`,
      [req.userid, months]
    );
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/topMerchants", async (req, res) => {
  const { month, year } = req.query;
  const limit = parseInt(req.query.limit) || 5;
  try {
    let query = `
      SELECT t.merchantname, SUM(t.amount) AS total
      FROM transactions t
      WHERE t.userid = $1
        AND t.type = 'debit'
        AND (t.written_off = false OR t.written_off IS NULL)
    `;
    const params = [req.userid];

    if (month && year) {
      params.push(month, year);
      query += ` AND EXTRACT(MONTH FROM t.transactiondate) = $2
                 AND EXTRACT(YEAR  FROM t.transactiondate) = $3`;
    }

    params.push(limit);
    query += ` GROUP BY t.merchantname ORDER BY total DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.get("/byCategory", async (req, res) => {
  const { categoryid, month, year } = req.query;
  if (!categoryid || !month || !year) {
    return res.status(400).json({ error: "categoryid, month, and year are required" });
  }
  try {
    const result = await db.query(
      `-- Direct transactions in this category (non-split)
       SELECT t.transactionid, t.merchantname, t.amount, t.amount AS full_amount,
              t.transactiondate, t.type, t.written_off, 'direct' AS source
       FROM transactions t
       WHERE t.userid = $1
         AND t.categoryid = $2
         AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transactionid = t.transactionid)
         AND EXTRACT(MONTH FROM t.transactiondate) = $3
         AND EXTRACT(YEAR FROM t.transactiondate) = $4

       UNION ALL

       -- Split portions allocated to this category
       SELECT t.transactionid, t.merchantname, ts.amount, t.amount AS full_amount,
              t.transactiondate, t.type, t.written_off, 'split' AS source
       FROM transaction_splits ts
       JOIN transactions t ON ts.transactionid = t.transactionid
       WHERE t.userid = $1
         AND ts.categoryid = $2
         AND EXTRACT(MONTH FROM t.transactiondate) = $3
         AND EXTRACT(YEAR FROM t.transactiondate) = $4

       ORDER BY transactiondate DESC`,
      [req.userid, categoryid, month, year]
    );
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

module.exports = router;
