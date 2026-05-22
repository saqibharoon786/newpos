const express = require("express");
const {
  getProcessingQueue,
  getProcessingMaterials,
  updateMaterialStatus,
  createProductionRecord,
  createProductionFromBatch,
  getProductionData,
  getProductionForPOS,
  getProcessingDashboard,
  getProductionById,
  updateProduction,
  deleteProduction,
  exportProductionData,
} = require("../controllers/process.controller.js");

const router = express.Router();

// All routes require authentication

// Dashboard routes
router.get("/dashboard", getProcessingDashboard);

// Material routes
router.get("/queue", getProcessingQueue);
router.get("/materials", getProcessingMaterials);
router.put("/materials/:id", updateMaterialStatus);

// Production routes
router.post("/production", createProductionRecord);
router.get("/production", getProductionData);
router.get("/production/for-pos", getProductionForPOS);
router.get("/production/:id", getProductionById);
router.put("/production/:id", updateProduction);
router.delete("/production/:id", deleteProduction);
router.get("/production/export", exportProductionData);

// Legacy /batches routes expected by old frontend process.tsx
// POST /batches → create production record from batch payload
router.post("/batches", createProductionFromBatch);
// GET /batches → return empty list for now (frontend also keeps local batches)
router.get("/batches", (req, res) => {
  res.status(200).json({
    success: true,
    data: [],
  });
});

module.exports = router;