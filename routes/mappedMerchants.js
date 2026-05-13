const express = require('express');
const router = express.Router();
const db = require('../db');

// show all mappedMerchants
router.get("/", async (req, res) => {
    try {
        const result = await db.query(
            "SELECT * FROM mappedMerchants WHERE userID = $1",
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
        const result =await db.query(
            `INSERT INTO mappedMerchants (merchantName,categoryID,userID) 
            VALUES($1,$2,$3) 
            ON CONFLICT (userid, merchantname) DO UPDATE SET categoryid = $2 
            RETURNING *`,
            [req.body.merchantName,req.body.categoryID, req.userid],
        );
        res.json(result.rows);
    } catch (dbErr) {
        res.status(500).json({ error: dbErr.message });
    }
});

//delete MM
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

module.exports = router;