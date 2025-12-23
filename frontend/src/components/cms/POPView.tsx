import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Save, Upload, Calendar, X } from "lucide-react";
import { PurchaseDetailsView } from "./PurchaseDetailsView";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// API endpoints
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;

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
  updatedAt: string;
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
];

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Purchase | null;
}

function PurchaseDialog({ open, onOpenChange, onSave, isEdit = false, editData = null }: DialogProps) {
  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    materialName: "",
    vendor: "",
    price: "",
    weight: "",
    quality: "PP750", // Default to PP750
    purchaseDate: getTodayDate(), // Default to today's date
    materialColor: "#FFFFFF",
    vehicleName: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    vehicleColor: "",
    deliveryDate: "",
    receiptNo: "",
    vehicleImage: null as File | null,
  });

  const [selectedMaterialColor, setSelectedMaterialColor] = useState("#FFFFFF");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Helper function to construct image URL
  const getImageUrl = (imagePath: string | undefined): string | null => {
    if (!imagePath) return null;
    
    // If it's already a full URL
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Remove leading slash if present for consistency
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    
    // If it starts with uploads
    if (cleanPath.startsWith('uploads/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    
    // If it's just a filename without path
    if (!cleanPath.includes('/')) {
      return `${API_BASE_URL}/uploads/${cleanPath}`;
    }
    
    // Default case - assume it's relative to API base URL
    return `${API_BASE_URL}/${cleanPath}`;
  };

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (isEdit && editData) {
        // Format dates to YYYY-MM-DD for date inputs
        const formatDateForInput = (dateString: string) => {
          if (!dateString) return "";
          try {
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          } catch (error) {
            return "";
          }
        };

        const purchaseDate = formatDateForInput(editData.purchaseDate);
        const deliveryDate = formatDateForInput(editData.deliveryDate);
        
        setFormData({
          materialName: editData.materialName || "",
          vendor: editData.vendor || "",
          price: editData.price || "",
          weight: editData.weight || "",
          quality: editData.quality || "PP750",
          purchaseDate: purchaseDate || getTodayDate(),
          materialColor: editData.materialColor || "#FFFFFF",
          vehicleName: editData.vehicleName || "",
          vehicleType: editData.vehicleType || "",
          vehicleNumber: editData.vehicleNumber || "",
          driverName: editData.driverName || "",
          vehicleColor: editData.vehicleColor || "",
          deliveryDate: deliveryDate || "",
          receiptNo: editData.receiptNo || "",
          vehicleImage: null,
        });
        
        setSelectedMaterialColor(editData.materialColor || "#FFFFFF");
        
        if (editData.vehicleImage) {
          const imageUrl = getImageUrl(editData.vehicleImage);
          setImagePreview(imageUrl);
          setOriginalImageUrl(imageUrl);
        } else {
          setImagePreview(null);
          setOriginalImageUrl(null);
        }
      } else {
        resetForm();
      }
    }
  }, [open, isEdit, editData]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.vendor.trim()) newErrors.vendor = "Vendor is required";
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = "Valid price is required";
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = "Valid weight is required";
    if (!formData.quality) newErrors.quality = "Quality is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required";
    if (!formData.vehicleName.trim()) newErrors.vehicleName = "Vehicle name is required";
    if (!formData.vehicleType.trim()) newErrors.vehicleType = "Vehicle type is required";
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = "Vehicle number is required";
    if (!formData.driverName.trim()) newErrors.driverName = "Driver name is required";
    if (!formData.vehicleColor.trim()) newErrors.vehicleColor = "Vehicle color is required";
    if (!formData.deliveryDate) newErrors.deliveryDate = "Delivery date is required";
    if (!formData.receiptNo.trim()) newErrors.receiptNo = "Receipt number is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleQualityChange = (quality: string) => {
    setFormData(prev => ({ ...prev, quality }));
    if (errors.quality) {
      setErrors(prev => ({ ...prev, quality: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size should be less than 5MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file");
        return;
      }
      
      setFormData(prev => ({ ...prev, vehicleImage: file }));
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      
      const fields = {
        materialName: formData.materialName,
        vendor: formData.vendor,
        price: formData.price,
        weight: formData.weight,
        quality: formData.quality,
        purchaseDate: formData.purchaseDate,
        materialColor: selectedMaterialColor,
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: formData.vehicleColor,
        deliveryDate: formData.deliveryDate,
        receiptNo: formData.receiptNo,
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formDataToSend.append(key, String(value));
        }
      });

      if (formData.vehicleImage) {
        formDataToSend.append('vehicleImage', formData.vehicleImage);
      }

      let response;
      if (isEdit && editData && editData._id) {
        // UPDATE request using PUT
        response = await api.put(
          `${PURCHASES_API_URL}/${editData._id}`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        // CREATE request using POST
        response = await api.post(
          `${PURCHASES_API_URL}/add`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: isEdit ? "Purchase updated successfully!" : "Purchase added successfully!",
        });
        onSave();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(response.data.message || 'Failed to save purchase');
      }
      
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to save purchase';
        const errors = error.response.data?.errors;
        
        if (errors && Array.isArray(errors)) {
          toast({
            title: "Error",
            description: `Validation errors:\n${errors.join('\n')}`,
            variant: "destructive",
          });
        } else if (errors && typeof errors === 'object') {
          const errorList = Object.values(errors).flat().join('\n');
          toast({
            title: "Error",
            description: `Validation errors:\n${errorList}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else if (error.request) {
        toast({
          title: "Error",
          description: `Network error. Please check if the backend server is running at ${API_BASE_URL}.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      materialName: "",
      vendor: "",
      price: "",
      weight: "",
      quality: "PP750",
      purchaseDate: getTodayDate(),
      materialColor: "#FFFFFF",
      vehicleName: "",
      vehicleType: "",
      vehicleNumber: "",
      driverName: "",
      vehicleColor: "",
      deliveryDate: "",
      receiptNo: "",
      vehicleImage: null,
    });
    setSelectedMaterialColor("#FFFFFF");
    setImagePreview(null);
    setOriginalImageUrl(null);
    setErrors({});
    
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Point Of Purchase / {isEdit ? 'Edit Purchase' : 'Add Purchase'}
          </p>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {isEdit ? 'Edit Purchase' : 'Add New Purchase'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update the purchase details' : 'Enter the details for the new asset purchase and delivery'}
            </p>
          </div>

          {/* Product Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Product Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
                <input
                  type="text"
                  name="materialName"
                  placeholder="e.g Steel Beams"
                  value={formData.materialName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.materialName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.materialName && (
                  <p className="text-xs text-red-500 mt-1">{errors.materialName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vendor *</label>
                <input
                  type="text"
                  name="vendor"
                  placeholder="e.g Acme Inc."
                  value={formData.vendor}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vendor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vendor && (
                  <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Price (Rupees) *</label>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  placeholder="e.g 10000"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.price ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Weight (kg) *</label>
                <input
                  type="number"
                  name="weight"
                  min="0"
                  step="0.1"
                  placeholder="e.g 500"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.weight ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.weight && (
                  <p className="text-xs text-red-500 mt-1">{errors.weight}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Quality *</label>
                <div className="flex items-center gap-4 pt-2">
                  {/* Only PP750 and PP1000 options */}
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="quality"
                      value="PP750"
                      checked={formData.quality === "PP750"}
                      onChange={() => handleQualityChange("PP750")}
                      className="sr-only"
                    />
                    <div className="w-4 h-4 border border-border bg-cms-card rounded flex items-center justify-center">
                      {formData.quality === "PP750" && (
                        <div className="w-2 h-2 bg-primary rounded-sm" />
                      )}
                    </div>
                    PP750
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="radio"
                      name="quality"
                      value="PP1000"
                      checked={formData.quality === "PP1000"}
                      onChange={() => handleQualityChange("PP1000")}
                      className="sr-only"
                    />
                    <div className="w-4 h-4 border border-border bg-cms-card rounded flex items-center justify-center">
                      {formData.quality === "PP1000" && (
                        <div className="w-2 h-2 bg-primary rounded-sm" />
                      )}
                    </div>
                    PP1000
                  </label>
                </div>
                {errors.quality && (
                  <p className="text-xs text-red-500 mt-1">{errors.quality}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Date *</label>
                <div className="relative">
                  <input
                    type="date"
                    name="purchaseDate"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                    className={`w-full bg-cms-card border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.purchaseDate && (
                  <p className="text-xs text-red-500 mt-1">{errors.purchaseDate}</p>
                )}
              </div>
            </div>

            {/* Material Color */}
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-2">Material Color *</label>
              <div className="flex items-center gap-3">
                {colorOptions.map((color) => (
                  <label key={color.value} className="flex items-center gap-1.5 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="radio"
                        name="materialColor"
                        value={color.value}
                        checked={selectedMaterialColor === color.value}
                        onChange={() => setSelectedMaterialColor(color.value)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full ${color.color} border-2 ${selectedMaterialColor === color.value ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' : 'border-border'}`} />
                    </div>
                    <span className="text-xs text-foreground">{color.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Delivery Vehicle Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Delivery Vehicle Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Name *</label>
                <input
                  type="text"
                  name="vehicleName"
                  placeholder="e.g Heavy Truck"
                  value={formData.vehicleName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleName && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Type *</label>
                <input
                  type="text"
                  name="vehicleType"
                  placeholder="e.g Truck"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleType ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleType && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleType}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Number *</label>
                <input
                  type="text"
                  name="vehicleNumber"
                  placeholder="e.g MS-12_Ab"
                  value={formData.vehicleNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleNumber ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleNumber && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Driver Name *</label>
                <input
                  type="text"
                  name="driverName"
                  placeholder="e.g Smith"
                  value={formData.driverName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.driverName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.driverName && (
                  <p className="text-xs text-red-500 mt-1">{errors.driverName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Color *</label>
                <input
                  type="text"
                  name="vehicleColor"
                  placeholder="e.g Black, Pink, Metallic Red, Dark Blue, etc."
                  value={formData.vehicleColor}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleColor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleColor && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleColor}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Delivery Date *</label>
                <div className="relative">
                  <input
                    type="date"
                    name="deliveryDate"
                    value={formData.deliveryDate}
                    onChange={handleInputChange}
                    className={`w-full bg-cms-card border ${errors.deliveryDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                {errors.deliveryDate && (
                  <p className="text-xs text-red-500 mt-1">{errors.deliveryDate}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Receipt No. *</label>
                <input
                  type="text"
                  name="receiptNo"
                  placeholder="e.g AB1232"
                  value={formData.receiptNo}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.receiptNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.receiptNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.receiptNo}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Image</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-cms-card border border-border rounded-md cursor-pointer hover:bg-cms-card-hover transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm text-foreground">Choose File...</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <div className="relative w-16 h-16 border border-border rounded-md overflow-hidden">
                      <img 
                        src={imagePreview} 
                        alt="Vehicle preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {isEdit && !formData.vehicleImage && originalImageUrl && (
                    <div className="text-xs text-muted-foreground">
                      Current image will be kept
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.vehicleImage ? formData.vehicleImage.name : 'No new file chosen'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <Loader2 className="w-4 h-4 animate-spin" />
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
      </div>
    </div>
  );
}

export function POPView() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<Purchase | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch purchases on component mount
  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`${PURCHASES_API_URL}/get-all`);
      
      if (response.data.success) {
        setPurchases(response.data.data || []);
      } else {
        throw new Error(response.data.message || 'Failed to fetch purchases');
      }
    } catch (error: any) {
      console.error('Error fetching purchases:', error);
      setError(error.response?.data?.message || error.message || 'Failed to fetch purchases');
      toast({
        title: "Error",
        description: "Failed to load purchases. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchase = async () => {
    await fetchPurchases();
  };

  const handleEditPurchase = (purchase: Purchase) => {
    setSelectedPurchaseForEdit(purchase);
    setIsEditMode(true);
    setDialogOpen(true);
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase?')) {
      try {
        await api.delete(`${PURCHASES_API_URL}/${id}`);
        await fetchPurchases();
        toast({
          title: "Success",
          description: "Purchase deleted successfully!",
        });
      } catch (error: any) {
        console.error('Error deleting purchase:', error);
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to delete purchase",
          variant: "destructive",
        });
      }
    }
  };

  const handleViewDetails = (purchase: Purchase) => {
    setSelectedPurchaseId(purchase._id);
    setShowDetails(true);
  };

  const handleAddNew = () => {
    setSelectedPurchaseForEdit(null);
    setIsEditMode(false);
    setDialogOpen(true);
  };

  // Filter purchases based on search term
  const filteredPurchases = purchases.filter(purchase =>
    purchase.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.receiptNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Format currency
  const formatCurrency = (amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return '₹0';
      return `₹${numAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })}`;
    } catch (error) {
      return `₹${amount}`;
    }
  };

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredPurchases.slice(startIndex, endIndex);

  // If showing details, render PurchaseDetailsView
  if (showDetails && selectedPurchaseId) {
    return (
      <PurchaseDetailsView 
        purchaseId={selectedPurchaseId} 
        onBack={() => {
          setShowDetails(false);
          setSelectedPurchaseId(null);
        }} 
      />
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="w-8 h-6 border-2 border-primary rounded-sm flex items-center justify-center">
          <div className="w-4 h-0.5 bg-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Point Of Purchase (POP)</h1>
      </div>

      {/* Stats Cards - MOVED TO TOP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Purchases</p>
              <p className="text-2xl font-semibold text-foreground">{purchases.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Weight</p>
              <p className="text-2xl font-semibold text-foreground">
                {purchases.reduce((total, p) => total + (parseFloat(p.weight) || 0), 0).toLocaleString()} kg
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <div className="text-blue-500 text-lg font-bold">Σ</div>
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-semibold text-foreground">
                ₹{purchases.reduce((total, p) => total + (parseFloat(p.price) || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <span className="text-green-500 text-lg font-bold">₹</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddNew}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-cms-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading purchases...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No purchases found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No purchases match your search.' : 'Add your first purchase to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add First Purchase
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-cms-table-header">
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Weight (Kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vehicle No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date & Time</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((purchase, index) => (
                  <tr
                    key={purchase._id}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'} hover:bg-cms-card-hover transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: purchase.materialColor || '#FFFFFF' }}
                        />
                        <span className="text-sm text-foreground">{purchase.materialName || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{purchase.weight || 'N/A'} kg</td>
                    <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(purchase.price)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{purchase.vendor || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{purchase.vehicleNumber || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-primary">{formatDate(purchase.purchaseDate || purchase.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditPurchase(purchase)}
                          className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleViewDetails(purchase)}
                          className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePurchase(purchase._id)}
                          className="p-1.5 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-secondary text-muted-foreground'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="text-muted-foreground px-2">...</span>
                )}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary text-muted-foreground'
                    }`}
                  >
                    {totalPages}
                  </button>
                )}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Purchase Dialog (for both Add and Edit) */}
      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddPurchase}
        isEdit={isEditMode}
        editData={selectedPurchaseForEdit}
      />
    </div>
  );
}