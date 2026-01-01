import { useState, useRef, useEffect } from "react";
import { Save, ChevronDown, Upload, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerAdded?: () => void;
  onCustomerUpdated?: () => void;
  customerToEdit?: CustomerFormData | null;
  isEditMode?: boolean;
}

export interface CustomerFormData {
  customerName: string;
  customerId: string;
  phoneNo: string;
  email: string;
  cnicNo: string;
  registrationDate: string;
  address: string;
  province: string;
  city: string;
  photo: string | null;
  documents: string[];
  _id?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Get base URL from environment and append /api/customers
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL ;
const API_BASE_URL = `${BACKEND_URL}/api/customers`;

const provinces = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Kashmir",
];

const cities: Record<string, string[]> = {
  "Punjab": ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala"],
  "Sindh": ["Karachi", "Hyderabad", "Sukkur", "Larkana"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Swat"],
  "Balochistan": ["Quetta", "Gwadar", "Turbat"],
  "Islamabad Capital Territory": ["Islamabad"],
  "Gilgit-Baltistan": ["Gilgit", "Skardu"],
  "Azad Kashmir": ["Muzaffarabad", "Mirpur"],
};

export function AddCustomerDialog({ 
  open, 
  onOpenChange, 
  onCustomerAdded,
  onCustomerUpdated,
  customerToEdit,
  isEditMode = false
}: AddCustomerDialogProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    customerName: "",
    customerId: "",
    phoneNo: "",
    email: "",
    cnicNo: "",
    registrationDate: new Date().toISOString().split('T')[0],
    address: "",
    province: "",
    city: "",
    photo: null,
    documents: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with edit data when in edit mode
  useEffect(() => {
    if (isEditMode && customerToEdit) {
      setFormData({
        customerName: customerToEdit.customerName || "",
        customerId: customerToEdit.customerId || "",
        phoneNo: customerToEdit.phoneNo || "",
        email: customerToEdit.email || "",
        cnicNo: customerToEdit.cnicNo || "",
        registrationDate: customerToEdit.registrationDate || new Date().toISOString().split('T')[0],
        address: customerToEdit.address || "",
        province: customerToEdit.province || "",
        city: customerToEdit.city || "",
        photo: customerToEdit.photo || null,
        documents: customerToEdit.documents || [],
      });
    } else if (!open) {
      // Reset form when dialog closes (not in edit mode)
      resetForm();
    }
  }, [customerToEdit, isEditMode, open]);

  // Check backend connection when dialog opens
  useEffect(() => {
    if (open) {
      checkBackendConnection();
    }
  }, [open]);

  const checkBackendConnection = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/health`);
      if (response.data.status === "OK") {
        setBackendStatus("connected");
      } else {
        setBackendStatus("disconnected");
      }
    } catch (error) {
      setBackendStatus("disconnected");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === "province") {
        updated.city = "";
      }
      return updated;
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Photo must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ 
          ...prev, 
          photo: reader.result as string 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.size > 1.5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 1.5MB limit`);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({
            ...prev,
            documents: [...prev.documents, reader.result as string],
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeDocument = (index: number) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index),
    }));
  };

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerId: "",
      phoneNo: "",
      email: "",
      cnicNo: "",
      registrationDate: new Date().toISOString().split('T')[0],
      address: "",
      province: "",
      city: "",
      photo: null,
      documents: [],
    });
  };

  const validateForm = (): boolean => {
    // Validate required fields
    if (!formData.customerName.trim()) {
      toast.error("Customer name is required");
      return false;
    }
    
    if (!formData.phoneNo.trim()) {
      toast.error("Phone number is required");
      return false;
    }
    
    // Phone validation (10-15 digits)
    const phoneRegex = /^[0-9]{10,15}$/;
    if (!phoneRegex.test(formData.phoneNo)) {
      toast.error("Phone number must be 10-15 digits");
      return false;
    }
    
    // Email validation if provided
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    
    // CNIC validation if provided
    if (formData.cnicNo && !/^\d{5}-\d{7}-\d{1}$/.test(formData.cnicNo)) {
      toast.error("CNIC must be in format: 12345-6789012-3");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (backendStatus === "disconnected") {
      toast.error("Cannot connect to server. Please make sure backend is running.");
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const requestData = {
        customerName: formData.customerName.trim(),
        phoneNo: formData.phoneNo.trim(),
        email: formData.email?.trim() || "",
        cnicNo: formData.cnicNo?.trim() || "",
        registrationDate: formData.registrationDate,
        address: formData.address?.trim() || "",
        province: formData.province || "",
        city: formData.city || "",
        photo: formData.photo,
        documents: formData.documents
      };

      let url = `${API_BASE_URL}/create-customers`;
      let method: 'post' | 'put' = 'post';

      if (isEditMode && customerToEdit?._id) {
        url = `${API_BASE_URL}/${customerToEdit._id}`;
        method = 'put';
      }

      console.log("📤 Sending to:", url);
      console.log("📦 Method:", method);
      console.log("📦 Data:", requestData);

      const response = await axios[method](
        url,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      console.log("✅ Backend response:", response.data);
      
      if (response.data.success) {
        toast.success(response.data.message || 
          (isEditMode ? "Customer updated successfully!" : "Customer added successfully!"));
        
        if (!isEditMode) {
          resetForm();
        }
        
        onOpenChange(false);
        
        if (isEditMode && onCustomerUpdated) {
          onCustomerUpdated();
        } else if (!isEditMode && onCustomerAdded) {
          onCustomerAdded();
        }
      } else {
        toast.error(response.data.message || "Failed to save customer");
      }
    } catch (error: any) {
      console.error("❌ Error saving customer:", error);
      
      if (error.code === 'ECONNREFUSED') {
        toast.error(`Cannot connect to backend server at ${BACKEND_URL}. Please check if it's running.`);
      } else if (error.code === 'ERR_NETWORK') {
        toast.error("Network error. Please check your connection.");
      } else if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        console.error(`Server error ${status}:`, errorData);
        
        if (status === 404) {
          toast.error(
            <div>
              <p>API endpoint not found (404)</p>
              <p className="text-xs">Tried: {error.config?.url}</p>
              <p className="text-xs">Please check your backend routes</p>
            </div>
          );
        } else if (status === 400) {
          toast.error(errorData.message || "Validation failed. Please check your input.");
          
          if (errorData.message?.includes("Phone number")) {
            toast.error("This phone number is already registered");
          } else if (errorData.message?.includes("CNIC")) {
            toast.error("This CNIC number is already registered");
          } else if (errorData.message?.includes("Email")) {
            toast.error("This email is already registered");
          }
        } else if (status === 500) {
          toast.error("Server error. Please try again later.");
        } else {
          toast.error(errorData.message || `Error ${status}: Failed to save customer`);
        }
      } else if (error.request) {
        console.error("No response received:", error.request);
        toast.error(`No response from server at ${BACKEND_URL}. Backend might be down.`);
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCities = formData.province ? cities[formData.province] || [] : [];

  const handleDialogClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      if (!isEditMode) {
        resetForm();
      }
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="bg-background border-border max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          {isEditMode ? "Edit Customer" : "Add New Customer"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditMode 
            ? "Form to edit customer information" 
            : "Form to add a new customer with personal information, contact details, and document upload"}
        </DialogDescription>

        {/* Transparent Header Section */}
        <div className="sticky top-0 z-10 backdrop-blur-sm bg-background/80 border-b border-border/50 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">
                {isEditMode ? "Edit Customer" : "Add New Customer"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode 
                  ? "Update the details for the customer" 
                  : "Enter the details for Customer"}
              </p>
            </div>
            
            {/* Backend Status Indicator (minimal) */}
            <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-full ${
              backendStatus === "connected" 
                ? "bg-green-500/10 text-green-600" 
                : backendStatus === "disconnected" 
                ? "bg-red-500/10 text-red-600" 
                : "bg-yellow-500/10 text-yellow-600"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === "connected" 
                  ? "bg-green-500" 
                  : backendStatus === "disconnected" 
                  ? "bg-red-500" 
                  : "bg-yellow-500 animate-pulse"
              }`}></span>
              <span>
                {backendStatus === "connected" 
                  ? "Connected" 
                  : backendStatus === "disconnected" 
                  ? "Disconnected" 
                  : "Connecting..."}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-background">
          {/* Photo Upload */}
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div 
                  onClick={() => !isSubmitting && photoInputRef.current?.click()}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cms-input-bg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {formData.photo ? (
                    <img 
                      src={formData.photo} 
                      alt="Customer" 
                      className="w-full h-full object-cover rounded-full" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Plus className="w-5 h-5 text-primary" />
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isSubmitting}
                />
                {formData.photo && (
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, photo: null }))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    type="button"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upload Photo</p>
                <p className="text-xs text-muted-foreground">PNG,JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Personal Information Section */}
          <div className="mb-6">
            <h3 className="text-sm sm:text-base font-semibold text-primary mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Customer Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="customerName"
                  placeholder="e.g Sarah Ali"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Customer ID</label>
                <input
                  type="text"
                  name="customerId"
                  placeholder="Auto-generated"
                  value={formData.customerId}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground bg-muted/50 cursor-not-allowed"
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">Will be generated by system</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Phone No. <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  name="phoneNo"
                  placeholder="e.g 03001234567"
                  value={formData.phoneNo}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">10-15 digits only</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="e.g sarah.ali@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">CNIC No.</label>
                <input
                  type="text"
                  name="cnicNo"
                  placeholder="e.g 12345-6789012-3"
                  value={formData.cnicNo}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground mt-1">Format: 12345-6789012-3</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Registration Date</label>
                <input
                  type="date"
                  name="registrationDate"
                  value={formData.registrationDate}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Additional Details Section */}
          <div className="mb-6">
            <h3 className="text-sm sm:text-base font-semibold text-primary mb-4">Additional Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="e.g 123 Main Street, Gulberg"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Province</label>
                <div className="relative">
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    disabled={isSubmitting}
                  >
                    <option value="">Select Province</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">City</label>
                <div className="relative">
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    disabled={!formData.province || isSubmitting}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="">Select City</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Upload Documents Section */}
          <div className="mb-6">
            <h3 className="text-sm sm:text-base font-semibold text-primary mb-4">Upload Documents</h3>
            <div
              onClick={() => !isSubmitting && docInputRef.current?.click()}
              className={`border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-primary transition-colors ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, JPEG (MAX 1.5MB)</p>
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              multiple
              onChange={handleDocUpload}
              className="hidden"
              disabled={isSubmitting}
            />
            
            {/* Document Preview */}
            {formData.documents.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  {formData.documents.length} document{formData.documents.length !== 1 ? 's' : ''} uploaded
                </p>
                <div className="flex flex-wrap gap-3">
                  {formData.documents.map((doc, index) => (
                    <div key={index} className="relative w-16 h-16 sm:w-20 sm:h-20">
                      <img 
                        src={doc} 
                        alt={`Document ${index + 1}`} 
                        className="w-full h-full object-cover rounded-lg border border-border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-size='10' fill='%23999'%3EDoc%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      <button
                        onClick={() => !isSubmitting && removeDocument(index)}
                        className={`absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={isSubmitting}
                        type="button"
                      >
                        <X className="w-3 h-3 text-destructive-foreground" />
                      </button>
                      <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                        {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={() => onOpenChange(false)}
              className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors order-2 sm:order-1 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
              type="button"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || backendStatus === "disconnected"}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  {isEditMode ? "Updating..." : "Saving..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEditMode ? "Update Customer" : "Save Customer"}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}