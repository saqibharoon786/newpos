import { useState, useEffect, useRef } from "react";
import { Save, Calendar, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
    date: "",  // ab DD/MM/YYYY string
    time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarRef = useRef<HTMLDivElement>(null);

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

  // Dialog open hone pe default date set
  useEffect(() => {
    if (open && !formData.date) {
      const now = new Date();
      setSelectedDate(now);
      setCurrentMonth(now.getMonth());
      setCurrentYear(now.getFullYear());
      const ddmmyyyy = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      setFormData(prev => ({ ...prev, date: ddmmyyyy }));
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
      let purchasePriceValue = null;
      if (formData.purchasePrice && formData.purchasePrice.trim() !== "") {
        const cleanPrice = formData.purchasePrice.replace(/,/g, '').trim();
        if (!isNaN(parseFloat(cleanPrice))) {
          purchasePriceValue = parseFloat(cleanPrice);
        }
      }

      const payload = {
        assetName: formData.assetName,
        category: formData.category,
        quantity: parseInt(formData.quantity) || 1,
        sizeModel: formData.sizeModel || null,
        condition: formData.condition,
        description: formData.description || null,
        department: formData.department,
        assignedTo: formData.assignedTo || null,
        purchasePrice: purchasePriceValue,
        purchaseFrom: formData.purchaseFrom || null,
        invoiceNo: formData.invoiceNo || null,
        date: formData.date,          // DD/MM/YYYY format
        time: formData.time
      };

      console.log("📤 Sending payload:", payload);

      if (onSave) {
        await onSave(payload);
        
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
          time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
        });
        
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving asset:", error);
      toast.error(error.message || "Failed to save asset");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open && !isLoading) {
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
        time: new Date().toLocaleTimeString('en-US', { hour12: false }).slice(0, 5),
      });
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

          {/* Asset Information Section - bilkul same */}
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

          {/* Assigned Details Section - same */}
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

          {/* Purchase Details Section - sirf date change */}
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
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Date & Time</label>
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
                    <div className="absolute z-50 mt-1 w-72 bg-background border border-border rounded-lg shadow-lg">
                      <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                          <button onClick={handlePrevMonth} className="p-1 hover:bg-cms-input-bg rounded">
                            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                          </button>
                          <div className="text-sm font-semibold text-foreground">
                            {monthNames[currentMonth]} {currentYear}
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
          </div>

          {/* Action Buttons - same */}
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
    </Dialog>
  );
}