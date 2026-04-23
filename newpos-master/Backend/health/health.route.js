const router = require("express").Router();
router.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));
module.exports = router;
