const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await db.query(
      `INSERT INTO users (email,password)
        VALUES($1,$2)`,
      [req.body.email, hashedPassword],
    );
    res.status(201).json({message : 'User created'});
  } catch (dbErr) {
    res.status(500).json({ error: dbErr.message });
  }
});

router.post("/login", async(req,res) =>{
    try {
        const user = await db.query(
            "SELECT * FROM users WHERE email = $1", [req.body.email]
        );
        if(await bcrypt.compare(req.body.password, user.rows[0].password)){
            const token = jwt.sign({ userid: user.rows[0].userid }, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.status(200).json({token, message : 'Logged in sucessfully'});
        }
        else{
            res.status(401).json({message : 'incorrect password'});
        }
    } catch (dbErr) {
        res.status(500).json({ error: dbErr.message });
    }
});

module.exports = router;
