const express = require('express');
const router = express.Router();

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('file'), (req, res) => {
    console.log('hit');
    res.json ({message: "file recieved"}); 
});
module.exports = router;