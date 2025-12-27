import { 
  Pencil, Printer, Trash2, User, Phone, Mail, CreditCard, MapPin,
  Package, Hash, IndianRupee, Calendar, FileText, ChevronUp, ChevronDown,
  Clock, CheckCircle, Save, X, Loader2, Upload, Camera
} from "lucide-react";
import { useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

interface CustomerDetails {
  id: number;
  name: string;
  customerId: string;
  phone: string;
  email: string;
  cnic: string;
  city: string;
  avatar: string;
  purchaseDetails: {
    product: string;
    totalProducts: number;
    price: number;
    date: string;
    invoiceId: string;
  };
  history: {
    invoiceId: string;
    productName: string;
    qty: number;
    price: number;
    paymentStatus: "Paid" | "Pending" | "Partially Paid";
    dateTime: string;
  }[];
  installmentPlan: {
    totalLoan: number;
    downPayment: number;
    remainingPayment: number;
    duration: number;
    monthlyInstallment: number;
    paidInstallments: number;
    nextDueDate: string;
    status: "APPROVED" | "PENDING" | "REJECTED";
  } | null;
}

interface CustomerDetailViewProps {
  customer: CustomerDetails;
  onBack: () => void;
  onDelete: (id: number) => void;
  onUpdate: () => void; // Callback after successful update
}

export function CustomerDetailView({ customer, onBack, onDelete, onUpdate }: CustomerDetailViewProps) {
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    phoneNo: "",
    email: "",
    cnicNo: "",
    city: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-green-500";
      case "Pending": return "bg-yellow-500";
      case "Partially Paid": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const getApprovalColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-500";
      case "PENDING": return "bg-yellow-500";
      case "REJECTED": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const calculateProgress = () => {
    if (!customer.installmentPlan) return 0;
    return (customer.installmentPlan.paidInstallments / customer.installmentPlan.duration) * 100;
  };

  // Open edit dialog and populate form data
  const handleEditClick = () => {
    setFormData({
      customerName: customer.name || "",
      phoneNo: customer.phone || "",
      email: customer.email || "",
      cnicNo: customer.cnic || "",
      city: customer.city || "",
    });
    setAvatarPreview(customer.avatar);
    setAvatarFile(null);
    setErrors({});
    setEditDialogOpen(true);
  };

  // Handle input changes in form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  // Handle file upload for avatar
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: "File size should be less than 5MB" }));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, avatar: "Please select an image file" }));
        return;
      }
      
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      
      // Clear avatar error
      if (errors.avatar) {
        setErrors(prev => ({ ...prev, avatar: "" }));
      }
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.customerName.trim()) {
      newErrors.customerName = "Customer name is required";
    }
    
    if (!formData.phoneNo.trim()) {
      newErrors.phoneNo = "Phone number is required";
    } else if (!/^[0-9]{10,15}$/.test(formData.phoneNo)) {
      newErrors.phoneNo = "Phone number must be 10-15 digits";
    }
    
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "Please provide a valid email address";
    }
    
    if (formData.cnicNo && !/^[0-9]{5}-[0-9]{7}-[0-9]{1}$/.test(formData.cnicNo)) {
      newErrors.cnicNo = "CNIC must be in format: 12345-6789012-3";
    }
    
    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      
      // Append all form fields
      formDataToSend.append('customerName', formData.customerName);
      formDataToSend.append('phoneNo', formData.phoneNo);
      formDataToSend.append('email', formData.email || '');
      formDataToSend.append('cnicNo', formData.cnicNo || '');
      formDataToSend.append('city', formData.city);
      
      // Append avatar file if selected
      if (avatarFile) {
        formDataToSend.append('customerPhoto', avatarFile);
      }

      // Make PUT request to update customer
      const response = await api.put(
        `/api/customers/${customer.id}`,
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      if (response.data.success) {
        // Close dialog
        setEditDialogOpen(false);
        
        // Show success message
        alert('Customer updated successfully!');
        
        // Call onUpdate callback to refresh data
        onUpdate();
      } else {
        throw new Error(response.data.message || 'Failed to update customer');
      }
      
    } catch (error: any) {
      console.error('Error updating customer:', error);
      
      // Handle errors
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to update customer';
        const backendErrors = error.response.data?.errors;
        
        if (backendErrors && Array.isArray(backendErrors)) {
          alert(`Validation errors:\n${backendErrors.join('\n')}`);
        } else if (backendErrors && typeof backendErrors === 'object') {
          const errorList = Object.values(backendErrors).flat().join('\n');
          alert(`Validation errors:\n${errorList}`);
        } else {
          alert(`Error: ${errorMessage}`);
        }
      } else if (error.request) {
        alert(`Network error. Please check if the backend server is running at ${API_BASE_URL}.`);
      } else {
        alert('Error: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format CNIC for display
  const formatCnicForDisplay = (cnic: string) => {
    if (!cnic) return 'N/A';
    return cnic;
  };

  // Reset form when dialog closes
  const handleDialogClose = () => {
    setEditDialogOpen(false);
    setFormData({
      customerName: "",
      phoneNo: "",
      email: "",
      cnicNo: "",
      city: "",
    });
    setAvatarFile(null);
    setAvatarPreview(null);
    setErrors({});
  };

  return (
    <>
      {/* Main Customer Detail View */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
        {/* Breadcrumb */}
        <p className="text-xs sm:text-sm text-muted-foreground mb-4">Customers/ Detail</p>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <img 
              src={customer.avatar} 
              alt={customer.name}
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover"
            />
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">{customer.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Customer ID: {customer.customerId}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button 
              onClick={handleEditClick}
              className="px-3 sm:px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button className="px-3 sm:px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors">
              <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button 
              onClick={() => onDelete(customer.id)}
              className="px-3 sm:px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>

        {/* Personal & Purchase Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Personal Details */}
          <div className="bg-cms-card rounded-xl p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Personal Details</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Name</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Phone No.</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Email</span>
                  <span className="text-xs sm:text-sm text-foreground truncate">{customer.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">CNIC</span>
                  <span className="text-xs sm:text-sm text-foreground">{formatCnicForDisplay(customer.cnic)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">City</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="bg-cms-card rounded-xl p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Purchase Details</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Product</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.purchaseDetails.product}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Total No Of Products</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.purchaseDetails.totalProducts}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <IndianRupee className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Price</span>
                  <span className="text-xs sm:text-sm text-foreground">Rs. {customer.purchaseDetails.price.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Date</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.purchaseDetails.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-1">
                  <span className="text-xs sm:text-sm text-muted-foreground">Invoice ID</span>
                  <span className="text-xs sm:text-sm text-foreground">{customer.purchaseDetails.invoiceId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Receipt Image Placeholder */}
          <div className="bg-cms-card rounded-xl p-4 sm:p-5 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-32 sm:w-32 sm:h-40 bg-white rounded-lg mx-auto mb-3 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">RECEIPT</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Invoice Receipt</p>
            </div>
          </div>
        </div>

        {/* View History Details */}
        <div className="bg-cms-card rounded-xl p-4 sm:p-5 mb-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <h3 className="text-sm sm:text-base font-semibold text-foreground">View History Details</h3>
            {historyExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          
          {historyExpanded && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Invoice ID</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Product Name</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Qty</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Price</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Payment Status</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Date&Time</th>
                    <th className="text-left py-3 px-2 text-xs text-muted-foreground font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.history.map((item, index) => (
                    <tr key={index} className="border-b border-border/50">
                      <td className="py-3 px-2 text-xs sm:text-sm text-foreground">{item.invoiceId}</td>
                      <td className="py-3 px-2 text-xs sm:text-sm text-foreground">{item.productName}</td>
                      <td className="py-3 px-2 text-xs sm:text-sm text-foreground">{item.qty}</td>
                      <td className="py-3 px-2 text-xs sm:text-sm text-foreground">{item.price.toLocaleString()}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(item.paymentStatus)}`}>
                          {item.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-xs sm:text-sm text-foreground">{item.dateTime}</td>
                      <td className="py-3 px-2">
                        <button className="text-primary hover:text-primary/80 text-xs">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Installment Plan Details */}
        {customer.installmentPlan && (
          <div className="bg-cms-card rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-foreground">Installment Plan Details</h3>
              <span className={`px-3 py-1 rounded-full text-xs text-white ${getApprovalColor(customer.installmentPlan.status)}`}>
                {customer.installmentPlan.status}
              </span>
            </div>

            {/* Amount Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-destructive/90 rounded-lg p-4">
                <p className="text-xs text-white/80 mb-1">Total Loan</p>
                <p className="text-lg sm:text-xl font-bold text-white">Rs. {customer.installmentPlan.totalLoan.toLocaleString()}</p>
              </div>
              <div className="bg-cms-warning rounded-lg p-4">
                <p className="text-xs text-white/80 mb-1">Down Payment</p>
                <p className="text-lg sm:text-xl font-bold text-white">Rs. {customer.installmentPlan.downPayment.toLocaleString()}</p>
              </div>
              <div className="bg-cms-success rounded-lg p-4">
                <p className="text-xs text-white/80 mb-1">Remaining Payment</p>
                <p className="text-lg sm:text-xl font-bold text-white">Rs. {customer.installmentPlan.remainingPayment.toLocaleString()}</p>
              </div>
            </div>

            {/* Installment Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Installments Duration</p>
                  <p className="text-sm font-medium text-foreground">{customer.installmentPlan.duration} Months</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Installment</p>
                  <p className="text-sm font-medium text-foreground">{customer.installmentPlan.monthlyInstallment.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Paid Installments</p>
                  <p className="text-sm font-medium text-foreground">{customer.installmentPlan.paidInstallments}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Next Due Date</p>
                  <p className="text-sm font-medium text-foreground">{customer.installmentPlan.nextDueDate}</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-cms-sidebar rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-foreground font-medium">Payment Progress</p>
                <p className="text-sm text-primary font-bold">{Math.round(calculateProgress())}%</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {customer.installmentPlan.duration - customer.installmentPlan.paidInstallments} installments remaining
              </p>
              <div className="relative">
                <div className="h-2 bg-muted rounded-full">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Start</span>
                  <span className="text-xs text-muted-foreground">Completion</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={onBack}
          className="mt-6 px-4 py-2 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-lg text-sm font-medium transition-colors"
        >
          ← Back to Customers
        </button>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="bg-background border-border max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Customers / Edit Customer
            </p>
            <button
              onClick={handleDialogClose}
              className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="p-6 bg-background">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold text-foreground">
                Edit Customer
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Update the customer information below
              </p>
            </DialogHeader>

            {/* Avatar Upload Section */}
            <div className="mb-6">
              <label className="block text-xs text-muted-foreground mb-2">Customer Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={avatarPreview || customer.avatar} 
                    alt={formData.customerName || "Customer"}
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                  <label className="absolute bottom-0 right-0 p-1.5 bg-primary hover:bg-primary/90 rounded-full cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Upload a new photo (optional)</p>
                  <p className="text-xs text-muted-foreground">Max file size: 5MB. Supported formats: JPG, PNG</p>
                  {errors.avatar && (
                    <p className="text-xs text-red-500 mt-1">{errors.avatar}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Customer Name *</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="e.g John Smith"
                  className={`w-full bg-cms-input-bg border ${errors.customerName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.customerName && (
                  <p className="text-xs text-red-500 mt-1">{errors.customerName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Phone No. *</label>
                <input
                  type="text"
                  name="phoneNo"
                  value={formData.phoneNo}
                  onChange={handleInputChange}
                  placeholder="e.g 03001234567"
                  className={`w-full bg-cms-input-bg border ${errors.phoneNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.phoneNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.phoneNo}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g john@example.com"
                  className={`w-full bg-cms-input-bg border ${errors.email ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">CNIC No.</label>
                <input
                  type="text"
                  name="cnicNo"
                  value={formData.cnicNo}
                  onChange={handleInputChange}
                  placeholder="e.g 42101-1234567-8"
                  className={`w-full bg-cms-input-bg border ${errors.cnicNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.cnicNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.cnicNo}</p>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs text-muted-foreground mb-1.5">City *</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="e.g Karachi"
                className={`w-full bg-cms-input-bg border ${errors.city ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.city && (
                <p className="text-xs text-red-500 mt-1">{errors.city}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={handleDialogClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}