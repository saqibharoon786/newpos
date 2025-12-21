import { useState, useEffect } from "react";
import { Save, Upload, Calendar, Edit, Trash2, Eye, X, Loader2, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import axios from "axios";

// Configure axios with correct API endpoints
const API_BASE_URL = "http://localhost:5000/api/purchases";
const SALES_API_URL = "http://localhost:5000/api/sales";

// Create axios instance with defaults
const api = axios.create({
  baseURL: "http://localhost:5000",
  timeout: 10000,
});

// Define endpoints
const API_ENDPOINTS = {
  ADD: `${API_BASE_URL}/add`,
  GET_ALL: `${API_BASE_URL}/get-all`,
  GET_ONE: (id: string) => `${API_BASE_URL}/${id}`,
  UPDATE: (id: string) => `${API_BASE_URL}/${id}`,
  DELETE: (id: string) => `${API_BASE_URL}/${id}`,
  ADD_SALE: `${SALES_API_URL}/add-sale`,
  UPDATE_SALE: (id: string) => `${SALES_API_URL}/${id}`,
};

interface Purchase {
  _id: string;
  materialName: string;
  vendor: string;
  price: string;
  weight: string;
  quality: string;
  purchaseDate: string;
  materialColor: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  vehicleColor: string;
  deliveryDate: string;
  receiptNo: string;
  vehicleImage: string;
  createdAt: string;
}

interface Sale {
  _id: string;
  materialName: string;
  supplierName: string;
  invoiceNo: string;
  weight: string;
  unit: string;
  purchaseDate: string;
  branch: string;
  materialColor: string;
  actualPrice: string;
  productionCost: string;
  sellingPrice: string;
  discount: string;
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerCnic: string;
  buyerCompany: string;
  finalAmount: string;
  createdAt: string;
}

interface AddSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Sale | null;
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
];

export function AddSaleDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  isEdit = false, 
  editData = null 
}: AddSaleDialogProps) {
  const [formData, setFormData] = useState({
    materialName: "",
    supplierName: "",
    invoiceNo: "",
    weight: "30KG",
    unit: "2",
    purchaseDate: "",
    purchaseTime: "",
    branch: "",
    materialColor: "#FFFFFF",
    actualPrice: "",
    productionCost: "",
    sellingPrice: "",
    discount: "0",
    buyerName: "",
    buyerAddress: "",
    buyerPhone: "",
    buyerEmail: "",
    buyerCnic: "",
    buyerCompany: "",
  });

  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [selectedWeight, setSelectedWeight] = useState("30KG");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Purchase[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const weightOptions = ["30KG", "40KG", "50KG", "Other"];
  const unitOptions = ["2", "5", "10", "15", "20"];

  // Fetch materials from purchases when dialog opens
  useEffect(() => {
    if (open) {
      fetchMaterials();
      
      if (isEdit && editData) {
        console.log('Loading edit data for sale:', editData);
        
        // Format dates for input
        const formatDateForInput = (dateString: string) => {
          if (!dateString) return "";
          try {
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return "";
          }
        };

        const formatTimeForInput = (dateString: string) => {
          if (!dateString) return "";
          try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit' 
            });
          } catch (error) {
            console.error('Error formatting time:', dateString, error);
            return "";
          }
        };

        const purchaseDate = editData.purchaseDate ? formatDateForInput(editData.purchaseDate) : "";
        const purchaseTime = editData.purchaseDate ? formatTimeForInput(editData.purchaseDate) : "";
        
        setFormData({
          materialName: editData.materialName || "",
          supplierName: editData.supplierName || "",
          invoiceNo: editData.invoiceNo || "",
          weight: editData.weight || "30KG",
          unit: editData.unit || "2",
          purchaseDate: purchaseDate,
          purchaseTime: purchaseTime,
          branch: editData.branch || "",
          materialColor: editData.materialColor || "#FFFFFF",
          actualPrice: editData.actualPrice || "",
          productionCost: editData.productionCost || "",
          sellingPrice: editData.sellingPrice || "",
          discount: editData.discount || "0",
          buyerName: editData.buyerName || "",
          buyerAddress: editData.buyerAddress || "",
          buyerPhone: editData.buyerPhone || "",
          buyerEmail: editData.buyerEmail || "",
          buyerCnic: editData.buyerCnic || "",
          buyerCompany: editData.buyerCompany || "",
        });
        
        setSelectedColor(editData.materialColor || "#FFFFFF");
        setSelectedWeight(editData.weight || "30KG");
      } else {
        resetForm();
      }
    }
  }, [open, isEdit, editData]);

  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const response = await api.get(API_ENDPOINTS.GET_ALL);
      
      if (response.data.success) {
        setMaterials(response.data.data || []);
      } else {
        throw new Error(response.data.message || 'Failed to fetch materials');
      }
    } catch (error: any) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.supplierName.trim()) newErrors.supplierName = "Supplier name is required";
    if (!formData.invoiceNo.trim()) newErrors.invoiceNo = "Invoice number is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required";
    if (!formData.purchaseTime) newErrors.purchaseTime = "Purchase time is required";
    if (!formData.branch) newErrors.branch = "Branch is required";
    if (!formData.actualPrice || parseFloat(formData.actualPrice.replace(/,/g, '')) <= 0) newErrors.actualPrice = "Valid actual price is required";
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice.replace(/,/g, '')) <= 0) newErrors.sellingPrice = "Valid selling price is required";
    if (!formData.buyerName.trim()) newErrors.buyerName = "Buyer name is required";
    if (!formData.buyerPhone.trim()) newErrors.buyerPhone = "Buyer phone is required";
    if (formData.buyerEmail && !/^\S+@\S+\.\S+$/.test(formData.buyerEmail)) newErrors.buyerEmail = "Invalid email address";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleWeightSelect = (weight: string) => {
    setSelectedWeight(weight);
    setFormData(prev => ({ ...prev, weight }));
  };

  const handleMaterialSelect = (materialName: string) => {
    setFormData(prev => ({ ...prev, materialName }));
    
    // Find the selected material to auto-fill other fields if needed
    const selectedMaterial = materials.find(m => m.materialName === materialName);
    if (selectedMaterial) {
      // Auto-fill supplier name from vendor
      if (!formData.supplierName && selectedMaterial.vendor) {
        setFormData(prev => ({ ...prev, supplierName: selectedMaterial.vendor }));
      }
      
      // Auto-fill material color
      if (selectedMaterial.materialColor) {
        setSelectedColor(selectedMaterial.materialColor);
      }
      
      // Auto-fill actual price (you might want to add some markup)
      if (!formData.actualPrice && selectedMaterial.price) {
        setFormData(prev => ({ ...prev, actualPrice: selectedMaterial.price }));
      }
    }
  };

  const handleBranchSelect = (materialName: string) => {
    // Set both branch and materialName when a branch is selected
    setFormData(prev => ({ 
      ...prev, 
      branch: materialName,
      materialName: materialName // Also set the material name
    }));
    
    // Find the selected material to auto-fill other fields if needed
    const selectedMaterial = materials.find(m => m.materialName === materialName);
    if (selectedMaterial) {
      // Auto-fill supplier name from vendor
      if (!formData.supplierName && selectedMaterial.vendor) {
        setFormData(prev => ({ ...prev, supplierName: selectedMaterial.vendor }));
      }
      
      // Auto-fill material color
      if (selectedMaterial.materialColor) {
        setSelectedColor(selectedMaterial.materialColor);
      }
      
      // Auto-fill actual price (you might want to add some markup)
      if (!formData.actualPrice && selectedMaterial.price) {
        setFormData(prev => ({ ...prev, actualPrice: selectedMaterial.price }));
      }
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fill in all required fields correctly.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Combine date and time
      const dateTime = formData.purchaseDate && formData.purchaseTime 
        ? `${formData.purchaseDate}T${formData.purchaseTime}:00`
        : new Date().toISOString();

      // Prepare data for API
      const saleData = {
        materialName: formData.materialName,
        supplierName: formData.supplierName,
        invoiceNo: formData.invoiceNo,
        weight: selectedWeight,
        unit: formData.unit,
        purchaseDate: dateTime,
        branch: formData.branch,
        materialColor: selectedColor,
        actualPrice: parseFloat(formData.actualPrice.replace(/,/g, '')) || 0,
        productionCost: parseFloat(formData.productionCost.replace(/,/g, '')) || 0,
        sellingPrice: parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0,
        discount: parseFloat(formData.discount.replace(/,/g, '')) || 0,
        buyerName: formData.buyerName,
        buyerAddress: formData.buyerAddress,
        buyerPhone: formData.buyerPhone,
        buyerEmail: formData.buyerEmail,
        buyerCnic: formData.buyerCnic,
        buyerCompany: formData.buyerCompany,
        finalAmount: calculateFinalAmount(),
      };

      console.log('Submitting sale data:', saleData);

      let response;
      if (isEdit && editData && editData._id) {
        // UPDATE request using PUT to /api/sales/:id
        response = await api.put(
          API_ENDPOINTS.UPDATE_SALE(editData._id),
          saleData
        );
      } else {
        // CREATE request using POST to /api/sales/add-sale
        response = await api.post(
          API_ENDPOINTS.ADD_SALE,
          saleData
        );
      }
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        onSave();
        onOpenChange(false);
        resetForm();
        alert(isEdit ? 'Sale updated successfully!' : 'Sale added successfully!');
      } else {
        throw new Error(response.data.message || 'Failed to save sale');
      }
      
    } catch (error: any) {
      console.error('Error saving sale:', error);
      
      // Detailed error handling
      if (error.response) {
        console.error('Error response:', error.response);
        console.error('Error data:', error.response.data);
        
        const errorMessage = error.response.data?.message || 'Failed to save sale';
        const errors = error.response.data?.errors;
        
        if (errors && Array.isArray(errors)) {
          alert(`Validation errors:\n${errors.join('\n')}`);
        } else if (errors && typeof errors === 'object') {
          const errorList = Object.values(errors).flat().join('\n');
          alert(`Validation errors:\n${errorList}`);
        } else {
          alert(`Error: ${errorMessage}`);
        }
      } else if (error.request) {
        console.error('Error request:', error.request);
        alert('Network error. Please check if the backend server is running on port 5000.');
      } else {
        alert('Error: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      materialName: "",
      supplierName: "",
      invoiceNo: "",
      weight: "30KG",
      unit: "2",
      purchaseDate: "",
      purchaseTime: "",
      branch: "",
      materialColor: "#FFFFFF",
      actualPrice: "",
      productionCost: "",
      sellingPrice: "",
      discount: "0",
      buyerName: "",
      buyerAddress: "",
      buyerPhone: "",
      buyerEmail: "",
      buyerCnic: "",
      buyerCompany: "",
    });
    setSelectedColor("#FFFFFF");
    setSelectedWeight("30KG");
    setErrors({});
  };

  const calculateFinalAmount = () => {
    const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
    const discount = parseFloat(formData.discount.replace(/,/g, '')) || 0;
    return (selling - discount).toFixed(2);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-background border-border max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-cms-sidebar px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Point Of Sale / {isEdit ? 'Edit Sale' : 'Add Sale'}
          </p>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-cms-input-bg rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 bg-background">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-bold text-foreground">
              {isEdit ? 'Edit Sale' : 'Add New Sale'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update the sale details' : 'Enter the details for the new sale'}
            </p>
          </DialogHeader>

          {/* Product Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Product Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
                <div className="relative">
                  <select
                    name="materialName"
                    value={formData.materialName}
                    onChange={(e) => handleMaterialSelect(e.target.value)}
                    className={`w-full bg-cms-input-bg border ${errors.materialName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Material</option>
                    {loadingMaterials ? (
                      <option disabled>Loading materials...</option>
                    ) : materials.length === 0 ? (
                      <option disabled>No materials found in purchases</option>
                    ) : (
                      materials.map((material) => (
                        <option key={material._id} value={material.materialName}>
                          {material.materialName} - {material.quality} ({material.weight} kg)
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.materialName && (
                  <p className="text-xs text-red-500 mt-1">{errors.materialName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Supplier Name *</label>
                <input
                  type="text"
                  name="supplierName"
                  placeholder="e.g Acme Inc."
                  value={formData.supplierName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.supplierName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.supplierName && (
                  <p className="text-xs text-red-500 mt-1">{errors.supplierName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Invoice No. *</label>
                <input
                  type="text"
                  name="invoiceNo"
                  placeholder="e.g INV-001"
                  value={formData.invoiceNo}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.invoiceNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.invoiceNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.invoiceNo}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Weight</label>
                <div className="flex gap-2 flex-wrap">
                  {weightOptions.map((weight) => (
                    <label key={weight} className={`flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer transition-colors ${selectedWeight === weight ? 'bg-primary/10 border-primary' : 'bg-cms-input-bg border-border'}`}>
                      <input 
                        type="radio" 
                        name="weight"
                        value={weight}
                        checked={selectedWeight === weight}
                        onChange={() => handleWeightSelect(weight)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedWeight === weight ? 'border-primary' : 'border-border'}`}>
                        {selectedWeight === weight && (
                          <div className="w-2 h-2 bg-primary rounded-sm" />
                        )}
                      </div>
                      <span className="text-sm text-foreground">{weight}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Unit</label>
                <div className="relative">
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <div className="flex flex-col gap-1.5">
                  <label className="block text-xs text-muted-foreground">Purchase Date *</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="purchaseDate"
                      value={formData.purchaseDate}
                      onChange={handleInputChange}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {errors.purchaseDate && (
                    <p className="text-xs text-red-500">{errors.purchaseDate}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="block text-xs text-muted-foreground">Purchase Time *</label>
                  <div className="relative">
                    <input
                      type="time"
                      name="purchaseTime"
                      value={formData.purchaseTime}
                      onChange={handleInputChange}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {errors.purchaseTime && (
                    <p className="text-xs text-red-500">{errors.purchaseTime}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Link to Raw Material Branch *</label>
                <div className="relative">
                  <select
                    name="branch"
                    value={formData.branch}
                    onChange={(e) => handleBranchSelect(e.target.value)}
                    className={`w-full bg-cms-input-bg border ${errors.branch ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Material/Branch</option>
                    {loadingMaterials ? (
                      <option disabled>Loading materials...</option>
                    ) : materials.length === 0 ? (
                      <option disabled>No materials found in purchases</option>
                    ) : (
                      materials.map((material) => (
                        <option key={`branch-${material._id}`} value={material.materialName}>
                          {material.materialName} - Stock: {material.weight} kg
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.branch && (
                  <p className="text-xs text-red-500 mt-1">{errors.branch}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Select a material to link this sale to raw material inventory
                </p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Material Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <label key={color.value} className={`flex items-center gap-1.5 cursor-pointer border rounded-md px-2 py-1.5 ${selectedColor === color.value ? 'border-primary bg-primary/5' : 'bg-cms-input-bg border-border'}`}>
                      <input
                        type="radio"
                        name="materialColor"
                        value={color.value}
                        checked={selectedColor === color.value}
                        onChange={() => setSelectedColor(color.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded ${color.color} ${selectedColor === color.value ? 'ring-2 ring-foreground' : ''}`} />
                      <span className="text-xs text-foreground">{color.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Price Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Price Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Actual Price *</label>
                <input
                  type="number"
                  name="actualPrice"
                  placeholder="e.g 10000"
                  value={formData.actualPrice}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`w-full bg-cms-input-bg border ${errors.actualPrice ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.actualPrice && (
                  <p className="text-xs text-red-500 mt-1">{errors.actualPrice}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Production Cost</label>
                <input
                  type="number"
                  name="productionCost"
                  placeholder="e.g 5000"
                  value={formData.productionCost}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Selling Price *</label>
                <input
                  type="number"
                  name="sellingPrice"
                  placeholder="e.g 15000"
                  value={formData.sellingPrice}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`w-full bg-cms-input-bg border ${errors.sellingPrice ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.sellingPrice && (
                  <p className="text-xs text-red-500 mt-1">{errors.sellingPrice}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Discount</label>
                <input
                  type="number"
                  name="discount"
                  placeholder="e.g 1000"
                  value={formData.discount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="bg-cms-input-bg border border-border rounded-md px-4 py-3 text-right">
              <span className="text-sm text-muted-foreground">Final Amount: </span>
              <span className="text-lg font-bold text-primary">Rs. {calculateFinalAmount()}</span>
            </div>
          </div>

          {/* Buyer Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Buyer Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Name *</label>
                <input
                  type="text"
                  name="buyerName"
                  placeholder="e.g John Smith"
                  value={formData.buyerName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.buyerName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.buyerName && (
                  <p className="text-xs text-red-500 mt-1">{errors.buyerName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Address</label>
                <input
                  type="text"
                  name="buyerAddress"
                  placeholder="e.g 123 Main St"
                  value={formData.buyerAddress}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Phone No. *</label>
                <input
                  type="tel"
                  name="buyerPhone"
                  placeholder="e.g +92 300 1234567"
                  value={formData.buyerPhone}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.buyerPhone ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.buyerPhone && (
                  <p className="text-xs text-red-500 mt-1">{errors.buyerPhone}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="buyerEmail"
                  placeholder="e.g john@example.com"
                  value={formData.buyerEmail}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.buyerEmail ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.buyerEmail && (
                  <p className="text-xs text-red-500 mt-1">{errors.buyerEmail}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">CNIC No.</label>
                <input
                  type="text"
                  name="buyerCnic"
                  placeholder="e.g 42101-1234567-8"
                  value={formData.buyerCnic}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Company/Business Name</label>
                <input
                  type="text"
                  name="buyerCompany"
                  placeholder="e.g ABC Corporation"
                  value={formData.buyerCompany}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isEdit ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? 'Update' : 'Save'}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add the missing import for Clock
import { Clock } from "lucide-react";

// Main Purchase Management Component remains the same...
export function PurchaseManagement() {
  // ... existing code remains the same
  return (
    <div className="min-h-screen bg-background p-6">
      {/* ... existing code remains the same */}
    </div>
  );
}

// App Component
export default function App() {
  return <PurchaseManagement />;
}