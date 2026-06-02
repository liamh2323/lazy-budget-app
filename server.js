require('dotenv').config();

const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 15 minutes
	limit: 8, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
	standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
	ipv6Subnet: 56, // Set to 60 or 64 to be less aggressive, or 52 or 48 to be more aggressive
	// store: ... , // Redis, Memcached, etc. See below.
});

const express = require('express');
const db = require('./db');
const app = express();
const cookie = require('cookie-parser');
const uploadRouter = require('./routes/upload');
const categoryRouter = require('./routes/categories');
const mappedRouter = require('./routes/mappedMerchants');
const authRouter = require('./routes/auth');
const verifyToken = require('./middleware/verifyToken');
const transactionRouter = require('./routes/transactions');



app.use(express.json());
app.use(cookie());

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
app.use('/auth',limiter, authRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
