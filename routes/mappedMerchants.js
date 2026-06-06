const express = require('express');
const router = express.Router();
const db = require('../db');

// merchants that appear in transactions but have no mapping yet
router.get("/unmapped", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.merchantname,
              SUM(t.amount) AS total
       FROM transactions t
       WHERE t.userid = $1
         AND COALESCE(t.written_off, false) = false
         AND t.merchantname NOT IN (
           SELECT mm.merchantname FROM mappedMerchants mm WHERE mm.userid = $1
         )
       GROUP BY t.merchantname
       ORDER BY t.merchantname`,
      [req.userid],
    );
    res.json(result.rows);
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

// show all mappedMerchants
router.get("/", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT mm.*, COALESCE(s.total, 0) AS total
             FROM mappedMerchants mm
             LEFT JOIN (
               SELECT merchantname, SUM(amount) AS total
               FROM transactions WHERE userid = $1
               GROUP BY merchantname
             ) s ON mm.merchantname = s.merchantname
             WHERE mm.userID = $1`,
            [req.userid],
        );
        res.json(result.rows);
    } catch (dbErr) {
         res.status(500).json({ error: dbErr.message });
    }
});

// add a new merchant to a category
router.post("/", async(req,res) =>{
    try {
        const result = await db.query(
            `INSERT INTO mappedMerchants (merchantName,categoryID,userID)
            VALUES($1,$2,$3)
            ON CONFLICT (userid, merchantname) DO UPDATE SET categoryid = $2
            RETURNING *`,
            [req.body.merchantName, req.body.categoryID, req.userid],
        );

        // backfill all transactions from this merchant with the new category
        // Skip transactions that have been split into multiple categories
        await db.query(
            `UPDATE transactions SET categoryid = $1, categorised = true
             WHERE userid = $2 AND merchantname = $3
               AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transactionid = transactions.transactionid)`,
            [req.body.categoryID, req.userid, req.body.merchantName],
        );

        res.json(result.rows);
    } catch (dbErr) {
        res.status(500).json({ error: dbErr.message });
    }
});

//delete MM by ID
router.delete("/", async(req,res) => {
    try {
        await db.query(
            "DELETE FROM mappedMerchants WHERE mappedID = $1 AND userID = $2",
            [req.body.mappedID, req.userid],
        );
        res.json('category deleted')
    } catch (dbErr) {
        res.status(500).json({ error: dbErr.message });
    }
});

// delete MM by merchant name
router.delete("/byMerchant", async (req, res) => {
    try {
        await db.query(
            "DELETE FROM mappedMerchants WHERE merchantname = $1 AND userID = $2",
            [req.body.merchantName, req.userid],
        );
        res.json({ success: true });
    } catch (dbErr) {
        res.status(500).json({ error: dbErr.message });
    }
});

module.exports = router;