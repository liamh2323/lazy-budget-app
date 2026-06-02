const express = require("express");
const router = express.Router();
const { parse } = require("csv-parse");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 100000 },
});
const db = require("../db");
const crypto = require("crypto");
const exceljs = require("exceljs");

function makeHash(element, userID) {
  const raw = `${element.date}${element.amount}${element.merchant}${userID}`;
  const hash = crypto.createHash("md5").update(raw).digest("hex");
  return hash;
}

function changeDateFormat(element) {
  let changedDate = "";

  const splitString = element.split("/");
  changedDate += "20" + splitString[2];
  changedDate += "-";
  changedDate += splitString[1];
  changedDate += "-";
  changedDate += splitString[0];

  return changedDate;
}

function fileFilter(req, file, cb) {
  if (
    [
      "application/pdf",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(file.mimetype)
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

router.post("/", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "file does not meet requirements" });
  }

  let cleanData;

  try {
    if (req.file.mimetype == "text/csv") {
      const records = await new Promise((resolve, reject) => {
        parse(req.file.buffer, { columns: true }, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      cleanData = records.map((row) => {
        return {
          date: changeDateFormat(row[" Posted Transactions Date"]),
          merchant: row[" Description"],
          type: row["Transaction Type"] == "Debit" ? "debit" : "credit",
          amount:
            row["Transaction Type"] == "Debit"
              ? row[" Debit Amount"]
              : row[" Credit Amount"],
        };
      });
    } else if (
      req.file.mimetype ==
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = new exceljs.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];

      const headers = [];
      worksheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value);
      });

      const records = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          record[headers[colNumber - 1]] = cell.value;
        });
        records.push(record);
      });

      console.log(records[0]);

      cleanData = records.map((row) => {
        return {
          date: changeDateFormat(row["Started Date"]),
          merchant: row["Description"],
          type:
            row["Product"] == "Savings" || Number(row["Amount"]) < 0
              ? "debit"
              : "credit",
          amount: Math.abs(Number(row["Amount"])),
        };
      });
    }

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
    res.json({ rows: cleanData.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
