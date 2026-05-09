const express = require('express');
const db = require('./db');
const app = express();
const uploadRouter = require('./routes/upload');



app.use(express.json());

app.get('/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ connected: true, time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ connected: false, error: err.message });
    }
});

app.use('/upload', uploadRouter);

app.listen(3000, () => console.log('Server running on port 3000'));
