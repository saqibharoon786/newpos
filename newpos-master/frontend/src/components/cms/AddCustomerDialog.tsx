import { useState, useRef, useEffect } from "react";
import { Save, ChevronDown, Upload, Plus, X, Calendar, DollarSign } from "lucide-react";
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
  registrationDate: string; // Display format: DD-MM-YYYY
  address: string;
  province: string;
  city: string;
  photo: string | null;
  documents: string[];
  amount: number;
  amountPaid: number;
  paidAmount?: string; // Changed from paymentStatus to paidAmount
  _id?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Get base URL from environment and append /api/customers
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = `${BACKEND_URL}/api/customers`;

// Helper function to format date as DD-MM-YYYY for display
const formatDateToDDMMYYYY = (date: Date | string): string => {
  if (!date) return "";
  
  let d: Date;
  
  if (typeof date === 'string') {
    // Check if it's already in DD-MM-YYYY format
    const parts = date.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        return date; // Already in correct format
      }
      // Check if it's in YYYY-MM-DD format
      if (parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    // Try parsing as Date
    d = new Date(date);
    if (isNaN(d.getTime())) {
      return "";
    }
  } else {
    d = date;
  }
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to convert DD-MM-YYYY to Date object
const parseDDMMYYYYToDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  
  const [day, month, year] = dateStr.split('-').map(Number);
  
  // Validate the date
  if (!day || !month || !year) return null;
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;
  
  const date = new Date(year, month - 1, day);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return null;
  }
  
  // Check if the parsed date matches the input (handles invalid dates like 31-02-2023)
  if (date.getDate() !== day || date.getMonth() + 1 !== month || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
};

// Helper function to format date for backend (ISO string)
const formatDateForBackend = (dateStr: string): string => {
  const date = parseDDMMYYYYToDate(dateStr);
  if (!date) return new Date().toISOString();
  return date.toISOString();
};

// Generate years array (from 1900 to current year + 10)
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 1900; year <= currentYear + 10; year++) {
    years.push(year);
  }
  return years.reverse(); // Show most recent years first
};

// Format currency for display
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
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
    registrationDate: formatDateToDDMMYYYY(new Date()), // Default to today in DD-MM-YYYY format
    address: "",
    province: "",
    city: "",
    photo: null,
    documents: [],
    amount: 0,
    amountPaid: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const years = generateYears();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Calculate pending amount and payment status based on backend model logic
  const pendingAmount = Math.max(0, formData.amount - formData.amountPaid);
  
  // This matches your backend model's pre-save middleware logic
  const calculatePaidAmountStatus = (): string => {
    if (formData.amount === 0) {
      return 'none';
    } else if (formData.amountPaid === 0) {
      return 'none';
    } else if (formData.amountPaid >= formData.amount) {
      return 'fully';
    } else if (formData.amountPaid > 0) {
      return 'partial';
    } else {
      return 'none';
    }
  };

  const paidAmountStatus = calculatePaidAmountStatus();

  // Initialize form with edit data when in edit mode
  useEffect(() => {
    if (isEditMode && customerToEdit) {
      setFormData({
        customerName: customerToEdit.customerName || "",
        customerId: customerToEdit.customerId || "",
        phoneNo: customerToEdit.phoneNo || "",
        email: customerToEdit.email || "",
        cnicNo: customerToEdit.cnicNo || "",
        registrationDate: formatDateToDDMMYYYY(customerToEdit.registrationDate),
        address: customerToEdit.address || "",
        province: customerToEdit.province || "",
        city: customerToEdit.city || "",
        photo: customerToEdit.photo || null,
        documents: customerToEdit.documents || [],
        amount: customerToEdit.amount || 0,
        amountPaid: customerToEdit.amountPaid || 0,
        paidAmount: customerToEdit.paidAmount || 'none',
      });
      
      // Set selected date for calendar picker
      const parsedDate = parseDDMMYYYYToDate(formatDateToDDMMYYYY(customerToEdit.registrationDate));
      if (parsedDate) {
        setSelectedDate(parsedDate);
        setSelectedYear(parsedDate.getFullYear());
      }
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
    
    // Handle numeric inputs
    if (name === 'amount' || name === 'amountPaid') {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({ 
        ...prev, 
        [name]: numValue 
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // If registrationDate changes, update selectedDate for calendar
    if (name === "registrationDate") {
      const parsedDate = parseDDMMYYYYToDate(value);
      if (parsedDate) {
        setSelectedDate(parsedDate);
        setSelectedYear(parsedDate.getFullYear());
      }
    }
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = formatDateToDDMMYYYY(date);
    setFormData(prev => ({ ...prev, registrationDate: formattedDate }));
    setSelectedDate(date);
    setSelectedYear(date.getFullYear());
    setShowDatePicker(false);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const newDate = new Date(selectedDate);
    newDate.setFullYear(year);
    setSelectedDate(newDate);
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + increment);
    setSelectedDate(newDate);
    setSelectedYear(newDate.getFullYear());
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
      registrationDate: formatDateToDDMMYYYY(new Date()),
      address: "",
      province: "",
      city: "",
      photo: null,
      documents: [],
      amount: 0,
      amountPaid: 0,
    });
    setSelectedDate(new Date());
    setSelectedYear(new Date().getFullYear());
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
    
    // Date validation (DD-MM-YYYY format)
    if (formData.registrationDate) {
      const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
      if (!dateRegex.test(formData.registrationDate)) {
        toast.error("Registration date must be in DD-MM-YYYY format (e.g., 25-12-2023)");
        return false;
      }
      
      // Validate the actual date
      const parsedDate = parseDDMMYYYYToDate(formData.registrationDate);
      if (!parsedDate) {
        toast.error("Invalid registration date. Please enter a valid date in DD-MM-YYYY format");
        return false;
      }
    }
    
    // Validate amount fields
    if (formData.amount < 0) {
      toast.error("Total amount cannot be negative");
      return false;
    }
    
    if (formData.amountPaid < 0) {
      toast.error("Paid amount cannot be negative");
      return false;
    }
    
    if (formData.amountPaid > formData.amount) {
      toast.error("Paid amount cannot exceed total amount");
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
      // Convert DD-MM-YYYY to ISO string for backend
      const registrationDateForBackend = formatDateForBackend(formData.registrationDate);

      // IMPORTANT: Backend expects amount and amountPaid (number)
      // The paidAmount status will be calculated automatically by backend pre-save middleware
      const requestData = {
        customerName: formData.customerName.trim(),
        phoneNo: formData.phoneNo.trim(),
        ...(formData.email?.trim() ? { email: formData.email.trim() } : {}),
        ...(formData.cnicNo?.trim() ? { cnicNo: formData.cnicNo.trim() } : {}),
        registrationDate: registrationDateForBackend, // Send as ISO string
        address: formData.address?.trim() || "",
        province: formData.province || "",
        city: formData.city || "",
        photo: formData.photo,
        documents: formData.documents,
        amount: formData.amount,
        amountPaid: formData.amountPaid // Send amountPaid, NOT paidAmount
        // DO NOT send paidAmount - backend calculates it automatically
      };

      console.log("📤 Frontend sending request data:", requestData);

      let url = `${API_BASE_URL}/create-customers`;
      let method: 'post' | 'put' = 'post';

      if (isEditMode && customerToEdit?._id) {
        url = `${API_BASE_URL}/${customerToEdit._id}`;
        method = 'put';
      }

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
      
      if (error.response) {
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
          // Handle validation errors
          console.error("Validation errors:", errorData.errors || errorData);
          
          if (errorData.errors) {
            // Handle Mongoose validation errors
            const errors = errorData.errors;
            Object.keys(errors).forEach(key => {
              const err = errors[key];
              toast.error(`${key}: ${err.message || err}`);
            });
          } else if (errorData.message) {
            toast.error(errorData.message);
            
            // Check for specific error messages
            if (errorData.message.includes("Phone number")) {
              toast.error("This phone number is already registered");
            } else if (errorData.message.includes("CNIC")) {
              toast.error("This CNIC number is already registered");
            } else if (errorData.message.includes("Email")) {
              toast.error("This email is already registered");
            } else if (errorData.message.includes("amount")) {
              toast.error(errorData.message);
            }
          } else {
            toast.error("Validation failed. Please check your input.");
          }
        } else if (status === 500) {
          toast.error("Server error. Please try again later.");
        } else {
          toast.error(errorData.message || `Error ${status}: Failed to save customer`);
        }
      } else if (error.request) {
        console.error("No response received:", error.request);
        toast.error(`No response from server at ${BACKEND_URL}. Backend might be down.`);
      } else if (error.code === 'ECONNREFUSED') {
        toast.error(`Cannot connect to backend server at ${BACKEND_URL}. Please check if it's running.`);
      } else if (error.code === 'ERR_NETWORK') {
        toast.error("Network error. Please check your connection.");
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isSubmitting) {
      if (!isEditMode) {
        resetForm();
      }
    }
    onOpenChange(open);
  };

  // Generate days in month for custom date picker
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper to update amountPaid when amount changes to keep them in sync
  useEffect(() => {
    // If amountPaid is greater than new amount, adjust it
    if (formData.amountPaid > formData.amount) {
      setFormData(prev => ({
        ...prev,
        amountPaid: formData.amount
      }));
    }
  }, [formData.amount, formData.amountPaid]);

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="bg-background border-border max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Close Button - Red X icon in top right corner */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
          type="button"
        >
          <X className="w-4 h-4 text-white" />
        </button>

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
                  className="w-full bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground cursor-not-allowed"
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
              <div className="relative">
                <label className="block text-xs text-muted-foreground mb-1.5">Registration Date</label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="text"
                    name="registrationDate"
                    placeholder="DD-MM-YYYY"
                    value={formData.registrationDate}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Format: DD-MM-YYYY (e.g., 25-12-2023)</p>
                
                {/* Custom Date Picker */}
                {showDatePicker && (
                  <div className="absolute z-50 mt-1 bg-background border border-border rounded-lg shadow-lg p-4 w-72">
                    <div className="flex justify-between items-center mb-3">
                      <button
                        type="button"
                        onClick={() => handleMonthChange(-1)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </button>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={selectedYear}
                            onChange={(e) => handleYearChange(Number(e.target.value))}
                            className="bg-background border border-border rounded px-2 py-1 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary pr-6"
                          >
                            {years.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        </div>
                        <div className="font-medium">
                          {months[selectedDate.getMonth()]}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMonthChange(1)}
                        className="p-1 hover:bg-muted rounded"
                      >
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {daysOfWeek.map(day => (
                        <div key={day} className="text-center text-xs text-muted-foreground py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: new Date(selectedYear, selectedDate.getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-8"></div>
                      ))}
                      
                      {Array.from({ length: getDaysInMonth(selectedYear, selectedDate.getMonth()) }).map((_, i) => {
                        const day = i + 1;
                        const currentDate = new Date(selectedYear, selectedDate.getMonth(), day);
                        const isSelected = 
                          currentDate.getDate() === selectedDate.getDate() &&
                          currentDate.getMonth() === selectedDate.getMonth() &&
                          currentDate.getFullYear() === selectedYear;
                        
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleDateSelect(currentDate)}
                            className={`h-8 rounded text-sm hover:bg-primary/10 ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:text-foreground'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className="flex justify-between mt-3 pt-3 border-t">
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          handleDateSelect(today);
                        }}
                        className="text-xs px-3 py-1 bg-muted hover:bg-border rounded"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDatePicker(false)}
                        className="text-xs px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Financial Information Section */}
          <div className="mb-6">
            <h3 className="text-sm sm:text-base font-semibold text-primary mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Financial Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Total Amount (PKR)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="amount"
                    placeholder="0"
                    value={formData.amount || ""}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    PKR
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Total amount for customer</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Amount/Payment Received (PKR)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="amountPaid"
                    placeholder="0"
                    value={formData.amountPaid || ""}
                    onChange={handleInputChange}
                    min="0"
                    max={formData.amount}
                    step="1"
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                    disabled={isSubmitting}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    PKR
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Amount already received</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment Status</label>
                <div className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      paidAmountStatus === 'fully' ? 'bg-green-100 text-green-800' :
                      paidAmountStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {paidAmountStatus === 'fully' ? 'Fully Paid' :
                       paidAmountStatus === 'partial' ? 'Partially Paid' :
                       'Not Paid'}
                    </span>
                    <span className="text-sm font-medium">
                      {formatCurrency(pendingAmount)} pending
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {paidAmountStatus === 'fully' ? 'All payments received' :
                     paidAmountStatus === 'partial' ? 'Partial payment received' :
                     'No payment received yet'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Quick Payment Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, amountPaid: 0 }))}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md"
              >
                Mark as Not Paid
              </button>
              <button
                type="button"
                onClick={() => {
                  const partialAmount = Math.floor(formData.amount / 2);
                  setFormData(prev => ({ ...prev, amountPaid: partialAmount }));
                }}
                className="px-3 py-1.5 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md"
              >
                Mark 50% Paid
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, amountPaid: formData.amount }))}
                className="px-3 py-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded-md"
              >
                Mark Fully Paid
              </button>
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
                <input
                  type="text"
                  name="province"
                  placeholder="e.g Punjab, Sindh, etc."
                  value={formData.province}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">City</label>
                <input
                  type="text"
                  name="city"
                  placeholder="e.g Lahore, Karachi, etc."
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isSubmitting}
                />
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
                        className={`absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors ${
                          isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={isSubmitting}
                        type="button"
                      >
                        <X className="w-3 h-3 text-white" />
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