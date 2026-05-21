const express = require('express');
const multer = require('multer');
const path = require('path');
const settingsController = require('../controllers/settings.controller');

const router = express.Router();
const { cmsProtect } = require('../middleware/cmsAuth');
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Public read for branding on login
router.get('/', settingsController.getSettings);
router.put('/', cmsProtect, settingsController.updateSettings);
router.post('/logo', cmsProtect, upload.single('logo'), settingsController.uploadLogo);

module.exports = router;
