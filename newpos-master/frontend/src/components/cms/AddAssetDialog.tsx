import { useState, useEffect, useRef } from "react";
import { Save, Calendar, Clock, ChevronLeft, ChevronRight, Loader2, Upload, X, Eye } from "lucide-react";
import { 
  Dialog, 
  DialogContent,
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (assetData: any) => Promise<void>;
}

export function AddAssetDialog({ open, onOpenChange, onSave }: AddAssetDialogProps) {
  const [formData, setFormData] = useState({
    assetName: "",
    category: "",
    quantity: "1",
    sizeModel: "",
    condition: "",
    description: "",
    department: "",
    assignedTo: "",
    purchasePrice: "",
    purchaseFrom: "",
    invoiceNo: "",
    date: "",  // DD/MM/YYYY string - USER SELECTED DATE
    time: "12:00", // Default to 12:00 PM to avoid midnight timezone issues
    paymentMethod: "cash",
    receiptImage: null as File | null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Dialog open: date auto mat set nahi - user jo date select kare wohi show/save hogi
  useEffect(() => {
    if (open) {
      const today = new Date();
      setCurrentMonth(today.getMonth());
      setCurrentYear(today.getFullYear());
      setSelectedDate(today);
      setFormData(prev => ({
        ...prev,
        time: "12:00",
        paymentMethod: "cash",
      }));
    }
  }, [open]);

  // Date select hone pe formData update
  useEffect(() => {
    if (selectedDate) {
      const formatted = `${selectedDate.getDate().toString().padStart(2, '0')}/${
        (selectedDate.getMonth() + 1).toString().padStart(2, '0')
      }/${selectedDate.getFullYear()}`;
      setFormData(prev => ({ ...prev, date: formatted }));
    }
  }, [selectedDate]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowCalendar(false);
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📸 File selected:", {
      name: file.name,
      size: file.size,
      type: file.type,
      fileObject: file instanceof File ? "YES" : "NO"
    });

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt image must be less than 5MB");
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image (JPEG, JPG, PNG, WebP, PDF)");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    
    setFormData(prev => ({ ...prev, receiptImage: file }));
    toast.success("Receipt image uploaded successfully");
  };

  const removeReceiptImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    
    setFormData(prev => ({ ...prev, receiptImage: null }));
    if (receiptInputRef.current) {
      receiptInputRef.current.value = '';
    }
    toast.info("Receipt image removed");
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  const todayDate = new Date();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // ✅ FIXED: Submit function - Correct date handling to avoid timezone issues
  const handleSubmit = async () => {
    if (!formData.assetName || !formData.category || !formData.condition || !formData.department) {
      toast.error("Please fill required fields");
      return;
    }

    if (!formData.date) {
      toast.error("Date is required");
      return;
    }

    setIsLoading(true);
    
    try {
      // Create FormData object
      const formDataToSend = new FormData();
      
      // ✅ Append all fields with CORRECT field names
      formDataToSend.append('assetName', formData.assetName);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('quantity', formData.quantity);
      formDataToSend.append('sizeModel', formData.sizeModel || '');
      formDataToSend.append('condition', formData.condition);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('department', formData.department);
      formDataToSend.append('assignedTo', formData.assignedTo || '');
      formDataToSend.append('purchasePrice', formData.purchasePrice || '');
      formDataToSend.append('purchaseFrom', formData.purchaseFrom || '');
      formDataToSend.append('invoiceNo', formData.invoiceNo || '');
      
      // ✅ CRITICAL FIX: Convert DD/MM/YYYY to YYYY-MM-DD format WITHOUT timezone issues
      let purchaseDate = formData.date;
      console.log("📅 Original date from form:", purchaseDate);
      
      if (purchaseDate.includes('/')) {
        const [day, month, year] = purchaseDate.split('/');
        
        // ✅ Create YYYY-MM-DD format directly without Date object
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        console.log("📅 Converted date to YYYY-MM-DD:", formattedDate);
        
        formDataToSend.append('purchaseDate', formattedDate);
      } else {
        // If already in correct format
        formDataToSend.append('purchaseDate', purchaseDate);
      }
      
      // ✅ Add purchaseTime (default to 12:00 to avoid midnight timezone issues)
      const timeToSend = formData.time || '12:00';
      formDataToSend.append('purchaseTime', timeToSend);
      
      // ✅ Attach selected payment method so asset purchases debit the right account
      formDataToSend.append('paymentMethod', formData.paymentMethod || 'cash');
      formDataToSend.append('accountType', 'fixed_asset');
      
      // ✅ Append the File object with the correct field name
      if (formData.receiptImage) {
        console.log("📄 Appending file to FormData:", formData.receiptImage.name);
        formDataToSend.append('receiptImage', formData.receiptImage);
      } else {
        console.log("⚠️ No receipt image to append");
      }

      // Debug: Log FormData contents
      console.log("📦 FormData contents before sending:");
      for (let [key, value] of formDataToSend.entries()) {
        console.log(`${key}:`, value instanceof File ? `File (${value.name}, ${value.type}, ${value.size} bytes)` : value);
      }

      if (onSave) {
        await onSave(formDataToSend);
        
        // Clean up preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        
        // Reset form - date empty taake next entry mein user apni date select kare
        setFormData({
          assetName: "",
          category: "",
          quantity: "1",
          sizeModel: "",
          condition: "",
          description: "",
          department: "",
          assignedTo: "",
          purchasePrice: "",
          purchaseFrom: "",
          invoiceNo: "",
          date: "",
          time: "12:00",
          paymentMethod: "cash",
          receiptImage: null,
        });
        setSelectedDate(null);
        
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("❌ Error in handleSubmit:", error);
      
      let errorMessage = "Failed to save asset";
      
      if (error) {
        if (error.message) {
          if (typeof error.message === 'string') {
            errorMessage = error.message;
          } else if (typeof error.message === 'object') {
            try {
              errorMessage = JSON.stringify(error.message);
            } catch {
              errorMessage = "Error message is an object";
            }
          }
        } 
        else if (error.error) {
          errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        }
        else {
          try {
            errorMessage = JSON.stringify(error);
          } catch {
            errorMessage = "Unknown error occurred";
          }
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isLoading) {
      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
      // Reset form - date empty (jo date user select kare wohi show)
      setFormData({
        assetName: "",
        category: "",
        quantity: "1",
        sizeModel: "",
        condition: "",
        description: "",
        department: "",
        assignedTo: "",
        purchasePrice: "",
        purchaseFrom: "",
        invoiceNo: "",
        date: "",
        time: "12:00",
        paymentMethod: "cash",
        receiptImage: null,
      });
      setSelectedDate(null);
      setShowReceiptPreview(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="bg-background border-border max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogTitle className="sr-only">Add New Asset</DialogTitle>
        <DialogDescription className="sr-only">
          Form for adding a new asset to the system
        </DialogDescription>
        
        <div className="bg-cms-sidebar px-6 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Assets/ Add Assets</p>
        </div>

        <div className="p-6 bg-background">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Add New Asset</h1>
            <p className="text-sm text-muted-foreground">Enter the details for Asset</p>
          </div>

          {/* Asset Information Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">Asset Information</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Asset Name *</label>
                <input
                  type="text"
                  name="assetName"
                  placeholder="e.g Dell Laptop"
                  value={formData.assetName}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Category *</label>
                <input
                  type="text"
                  name="category"
                  placeholder="e.g Electronics"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  placeholder="e.g 1"
                  min="1"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Size/Model</label>
                <input
                  type="text"
                  name="sizeModel"
                  placeholder="e.g Xps"
                  value={formData.sizeModel}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Condition *</label>
                <input
                  type="text"
                  name="condition"
                  placeholder="e.g New, Good, Fair"
                  value={formData.condition}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
              <textarea
                name="description"
                placeholder="Write short detail"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Assigned Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">Assigned Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Department *</label>
                <input
                  type="text"
                  name="department"
                  placeholder="e.g IT, HR, Finance"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Assigned to</label>
                <input
                  type="text"
                  name="assignedTo"
                  placeholder="Emily Clark"
                  value={formData.assignedTo}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Purchase Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-white mb-4">Purchase Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Price</label>
                <input
                  type="text"
                  name="purchasePrice"
                  placeholder="70000"
                  value={formData.purchasePrice}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase From</label>
                <input
                  type="text"
                  name="purchaseFrom"
                  placeholder="John Doe"
                  value={formData.purchaseFrom}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Invoice No.</label>
                <input
                  type="text"
                  name="invoiceNo"
                  placeholder="e.g 83662626"
                  value={formData.invoiceNo}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleSelectChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="cash">Cash (Drawer)</option>
                  <option value="bank">Bank</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs text-muted-foreground mb-1.5">Date & Time *</label>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={calendarRef}>
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => setShowCalendar(!showCalendar)}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.date}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  
{showCalendar && (
  <div className="absolute z-50 mt-1 w-80 bg-background border border-border rounded-lg shadow-lg">
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrevMonth} className="p-1 hover:bg-cms-input-bg rounded">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <div className="flex items-center gap-2">
          {/* Today's Date */}
          <div className="text-sm font-semibold text-primary">
            {selectedDate ? selectedDate.getDate().toString().padStart(2, '0') : todayDate.getDate().toString().padStart(2, '0')}
          </div>
          
          {/* Month */}
          <div className="text-sm font-semibold text-foreground">
            {monthNames[currentMonth]}
          </div>
          
          {/* Year Dropdown */}
          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="text-sm font-semibold text-foreground bg-cms-input-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Array.from({ length: 21 }, (_, i) => {
              const year = todayDate.getFullYear() - 10 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
        
        <button onClick={handleNextMonth} className="p-1 hover:bg-cms-input-bg rounded">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      
      <button
        onClick={handleToday}
        className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Today
      </button>
    </div>

    <div className="p-4">
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs text-muted-foreground font-medium">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, index) => (
          <div key={`empty-${index}`} className="h-9" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const isToday = todayDate.getDate() === day && 
                          todayDate.getMonth() === currentMonth &&
                          todayDate.getFullYear() === currentYear;
          const isSelected = selectedDate && 
                            selectedDate.getDate() === day &&
                            selectedDate.getMonth() === currentMonth &&
                            selectedDate.getFullYear() === currentYear;

          return (
            <button
              key={day}
              onClick={() => handleDateSelect(day)}
              className={`
                h-9 flex items-center justify-center text-sm rounded-md transition-colors
                ${isSelected 
                  ? 'bg-primary text-primary-foreground' 
                  : isToday 
                  ? 'bg-blue-100 text-blue-600 font-semibold' 
                  : 'hover:bg-cms-input-bg text-foreground'
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  </div>
)}
                </div>

                <div className="relative">
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="w-32 bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Receipt Image Upload Section */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Receipt Image</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div 
                    onClick={() => !isLoading && receiptInputRef.current?.click()}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-cms-input-bg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden ${
                      isLoading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {(formData.receiptImage && previewUrl) ? (
                      <img 
                        src={previewUrl} 
                        alt="Receipt preview" 
                        className="w-full h-full object-cover rounded-lg"
                        onClick={() => setShowReceiptPreview(true)}
                      />
                    ) : (
                      <Upload className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    onChange={handleReceiptUpload}
                    className="hidden"
                    disabled={isLoading}
                  />
                  {formData.receiptImage && (
                    <>
                      <button
                        onClick={removeReceiptImage}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                        type="button"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      <button
                        onClick={() => setShowReceiptPreview(true)}
                        className="absolute -bottom-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors z-10"
                        type="button"
                      >
                        <Eye className="w-3 h-3 text-white" />
                      </button>
                    </>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Upload Receipt</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, PDF up to 5MB</p>
                  {formData.receiptImage && (
                    <div className="mt-2">
                      <p className="text-xs text-foreground">File: {formData.receiptImage.name}</p>
                      <button
                        onClick={() => setShowReceiptPreview(true)}
                        className="text-xs text-primary hover:text-primary/80"
                        type="button"
                      >
                        View Receipt
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>

      {/* Receipt Preview Modal */}
      {showReceiptPreview && formData.receiptImage && previewUrl && (
        <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
          <DialogContent className="bg-background border-border max-w-4xl max-h-[90vh] p-0">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h2 className="text-lg font-semibold text-foreground">Receipt Preview</h2>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="p-2 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex justify-center items-center">
              {formData.receiptImage.type === 'application/pdf' ? (
                <div className="w-full h-[70vh] flex flex-col items-center justify-center">
                  <p className="text-lg font-medium mb-4">PDF Document: {formData.receiptImage.name}</p>
                  <a 
                    href={previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
                  >
                    Open PDF in New Tab
                  </a>
                </div>
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Receipt preview" 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="p-4 border-t border-border flex justify-between items-center">
              <p className="text-sm text-muted-foreground">File: {formData.receiptImage.name}</p>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}