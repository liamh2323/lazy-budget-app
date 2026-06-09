const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(email, password) {
  if (!email || typeof email !== "string" || email.length > 255 || !EMAIL_REGEX.test(email.trim())) {
    return "Invalid email address";
  }
  if (!password || typeof password !== "string" || password.length < 5 || password.length > 128) {
    return "Password must be between 8 and 128 characters";
  }
  return null;
}

router.post("/register", async (req, res) => {
  const validationError = validateCredentials(req.body.email, req.body.password);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await db.query(
      `INSERT INTO users (email,password)
        VALUES($1,$2)`,
      [req.body.email.trim().toLowerCase(), hashedPassword],
    );
    res.status(201).json({message : 'User created'});
  } catch (dbErr) {
    res.status(500).json({ error: "Unable to create user" });
  }
});

router.post("/login", async(req,res) =>{
  const validationError = validateCredentials(req.body.email, req.body.password);
  if (validationError) {
    return res.status(401).json({ message: "Cannot login" });
  }
  try {
    const user = await db.query(
      "SELECT * FROM users WHERE email = $1", [req.body.email.trim().toLowerCase()]
    );
    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Cannot login" });
    }
    if (await bcrypt.compare(req.body.password, user.rows[0].password)) {
      const token = jwt.sign({ userid: user.rows[0].userid }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.status(200).cookie("token", token, {httpOnly: true, secure: true, sameSite: 'strict'}).json({ message : 'Logged in successfully'});
    } else {
      res.status(401).json({ message: "Cannot login" });
    }
  } catch (dbErr) {
    res.status(500).json({ error: "Cannot login" });
  }
});

router.post('/logout', async(req,res) =>{
  res.clearCookie('token');
  res.status(200).json({message: "Logged out successfully"})
});

module.exports = router;
