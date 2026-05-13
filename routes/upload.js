const express = require("express");
const router = express.Router();
const { parse } = require("csv-parse");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const db = require("../db");
const crypto = require("crypto");

function makeHash(element, userID) {
  const raw = `${element.date}${element.amount}${element.merchant}${userID}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex");
  return hash;
}

// adds CSV files to PostgreSQL
router.post("/", upload.single("file"), (req, res) => {
  parse(req.file.buffer, { columns: true }, async (err, records) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const cleanData = records.map((row) => {
        return {
          date: row[" Posted Transactions Date"],
          merchant: row[" Description"],
          type: row["Transaction Type"] == "Debit" ? "debit" : "credit",
          amount:
            row["Transaction Type"] == "Debit"
              ? row[" Debit Amount"]
              : row[" Credit Amount"],
        };
      });
      //console.log(cleanData);

      const allMapped = await db.query(
        "SELECT * FROM mappedMerchants WHERE userID = $1",
        [req.userid],
      );

      const mappings = allMapped.rows.reduce((acc, row) => {
        acc[row.merchantname] = row.categoryid;
        return acc;
      }, {});

      for (const element of cleanData) {
        element.hash = makeHash(element, req.userid);
        element.categoryid = mappings[element.merchant] || null;

        await db.query(
          `INSERT INTO transactions (userID,merchantName,amount,transactionDate,type,hash,categoryid,categorised)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (hash) DO NOTHING`,
          [
            req.userid,
            element.merchant,
            element.amount,
            element.date,
            element.type,
            element.hash,
            element.categoryid,
            element.categoryid != null,
          ],
        );
      }
      res.json({ rows: records.length });
    } catch (dbErr) {
      res.status(500).json({ error: dbErr.message });
    }
  });
});

module.exports = router;
