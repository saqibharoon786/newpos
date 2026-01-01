import { useState, useEffect, useRef } from "react";
import { Save, Upload, Calendar, Edit, Trash2, Eye, Loader2, ChevronDown, Clock, Image as ImageIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

// Create axios instance with environment variable as base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Define endpoints using environment variable
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;
const SALES_API_URL = `${API_BASE_URL}/api/sales`;

// Updated API endpoints to match your backend routes
const API_ENDPOINTS = {
  GET_ALL: PURCHASES_API_URL + "/get-all",
  GET_ONE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  UPDATE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  DELETE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  ADD_SALE: `${SALES_API_URL}/add-sale`, // Your backend uses /add-sale
  UPDATE_SALE: (id: string) => `${SALES_API_URL}/${id}`,
  GET_SALES: `${SALES_API_URL}`,
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
  receiptImage?: string;
  createdAt: string;
}

interface AddSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Sale | null;
}

// Updated color options with Black
const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
  { name: "Black", color: "bg-black", value: "#000000" },
];

// Allowed file types for receipt
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
    weight: "",
    unit: "",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Purchase[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch materials from purchases when dialog opens
  useEffect(() => {
    if (open) {
      fetchMaterials();
      
      if (isEdit && editData) {
        // Format dates for input
        const formatDateForInput = (dateString: string) => {
          if (!dateString) return "";
          try {
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          } catch (error) {
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
            return "";
          }
        };

        const purchaseDate = editData.purchaseDate ? formatDateForInput(editData.purchaseDate) : "";
        const purchaseTime = editData.purchaseDate ? formatTimeForInput(editData.purchaseDate) : "";
        
        setFormData({
          materialName: editData.materialName || "",
          supplierName: editData.supplierName || "",
          invoiceNo: editData.invoiceNo || "",
          weight: editData.weight || "",
          unit: editData.unit || "",
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
        
        // Set receipt preview if exists
        if (editData.receiptImage) {
          setReceiptPreview(`${API_BASE_URL}${editData.receiptImage}`);
        }
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
    if (!formData.weight.trim()) newErrors.weight = "Weight is required";
    if (!formData.unit.trim()) newErrors.unit = "Unit is required";
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert('Invalid file type. Please upload JPEG, PNG, GIF, or PDF files only.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('File size too large. Maximum size is 5MB.');
      return;
    }

    setReceiptFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      // For PDF files, show a PDF icon preview
      setReceiptPreview('pdf');
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleMaterialSelect = (materialName: string) => {
    setFormData(prev => ({ ...prev, materialName }));
    
    const selectedMaterial = materials.find(m => m.materialName === materialName);
    if (selectedMaterial) {
      if (!formData.supplierName && selectedMaterial.vendor) {
        setFormData(prev => ({ ...prev, supplierName: selectedMaterial.vendor }));
      }
      
      if (selectedMaterial.materialColor) {
        setSelectedColor(selectedMaterial.materialColor);
      }
      
      if (!formData.actualPrice && selectedMaterial.price) {
        setFormData(prev => ({ ...prev, actualPrice: selectedMaterial.price }));
      }
    }
  };

  const handleBranchSelect = (materialName: string) => {
    setFormData(prev => ({ 
      ...prev, 
      branch: materialName,
      materialName: materialName
    }));
    
    const selectedMaterial = materials.find(m => m.materialName === materialName);
    if (selectedMaterial) {
      if (!formData.supplierName && selectedMaterial.vendor) {
        setFormData(prev => ({ ...prev, supplierName: selectedMaterial.vendor }));
      }
      
      if (selectedMaterial.materialColor) {
        setSelectedColor(selectedMaterial.materialColor);
      }
      
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

      // Calculate final amount
      const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
      const discount = parseFloat(formData.discount.replace(/,/g, '')) || 0;
      const finalAmount = (selling - discount).toFixed(2);

      // Prepare FormData for API
      const formDataToSend = new FormData();
      
      // Add all form fields to FormData
      formDataToSend.append('materialName', formData.materialName);
      formDataToSend.append('supplierName', formData.supplierName);
      formDataToSend.append('invoiceNo', formData.invoiceNo);
      formDataToSend.append('weight', formData.weight);
      formDataToSend.append('unit', formData.unit);
      formDataToSend.append('purchaseDate', dateTime);
      formDataToSend.append('branch', formData.branch);
      formDataToSend.append('materialColor', selectedColor);
      formDataToSend.append('actualPrice', formData.actualPrice);
      formDataToSend.append('productionCost', formData.productionCost || '0');
      formDataToSend.append('sellingPrice', formData.sellingPrice);
      formDataToSend.append('discount', formData.discount);
      formDataToSend.append('buyerName', formData.buyerName);
      formDataToSend.append('buyerAddress', formData.buyerAddress || '');
      formDataToSend.append('buyerPhone', formData.buyerPhone);
      formDataToSend.append('buyerEmail', formData.buyerEmail || '');
      formDataToSend.append('buyerCnic', formData.buyerCnic || '');
      formDataToSend.append('buyerCompany', formData.buyerCompany || '');
      formDataToSend.append('finalAmount', finalAmount);

      // Add receipt file if exists
      if (receiptFile) {
        formDataToSend.append('receiptImage', receiptFile);
      }

      let response;
      if (isEdit && editData && editData._id) {
        // If editing and want to remove existing receipt
        if (!receiptFile && !receiptPreview && editData.receiptImage) {
          // Remove receipt - your backend should handle this based on removeReceipt field
          formDataToSend.append('removeReceipt', 'true');
        }
        
        // UPDATE request using PUT to /api/sales/:id
        response = await api.put(
          API_ENDPOINTS.UPDATE_SALE(editData._id),
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        // CREATE request using POST to /api/sales/add-sale
        response = await api.post(
          API_ENDPOINTS.ADD_SALE, // This should match your backend route
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }
      
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
        console.log('Response error:', error.response);
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
        console.log('Request error:', error.request);
        alert(`Network error. Please check if the backend server is running at ${API_BASE_URL}.`);
      } else {
        console.log('Error message:', error.message);
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
      weight: "",
      unit: "",
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
    setReceiptFile(null);
    setReceiptPreview(null);
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
      <DialogContent className="bg-background border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isEdit ? 'Edit Sale' : 'Add New Sale'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? 'Update the sale details' : 'Enter the details for the new sale'}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-cms-sidebar px-4 py-2 mb-4 rounded-md">
          <p className="text-xs text-muted-foreground">
            Point Of Sale / {isEdit ? 'Edit Sale' : 'Add Sale'}
          </p>
        </div>

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
              <label className="block text-xs text-muted-foreground mb-1.5">Weight *</label>
              <input
                type="text"
                name="weight"
                placeholder="e.g 30KG or 30 kg"
                value={formData.weight}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.weight ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.weight && (
                <p className="text-xs text-red-500 mt-1">{errors.weight}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Unit *</label>
              <input
                type="text"
                name="unit"
                placeholder="e.g 2"
                value={formData.unit}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.unit ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.unit && (
                <p className="text-xs text-red-500 mt-1">{errors.unit}</p>
              )}
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

        {/* Receipt Image Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Receipt Image</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-cms-input-bg hover:bg-cms-card-hover transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="mb-1 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, GIF, or PDF (MAX. 5MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {receiptPreview && receiptPreview !== 'pdf' && !receiptPreview.startsWith('data:') && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Existing Receipt</p>
                </div>
                <div className="border border-border rounded-lg p-4 bg-cms-input-bg">
                  <div className="flex flex-col items-center">
                    <img 
                      src={receiptPreview} 
                      alt="Receipt preview" 
                      className="max-w-full h-auto max-h-64 rounded-md border border-border"
                    />
                    <button
                      type="button"
                      onClick={removeReceipt}
                      className="mt-2 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Receipt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {receiptPreview && (receiptPreview === 'pdf' || receiptPreview.startsWith('data:')) && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Uploaded Receipt</p>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Remove
                  </button>
                </div>
                
                <div className="border border-border rounded-lg p-4 bg-cms-input-bg">
                  {receiptPreview === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center p-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                        <span className="text-red-600 font-bold text-xl">PDF</span>
                      </div>
                      <p className="text-sm text-foreground">
                        PDF Document - {receiptFile?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(receiptFile?.size || 0) / 1024} KB
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <img 
                        src={receiptPreview} 
                        alt="Receipt preview" 
                        className="max-w-full h-auto max-h-64 rounded-md border border-border"
                      />
                      {receiptFile && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {receiptFile.name} - {(receiptFile.size / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
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
      </DialogContent>
    </Dialog>
  );
}