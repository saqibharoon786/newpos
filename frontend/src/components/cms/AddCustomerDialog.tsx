import { useState, useRef, useEffect } from "react";
import { Save, ChevronDown, Upload, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";

interface AddCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerAdded?: () => void;
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
}

// Base URL - Update this if your backend is on a different port
const API_BASE_URL = "http://localhost:5000/api/customers";

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
  onCustomerAdded 
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

  // Check backend connection when dialog opens
  useEffect(() => {
    if (open) {
      checkBackendConnection();
    }
  }, [open]);

  const checkBackendConnection = async () => {
    try {
      const response = await axios.get("http://localhost:5000/api/health");
      if (response.data.status === "OK") {
        setBackendStatus("connected");
        console.log("✅ Backend connected:", response.data);
      } else {
        setBackendStatus("disconnected");
        console.warn("⚠️ Backend health check failed");
      }
    } catch (error) {
      setBackendStatus("disconnected");
      console.error("❌ Backend connection failed:", error);
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
      if (file.size > 1024 * 1024) {
        toast.error("Photo must be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
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
    // Show backend status warning
    if (backendStatus === "disconnected") {
      toast.error("Cannot connect to server. Please make sure backend is running on port 5000.");
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare the data for backend
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

      console.log("📤 Sending data to:", `${API_BASE_URL}/create-customers`);
      console.log("📦 Request data:", JSON.stringify(requestData, null, 2));

      // Make the API call
      const response = await axios.post(
        `${API_BASE_URL}/create-customers`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );
      
      console.log("✅ Backend response:", response.data);
      
      if (response.data.success) {
        toast.success(response.data.message || "Customer added successfully!");
        
        // Reset form
        resetForm();
        
        // Close dialog
        onOpenChange(false);
        
        // Notify parent component
        if (onCustomerAdded) {
          onCustomerAdded();
        }
      } else {
        toast.error(response.data.message || "Failed to add customer");
      }
    } catch (error: any) {
      console.error("❌ Error adding customer:", error);
      
      // Detailed error handling
      if (error.code === 'ECONNREFUSED') {
        toast.error("Cannot connect to backend server. Please check if it's running on port 5000.");
      } else if (error.code === 'ERR_NETWORK') {
        toast.error("Network error. Please check your connection.");
      } else if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const errorData = error.response.data;
        
        console.error(`Server error ${status}:`, errorData);
        
        if (status === 404) {
          toast.error(
            <div>
              <p>API endpoint not found (404)</p>
              <p className="text-xs">Tried: {API_BASE_URL}/create-customers</p>
              <p className="text-xs">Please check your backend routes</p>
            </div>
          );
        } else if (status === 400) {
          toast.error(errorData.message || "Validation failed. Please check your input.");
          
          // Highlight specific validation errors
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
          toast.error(errorData.message || `Error ${status}: Failed to add customer`);
        }
      } else if (error.request) {
        // Request was made but no response
        console.error("No response received:", error.request);
        toast.error("No response from server. Backend might be down.");
      } else {
        // Something else happened
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCities = formData.province ? cities[formData.province] || [] : [];

  const handleDialogClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="bg-background border-border max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Hidden accessibility titles */}
        <DialogTitle className="sr-only">Add New Customer</DialogTitle>
        <DialogDescription className="sr-only">
          Form to add a new customer with personal information, contact details, and document upload
        </DialogDescription>
        
        {/* Backend Connection Status */}
        <div className={`px-4 py-2 text-xs font-medium ${
          backendStatus === "connected" 
            ? "bg-green-500/10 text-green-600" 
            : backendStatus === "disconnected" 
            ? "bg-red-500/10 text-red-600" 
            : "bg-yellow-500/10 text-yellow-600"
        }`}>
          {backendStatus === "connected" ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Connected to backend server
            </span>
          ) : backendStatus === "disconnected" ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Backend server not connected
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              Checking backend connection...
            </span>
          )}
        </div>

        {/* Breadcrumb Header */}
        <div className="bg-cms-sidebar px-4 sm:px-6 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Customers/ Add Customer</p>
        </div>

        <div className="p-4 sm:p-6 bg-background">
          <div className="mb-6">
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Add New Customer</h1>
            <p className="text-sm text-muted-foreground">Enter the details for Customer</p>
          </div>

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
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Plus className="w-5 h-5 text-primary" />
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upload Photo</p>
                <p className="text-xs text-muted-foreground">PNG,JPG up to 1MB</p>
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
                  placeholder="e.g Lina"
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
                  placeholder="e.g georgia.young@example.com"
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
                  placeholder="e.g 17301-98273-4"
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
                  placeholder="e.g Lahore"
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
              <p className="text-xs text-muted-foreground mt-1">SVG, PNG, JPEG (MAX 1.5MB)</p>
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg"
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Customer
                </>
              )}
            </button>
          </div>

          {/* Debug Info (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">Debug Info:</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Backend URL: <code className="bg-muted px-1 py-0.5 rounded">{API_BASE_URL}/create-customers</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Backend Status: <span className={`px-2 py-0.5 rounded text-xs ${
                    backendStatus === "connected" 
                      ? "bg-green-500/20 text-green-600" 
                      : backendStatus === "disconnected" 
                      ? "bg-red-500/20 text-red-600" 
                      : "bg-yellow-500/20 text-yellow-600"
                  }`}>
                    {backendStatus}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}