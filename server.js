require('dotenv').config();

const express = require('express');
const db = require('./db');
const app = express();
const uploadRouter = require('./routes/upload');
const categoryRouter = require('./routes/categories');
const mappedRouter = require('./routes/mappedMerchants');
const authRouter = require('./routes/auth');
const verifyToken = require('./middleware/verifyToken');
const transactionRouter = require('./routes/transactions');


app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ connected: true, time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

app.use(express.static('public'));
app.use('/transactions', verifyToken, transactionRouter);
app.use('/mappedMerchants',verifyToken, mappedRouter);
app.use('/categories', verifyToken,categoryRouter);
app.use('/upload', verifyToken, uploadRouter);
app.use('/auth', authRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
