require("dotenv").config();
const db = require("../db");

async function dedup() {
  const result = await db.query(`
    DELETE FROM transactions
    WHERE transactionid IN (
      SELECT t1.transactionid
      FROM transactions t1
      JOIN transactions t2
        ON  t1.userid        = t2.userid
        AND t1.merchantname  = t2.merchantname
        AND t1.amount        = t2.amount
        AND t1.type          = t2.type
        AND t1.transactionid < t2.transactionid
        AND EXTRACT(YEAR  FROM t1.transactiondate) = EXTRACT(YEAR  FROM t2.transactiondate)
        AND EXTRACT(MONTH FROM t1.transactiondate) = EXTRACT(DAY   FROM t2.transactiondate)
        AND EXTRACT(DAY   FROM t1.transactiondate) = EXTRACT(MONTH FROM t2.transactiondate)
    )
    RETURNING transactionid
  `);

  console.log(`Deleted ${result.rows.length} duplicate transaction(s).`);
  process.exit(0);
}

dedup().catch((err) => {
  console.error(err);
  process.exit(1);
});
