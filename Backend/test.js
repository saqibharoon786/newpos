const mongoose = require('mongoose'); 
mongoose.connect('mongodb://localhost:27017/gym_management').then(async () => { 
  const Purchase = require('./models/pop.model.js'); 
  const ProcessingMaterial = require('./models/process.model.js').ProcessingMaterial;
  
  const purchases = await Purchase.find({code: {$ne: null}, status: "available"}).select('code receiptNo materialName'); 
  console.log('Purchases with code:', purchases); 
  
  const processingMaterials = await ProcessingMaterial.find({}).select('code receiptNo purchaseId materialName');
  console.log('ProcessingMaterials:', processingMaterials);
  
  process.exit(0); 
}).catch(console.error);
