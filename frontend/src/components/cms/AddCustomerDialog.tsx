import { useState, useRef, useEffect } from "react";
import { Save, ChevronDown, Upload, Plus, X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
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
  Punjab: ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala"],
  Sindh: ["Karachi", "Hyderabad", "Sukkur", "Larkana"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Swat"],
  Balochistan: ["Quetta", "Gwadar", "Turbat"],
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
  isEditMode = false,
}: AddCustomerDialogProps) {
  const [formData, setFormData] = useState<CustomerFormData>({
    customerName: "",
    customerId: "",
    phoneNo: "",
    email: "",
    cnicNo: "",
    registrationDate: "",
    address: "",
    province: "",
    city: "",
    photo: null,
    documents: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  // Calendar states
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Click outside calendar band karne ke liye
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dialog open hone par form + calendar set karo
  useEffect(() => {
    if (open) {
      const now = new Date();
      
      if (isEditMode && customerToEdit) {
        setFormData({
          customerName: customerToEdit.customerName || "",
          customerId: customerToEdit.customerId || "",
          phoneNo: customerToEdit.phoneNo || "",
          email: customerToEdit.email || "",
          cnicNo: customerToEdit.cnicNo || "",
          registrationDate: customerToEdit.registrationDate || "",
          address: customerToEdit.address || "",
          province: customerToEdit.province || "",
          city: customerToEdit.city || "",
          photo: customerToEdit.photo || null,
          documents: customerToEdit.documents || [],
        });

        // Edit mode mein date parse karo (DD/MM/YYYY)
        if (customerToEdit.registrationDate) {
          try {
            const parts = customerToEdit.registrationDate.split('/');
            if (parts.length === 3) {
              const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
              // IMPORTANT: Server locale issues se bachne ke liye safe method use karo
              const parsed = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
              if (!isNaN(parsed.getTime())) {
                setSelectedDate(parsed);
                setCurrentMonth(parsed.getUTCMonth());
                setCurrentYear(parsed.getUTCFullYear());
              } else {
                // Agar parse na ho sake to aaj ki date set karo
                setDefaultDate(now);
              }
            } else {
              setDefaultDate(now);
            }
          } catch (error) {
            console.error("Date parsing error:", error);
            setDefaultDate(now);
          }
        } else {
          setDefaultDate(now);
        }
      } else {
        // New customer – aaj ki date auto set
        setDefaultDate(now);
      }

      checkBackendConnection();
    }
  }, [open, isEditMode, customerToEdit]);

  // Helper function to set default date
  const setDefaultDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    setFormData(prev => ({
      ...prev,
      registrationDate: dateStr,
    }));

    setSelectedDate(date);
    setCurrentMonth(date.getMonth());
    setCurrentYear(date.getFullYear());
  };

  // Selected date change hone par formData update
  useEffect(() => {
    if (selectedDate) {
      // Server locale issues se bachne ke liye UTC methods use karo
      const dd = String(selectedDate.getUTCDate()).padStart(2, '0');
      const mm = String(selectedDate.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = selectedDate.getUTCFullYear();
      setFormData(prev => ({ ...prev, registrationDate: `${dd}/${mm}/${yyyy}` }));
    }
  }, [selectedDate]);

  const checkBackendConnection = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/health`);
      setBackendStatus(res.data.status === "OK" ? "connected" : "disconnected");
    } catch {
      setBackendStatus("disconnected");
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => {
    // UTC-based calculation to avoid locale issues
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  };

  const getFirstDayOfMonth = (y: number, m: number) => {
    // UTC-based calculation
    return new Date(Date.UTC(y, m, 1)).getUTCDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleDateSelect = (day: number) => {
    // UTC date create karo to avoid locale issues
    const date = new Date(Date.UTC(currentYear, currentMonth, day, 0, 0, 0, 0));
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const handleToday = () => {
    const today = new Date();
    const utcToday = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0, 0, 0, 0
    ));
    setSelectedDate(utcToday);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowCalendar(false);
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
    const now = new Date();
    setDefaultDate(now);
    
    setFormData({
      customerName: "",
      customerId: "",
      phoneNo: "",
      email: "",
      cnicNo: "",
      registrationDate: formData.registrationDate, // Keep the current date format
      address: "",
      province: "",
      city: "",
      photo: null,
      documents: [],
    });
  };

  const validateForm = (): boolean => {
    if (!formData.customerName.trim()) {
      toast.error("Customer name is required");
      return false;
    }
    if (!formData.phoneNo.trim()) {
      toast.error("Phone number is required");
      return false;
    }
    if (!/^[0-9]{10,15}$/.test(formData.phoneNo)) {
      toast.error("Phone number must be 10-15 digits");
      return false;
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Invalid email address");
      return false;
    }
    if (formData.cnicNo && !/^\d{5}-\d{7}-\d{1}$/.test(formData.cnicNo)) {
      toast.error("CNIC format: 12345-6789012-3");
      return false;
    }
    if (!formData.registrationDate.trim()) {
      toast.error("Registration date is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (backendStatus === "disconnected") {
      toast.error("Cannot connect to server. Backend may be down.");
      return;
    }

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const requestData = {
        customerName: formData.customerName.trim(),
        phoneNo: formData.phoneNo.trim(),
        email: formData.email?.trim() || null,
        cnicNo: formData.cnicNo?.trim() || null,
        registrationDate: formData.registrationDate,
        address: formData.address?.trim() || null,
        province: formData.province || null,
        city: formData.city || null,
      };

      let url = `${API_BASE_URL}/create-customers`;
      let method: "post" | "put" = "post";

      if (isEditMode && customerToEdit?._id) {
        url = `${API_BASE_URL}/${customerToEdit._id}`;
        method = "put";
      }

      const response = await axios[method](url, requestData, {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      });

      if (response.data?.success) {
        toast.success(isEditMode ? "Customer updated successfully" : "Customer added successfully");
        if (!isEditMode) resetForm();
        onOpenChange(false);
        isEditMode ? onCustomerUpdated?.() : onCustomerAdded?.();
      } else {
        toast.error(response.data?.message || "Operation failed");
      }
    } catch (error: any) {
      console.error("Submit error:", error);
      if (error.response) {
        toast.error(error.response.data?.message || `Error ${error.response.status}`);
      } else {
        toast.error("Network error or server not responding");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCities = formData.province ? cities[formData.province] || [] : [];

  // Calendar days generate karne ke liye
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    
    const days = [];
    
    // Empty cells for first week
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} />);
    }
    
    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = 
        new Date().getDate() === day && 
        new Date().getMonth() === currentMonth && 
        new Date().getFullYear() === currentYear;
      
      const isSelected = selectedDate && 
        selectedDate.getUTCDate() === day && 
        selectedDate.getUTCMonth() === currentMonth && 
        selectedDate.getUTCFullYear() === currentYear;
      
      days.push(
        <button
          key={day}
          onClick={() => handleDateSelect(day)}
          className={`
            w-9 h-9 rounded-full text-sm transition-colors
            ${isSelected ? "bg-primary text-white" : ""}
            ${isToday && !isSelected ? "bg-blue-100 text-blue-700 font-medium" : ""}
            ${!isSelected && !isToday ? "hover:bg-muted" : ""}
          `}
        >
          {day}
        </button>
      );
    }
    
    return days;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        {/* Close button with cross icon */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-50 w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4" />
        </button>

        <DialogTitle className="sr-only">
          {isEditMode ? "Edit Customer" : "Add New Customer"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Form for {isEditMode ? "editing" : "adding"} customer
        </DialogDescription>

        <div className="sticky top-0 z-10 backdrop-blur-sm bg-background/80 border-b border-border/50 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{isEditMode ? "Edit Customer" : "Add New Customer"}</h1>
              <p className="text-sm text-muted-foreground">
                {isEditMode ? "Update customer details" : "Enter customer details"}
              </p>
            </div>
            <div
              className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full ${
                backendStatus === "connected"
                  ? "bg-green-500/10 text-green-600"
                  : backendStatus === "disconnected"
                  ? "bg-red-500/10 text-red-600"
                  : "bg-yellow-500/10 text-yellow-600"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "connected"
                    ? "bg-green-500"
                    : backendStatus === "disconnected"
                    ? "bg-red-500"
                    : "bg-yellow-500 animate-pulse"
                }`}
              />
              {backendStatus.charAt(0).toUpperCase() + backendStatus.slice(1)}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Photo Upload */}
          <div className="mb-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div
                  onClick={() => !isSubmitting && photoInputRef.current?.click()}
                  className={`w-24 h-24 rounded-full border-2 border-dashed ${
                    isSubmitting ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary"
                  } bg-muted flex items-center justify-center overflow-hidden transition-colors`}
                >
                  {formData.photo ? (
                    <img src={formData.photo} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>

                {formData.photo && (
                  <button
                    onClick={() => setFormData(p => ({ ...p, photo: null }))}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-700 shadow"
                    disabled={isSubmitting}
                  >
                    <X size={16} />
                  </button>
                )}

                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <p className="font-medium">Customer Photo</p>
                <p className="text-sm text-muted-foreground">PNG / JPG • max 5 MB</p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm mb-1.5">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  placeholder="Full name"
                  className="w-full px-4 py-2.5 border rounded-md bg-background"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5">Customer ID</label>
                <input
                  value={formData.customerId || "Auto-generated"}
                  className="w-full px-4 py-2.5 border rounded-md bg-muted cursor-not-allowed"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5">
                  Phone No. <span className="text-red-500">*</span>
                </label>
                <input
                  name="phoneNo"
                  value={formData.phoneNo}
                  onChange={handleInputChange}
                  placeholder="03XXXXXXXXX"
                  className="w-full px-4 py-2.5 border rounded-md bg-background"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5">Email Address</label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@email.com"
                  className="w-full px-4 py-2.5 border rounded-md bg-background"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5">CNIC No.</label>
                <input
                  name="cnicNo"
                  value={formData.cnicNo}
                  onChange={handleInputChange}
                  placeholder="12345-6789012-3"
                  className="w-full px-4 py-2.5 border rounded-md bg-background"
                  disabled={isSubmitting}
                />
              </div>

              {/* Custom Calendar for Registration Date */}
              <div>
                <label className="block text-sm mb-1.5">Registration Date *</label>
                <div className="relative" ref={calendarRef}>
                  <div
                    className="relative cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCalendar(prev => !prev);
                    }}
                  >
                    <input
                      readOnly
                      value={formData.registrationDate}
                      placeholder="dd/mm/yyyy"
                      className="w-full px-4 py-2.5 border rounded-md bg-background pr-10 cursor-pointer"
                      disabled={isSubmitting}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>

                  {showCalendar && (
                    <div 
                      className="absolute z-[999] mt-1 w-80 bg-popover border rounded-lg shadow-xl"
                      style={{ top: '100%', left: 0 }}
                    >
                      <div className="p-4 border-b flex items-center justify-between">
                        <button 
                          onClick={handlePrevMonth}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-medium">
                          {monthNames[currentMonth]} {currentYear}
                        </span>
                        <button 
                          onClick={handleNextMonth}
                          className="p-1 hover:bg-muted rounded"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="p-3">
                        <button
                          onClick={handleToday}
                          className="w-full py-2 mb-3 text-sm bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                          Today
                        </button>

                        <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
                          {dayNames.map(d => (
                            <div key={d} className="text-muted-foreground font-medium">{d}</div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center text-sm">
                          {renderCalendarDays()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-3">
                <label className="block text-sm mb-1.5">Address</label>
                <input
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                  className="w-full px-4 py-2.5 border rounded-md bg-background"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5">Province</label>
                <div className="relative">
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border rounded-md bg-background appearance-none pr-10"
                    disabled={isSubmitting}
                  >
                    <option value="">Select province</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5">City</label>
                <div className="relative">
                  <select
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    disabled={!formData.province || isSubmitting}
                    className="w-full px-4 py-2.5 border rounded-md bg-background appearance-none pr-10 disabled:opacity-60"
                  >
                    <option value="">Select city</option>
                    {availableCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Documents</h3>
            <div
              onClick={() => !isSubmitting && docInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Upload className="mx-auto mb-3 text-muted-foreground" size={32} />
              <p className="text-sm text-muted-foreground">Click or drag files here</p>
              <p className="text-xs text-muted-foreground mt-1">Images • max 1.5 MB each</p>
            </div>
            <input
              ref={docInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleDocUpload}
              className="hidden"
              disabled={isSubmitting}
            />

            {formData.documents.length > 0 && (
              <div className="mt-6">
                <p className="text-sm mb-3">
                  {formData.documents.length} document{formData.documents.length !== 1 ? "s" : ""} uploaded
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                  {formData.documents.map((doc, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={doc}
                        alt={`doc-${idx}`}
                        className="w-full h-28 object-cover rounded border"
                      />
                      <button
                        onClick={() => removeDocument(idx)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        disabled={isSubmitting}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="px-6 py-2.5 border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || backendStatus !== "connected"}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isEditMode ? "Updating..." : "Saving..."}
                </>
              ) : (
                <>
                  <Save size={18} />
                  {isEditMode ? "Update" : "Save"}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}