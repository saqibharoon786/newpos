import { useState, useEffect, useRef } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Save, Upload, Calendar, Clock, X, Package, ChevronDown, CheckCircle, DollarSign, History } from "lucide-react";
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
  price: number;
  weight: string; // Original weight
  soldWeight: number; // Sold weight
  remainingWeight: number; // Calculated remaining
  quality: string;
  purchaseDate: string;
  purchaseTime?: string;
  materialColor: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  vehicleColor: string;
  deliveryDate: string;
  deliveryTime?: string;
  receiptNo: string;
  vehicleImage: string;
  advancePayment: number;
  amountPaid: number;
  paidAmount: 'none' | 'partial' | 'paid';
  remainingAmount: number;
  status: 'available' | 'partially_sold' | 'sold_out';
  createdAt: string;
  updatedAt: string;
}

interface PurchaseWithRemaining extends Purchase {
  totalWeight: number; // Original weight (same as weight field)
  soldWeight: number; // Already exists in Purchase
  remainingWeight: number; // Already exists in Purchase
}

interface PaymentHistory {
  _id: string;
  purchaseId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  receiptNo?: string;
  materialName?: string;
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
  { name: "Black", color: "bg-black", value: "#000000" },
];

const qualityOptions = [
  { value: "PP750", label: "PP750" },
  { value: "PP1000", label: "PP1000" },
  { value: "HD", label: "HD" },
  { value: "Natural", label: "Natural" },
  { value: "Dodya", label: "Dodya" },
  { value: "Pipe", label: "Pipe" },
];

const PaymentStatusBadge = ({ status }: { status: 'none' | 'partial' | 'paid' }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' };
      case 'partial':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' };
      case 'none':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Unpaid' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 text-xs ${config.bg} ${config.text} rounded-full`}>
      {config.label}
    </span>
  );
};

const StockStatusBadge = ({ status }: { status: 'available' | 'partially_sold' | 'sold_out' }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Available' };
      case 'partially_sold':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partially Sold' };
      case 'sold_out':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Sold Out' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 text-xs ${config.bg} ${config.text} rounded-full`}>
      {config.label}
    </span>
  );
};

const PaymentModal = ({ 
  open, 
  onClose, 
  purchase, 
  onPaymentSuccess 
}: { 
  open: boolean;
  onClose: () => void;
  purchase: PurchaseWithRemaining | null;
  onPaymentSuccess: (newPayment: PaymentHistory) => void;
}) => {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Format date to YYYY-MM-DD
  const formatDateToYMD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse date from YYYY-MM-DD string to Date object (local time)
  const parseDateFromYMD = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create date in local timezone (month is 0-indexed)
    return new Date(year, month - 1, day);
  };

  // Format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    const date = parseDateFromYMD(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  useEffect(() => {
    if (open && purchase) {
      const today = new Date();
      const formattedToday = formatDateToYMD(today);
      
      setPaymentAmount("");
      setPaymentDate(formattedToday);
      setSelectedDate(today);
      setCurrentMonth(today.getMonth());
      setCurrentYear(today.getFullYear());
      setPaymentMethod("cash");
      setNotes("");
    }
  }, [open, purchase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
        setShowYearDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setShowYearDropdown(false);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setShowYearDropdown(false);
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const formattedDate = formatDateToYMD(date);
    
    setSelectedDate(date);
    setPaymentDate(formattedDate);
    setCalendarOpen(false);
    setShowYearDropdown(false);
  };

  const handleToday = () => {
    const today = new Date();
    const formattedToday = formatDateToYMD(today);
    
    setSelectedDate(today);
    setPaymentDate(formattedToday);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setCalendarOpen(false);
    setShowYearDropdown(false);
  };

  const handleYearSelect = (year: number) => {
    setCurrentYear(year);
    setShowYearDropdown(false);
  };

  const renderCalendar = () => (
    calendarOpen && (
      <div 
        ref={calendarRef}
        className="absolute z-[999] mt-1 w-80 bg-background border border-border rounded-lg shadow-2xl"
        style={{ 
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '4px',
        }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-1 relative">
              <div className="text-sm font-semibold text-foreground min-w-[100px] text-center">
                {monthNames[currentMonth]}
              </div>
              <button 
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted rounded"
              >
                {currentYear}
                <ChevronDown className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showYearDropdown && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 max-h-48 overflow-y-auto bg-background border border-border rounded-md shadow-lg z-10">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-muted ${year === currentYear ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleNextMonth} 
              className="p-1 hover:bg-muted rounded"
            >
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
            {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, index) => {
              const day = index + 1;
              
              // Check if this day is selected
              const selectedDateObj = parseDateFromYMD(paymentDate);
              const isSelected = selectedDateObj.getDate() === day &&
                                selectedDateObj.getMonth() === currentMonth &&
                                selectedDateObj.getFullYear() === currentYear;
              
              // Check if this day is today
              const today = new Date();
              const isToday = today.getDate() === day && 
                              today.getMonth() === currentMonth &&
                              today.getFullYear() === currentYear;

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
                      : 'hover:bg-muted text-foreground'
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
    )
  );

  const handleSubmit = async () => {
    if (!purchase) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    const remainingAmount = purchase.price - purchase.amountPaid;
    if (amount > remainingAmount) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed remaining amount of Rs. ${remainingAmount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newAmountPaid = purchase.amountPaid + amount;
      const newPaidStatus = newAmountPaid >= purchase.price ? 'paid' : 
                           newAmountPaid > 0 ? 'partial' : 'none';
      const newRemainingAmount = purchase.price - newAmountPaid;
      
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        purchaseId: purchase._id,
        amount: amount,
        paymentDate: paymentDate, // This is already in YYYY-MM-DD format
        paymentMethod: paymentMethod,
        notes: notes || `Payment of Rs. ${amount.toLocaleString()}`,
        receiptNo: purchase.receiptNo,
        materialName: purchase.materialName
      };

      const updateData = {
        amountPaid: newAmountPaid,
        paidAmount: newPaidStatus,
        remainingAmount: newRemainingAmount
      };

      const response = await api.put(
        `${PURCHASES_API_URL}/${purchase._id}`,
        updateData
      );

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Payment of Rs. ${amount.toLocaleString()} recorded successfully!`,
        });
        onPaymentSuccess(paymentRecord);
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !purchase) return null;

  const remainingAmount = purchase.price - purchase.amountPaid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Record Payment
          </p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Record Payment</h2>
            <p className="text-sm text-muted-foreground">
              Purchase #{purchase.receiptNo} - {purchase.materialName}
            </p>
          </div>

          <div className="mb-6 p-4 bg-cms-card rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {purchase.price.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {purchase.amountPaid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Remaining Amount</p>
              <p className="text-xl font-bold text-red-600">
                Rs. {remainingAmount.toLocaleString()}
              </p>
            </div>
            <div className="mt-3">
              <PaymentStatusBadge status={purchase.paidAmount} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={`Maximum: Rs. ${remainingAmount.toLocaleString()}`}
                  className="w-full bg-cms-card border border-border rounded-md pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Max: Rs. {remainingAmount.toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Date *</label>
              <div className="relative">
                <div 
                  className="relative cursor-pointer"
                  onClick={() => setCalendarOpen(!calendarOpen)}
                >
                  <input
                    type="text"
                    readOnly
                    value={formatDateForDisplay(paymentDate)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground cursor-pointer"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {renderCalendar()}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online Payment</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any payment notes..."
                rows={3}
                className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-border mt-6">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !paymentAmount}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Record Payment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarkAsPaidModal = ({ 
  open, 
  onClose, 
  purchase, 
  onPaymentSuccess 
}: { 
  open: boolean;
  onClose: () => void;
  purchase: PurchaseWithRemaining | null;
  onPaymentSuccess: (paymentRecord: PaymentHistory) => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkPaid = async () => {
    if (!purchase) return;

    setIsSubmitting(true);
    try {
      const remainingAmount = purchase.price - purchase.amountPaid;
      
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        purchaseId: purchase._id,
        amount: remainingAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'cash',
        notes: 'Marked as fully paid',
        receiptNo: purchase.receiptNo,
        materialName: purchase.materialName
      };

      const updateData = {
        amountPaid: purchase.price,
        paidAmount: 'paid',
        remainingAmount: 0
      };

      const response = await api.put(
        `${PURCHASES_API_URL}/${purchase._id}`,
        updateData
      );

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Purchase marked as fully paid!`,
        });
        onPaymentSuccess(paymentRecord);
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to mark as paid",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !purchase) return null;

  const remainingAmount = purchase.price - purchase.amountPaid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Mark as Paid
          </p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Mark as Fully Paid</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this purchase as fully paid?
            </p>
          </div>

          <div className="mb-6 p-4 bg-cms-card rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {purchase.price.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currently Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {purchase.amountPaid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Remaining to Pay</p>
              <p className="text-xl font-bold text-red-600">
                Rs. {remainingAmount.toLocaleString()}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <PaymentStatusBadge status={purchase.paidAmount} />
              <span className="text-xs text-muted-foreground">→</span>
              <PaymentStatusBadge status={'paid'} />
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-800">Note</p>
                <p className="text-xs text-yellow-700">
                  This will update the payment status to "Paid" and set amount paid equal to total price.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleMarkPaid}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Mark as Paid
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PaymentHistoryModal = ({
  open,
  onClose,
  purchase,
  allPayments
}: {
  open: boolean;
  onClose: () => void;
  purchase: PurchaseWithRemaining | null;
  allPayments: PaymentHistory[];
}) => {
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && purchase) {
      fetchPaymentHistory();
    }
  }, [open, purchase]);

  const fetchPaymentHistory = () => {
    if (!purchase) return;
    
    setLoading(true);
    try {
      const purchasePayments = allPayments.filter(
        payment => payment.purchaseId === purchase._id
      );
      
      const sortedPayments = [...purchasePayments].sort((a, b) => 
        new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
      );
      
      setPaymentHistory(sortedPayments);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load payment history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open || !purchase) return null;

  const remainingAmount = purchase.price - purchase.amountPaid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center sticky top-0 z-10">
          <div>
            <p className="text-xs text-muted-foreground">Payment History</p>
            <h2 className="text-lg font-bold text-foreground">
              Purchase #{purchase.receiptNo} - {purchase.materialName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-cms-card rounded-lg border border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {purchase.price.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {purchase.amountPaid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Amount</p>
                <p className="text-lg font-bold text-red-600">
                  Rs. {remainingAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <div className="mt-1">
                  <PaymentStatusBadge status={purchase.paidAmount} />
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Total Payments: {paymentHistory.length} | 
              Total Paid: Rs. {purchase.amountPaid.toLocaleString()} | 
              Remaining: Rs. {remainingAmount.toLocaleString()}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
              <History className="w-5 h-5" />
              Payment Records (Date Wise)
            </h3>
            
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading payment history...</span>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-lg">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No payment records found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Record your first payment to see history here
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-cms-table-header">
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Sr. No.</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Payment Method</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Amount</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Notes</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment, index) => {
                      let runningTotal = 0;
                      for (let i = 0; i <= index; i++) {
                        runningTotal += paymentHistory[i].amount;
                      }
                      
                      return (
                        <tr 
                          key={payment._id || index} 
                          className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'}`}
                        >
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">
                            {new Date(payment.paymentDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground capitalize">
                            {payment.paymentMethod.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            Rs. {payment.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {payment.notes || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">
                            Rs. {runningTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    
                    <tr className="border-t-2 border-border bg-cms-card">
                      <td className="px-4 py-3 text-sm font-semibold text-foreground" colSpan={3}>
                        Total Paid
                      </td>
                      <td className="px-4 py-3 text-lg font-bold text-green-600">
                        Rs. {purchase.amountPaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={2}>
                        {paymentHistory.length} payment{paymentHistory.length !== 1 ? 's' : ''}
                      </td>
                    </tr>
                    
                    {remainingAmount > 0 && (
                      <tr className="border-t border-border bg-red-50/50">
                        <td className="px-4 py-3 text-sm font-semibold text-foreground" colSpan={3}>
                          Remaining Balance
                        </td>
                        <td className="px-4 py-3 text-lg font-bold text-red-600">
                          Rs. {remainingAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={2}>
                          To be paid
                        </td>
                      </tr>
                    )}
                    
                    <tr className="border-t-2 border-primary bg-primary/5">
                      <td className="px-4 py-3 text-sm font-semibold text-foreground" colSpan={3}>
                        Grand Total
                      </td>
                      <td className="px-4 py-3 text-xl font-bold text-primary">
                        Rs. {purchase.price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={2}>
                        Purchase Price
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">Example: Multiple Payments</h4>
            <p className="text-xs text-blue-700">
              For a purchase of Rs. 7,500, you can record payments like:
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-blue-100 rounded">1st: Rs. 2,500</div>
              <div className="p-2 bg-blue-100 rounded">2nd: Rs. 2,500</div>
              <div className="p-2 bg-blue-100 rounded">3rd: Rs. 2,000</div>
              <div className="p-2 bg-blue-100 rounded">4th: Rs. 500</div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Purchase | null;
}

function PurchaseDialog({ open, onOpenChange, onSave, isEdit = false, editData = null }: DialogProps) {
  const [showPurchaseCalendar, setShowPurchaseCalendar] = useState(false);
  const [showPurchaseTimePicker, setShowPurchaseTimePicker] = useState(false);
  const [purchaseCurrentMonth, setPurchaseCurrentMonth] = useState(new Date().getMonth());
  const [purchaseCurrentYear, setPurchaseCurrentYear] = useState(new Date().getFullYear());
  const [selectedPurchaseDate, setSelectedPurchaseDate] = useState<Date | null>(null);
  
  const [showDeliveryCalendar, setShowDeliveryCalendar] = useState(false);
  const [showDeliveryTimePicker, setShowDeliveryTimePicker] = useState(false);
  const [deliveryCurrentMonth, setDeliveryCurrentMonth] = useState(new Date().getMonth());
  const [deliveryCurrentYear, setDeliveryCurrentYear] = useState(new Date().getFullYear());
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<Date | null>(null);
  
  const [selectedPurchaseHour, setSelectedPurchaseHour] = useState("12");
  const [selectedPurchaseMinute, setSelectedPurchaseMinute] = useState("00");
  const [selectedPurchaseAmPm, setSelectedPurchaseAmPm] = useState<"AM" | "PM">("PM");
  
  const [selectedDeliveryHour, setSelectedDeliveryHour] = useState("09");
  const [selectedDeliveryMinute, setSelectedDeliveryMinute] = useState("00");
  const [selectedDeliveryAmPm, setSelectedDeliveryAmPm] = useState<"AM" | "PM">("AM");

  const [showPurchaseYearDropdown, setShowPurchaseYearDropdown] = useState(false);
  const [showDeliveryYearDropdown, setShowDeliveryYearDropdown] = useState(false);
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);

  const purchaseCalendarRef = useRef<HTMLDivElement>(null);
  const purchaseTimeRef = useRef<HTMLDivElement>(null);
  const deliveryCalendarRef = useRef<HTMLDivElement>(null);
  const deliveryTimeRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    materialName: "",
    vendor: "",
    price: "",
    weight: "",
    quality: "PP750",
    purchaseDate: "",
    purchaseTime: "",
    materialColor: "#FFFFFF",
    vehicleName: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    vehicleColor: "",
    deliveryDate: "",
    deliveryTime: "",
    receiptNo: "",
    advancePayment: "",
    amountPaid: "",
    vehicleImage: null as File | null,
  });

  const [selectedMaterialColor, setSelectedMaterialColor] = useState("#FFFFFF");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (purchaseCalendarRef.current && !purchaseCalendarRef.current.contains(event.target as Node)) {
        setShowPurchaseCalendar(false);
        setShowPurchaseYearDropdown(false);
      }
      if (purchaseTimeRef.current && !purchaseTimeRef.current.contains(event.target as Node)) {
        setShowPurchaseTimePicker(false);
      }
      if (deliveryCalendarRef.current && !deliveryCalendarRef.current.contains(event.target as Node)) {
        setShowDeliveryCalendar(false);
        setShowDeliveryYearDropdown(false);
      }
      if (deliveryTimeRef.current && !deliveryTimeRef.current.contains(event.target as Node)) {
        setShowDeliveryTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getTodayDate = (): string => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const getCurrentTime = (): string => {
    const now = new Date();
    let hour = now.getHours();
    const minute = String(now.getMinutes()).padStart(2, '0');
    const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`;
  };

  const getImageUrl = (imagePath: string | undefined): string | null => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    
    if (cleanPath.startsWith('uploads/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    
    if (!cleanPath.includes('/')) {
      return `${API_BASE_URL}/uploads/${cleanPath}`;
    }
    
    return `${API_BASE_URL}/${cleanPath}`;
  };

  useEffect(() => {
    if (open) {
      const now = new Date();
      const todayStr = getTodayDate();
      const currentTimeStr = getCurrentTime();

      if (isEdit && editData) {
        let purchaseDateParsed: Date | null = null;
        let purchaseDateStr = todayStr;
        if (editData.purchaseDate) {
          try {
            purchaseDateParsed = new Date(editData.purchaseDate);
            if (!isNaN(purchaseDateParsed.getTime())) {
              const dd = String(purchaseDateParsed.getDate()).padStart(2, '0');
              const mm = String(purchaseDateParsed.getMonth() + 1).padStart(2, '0');
              const yyyy = purchaseDateParsed.getFullYear();
              purchaseDateStr = `${dd}/${mm}/${yyyy}`;
            }
          } catch (error) {
          }
        }

        let deliveryDateParsed: Date | null = null;
        let deliveryDateStr = "";
        if (editData.deliveryDate) {
          try {
            deliveryDateParsed = new Date(editData.deliveryDate);
            if (!isNaN(deliveryDateParsed.getTime())) {
              const dd = String(deliveryDateParsed.getDate()).padStart(2, '0');
              const mm = String(deliveryDateParsed.getMonth() + 1).padStart(2, '0');
              const yyyy = deliveryDateParsed.getFullYear();
              deliveryDateStr = `${dd}/${mm}/${yyyy}`;
            }
          } catch (error) {
          }
        }

        let purchaseTimeStr = currentTimeStr;
        if (editData.purchaseTime) {
          const match = editData.purchaseTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            purchaseTimeStr = `${match[1].padStart(2, '0')}:${match[2]} ${(match[3] || 'AM').toUpperCase()}`;
          }
        }

        let deliveryTimeStr = "09:00 AM";
        if (editData.deliveryTime) {
          const match = editData.deliveryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            deliveryTimeStr = `${match[1].padStart(2, '0')}:${match[2]} ${(match[3] || 'AM').toUpperCase()}`;
          }
        }

        setFormData({
          materialName: editData.materialName || "",
          vendor: editData.vendor || "",
          price: editData.price?.toString() || "",
          weight: editData.weight || "",
          quality: editData.quality || "PP750",
          purchaseDate: purchaseDateStr,
          purchaseTime: purchaseTimeStr,
          materialColor: editData.materialColor || "#FFFFFF",
          vehicleName: editData.vehicleName || "",
          vehicleType: editData.vehicleType || "",
          vehicleNumber: editData.vehicleNumber || "",
          driverName: editData.driverName || "",
          vehicleColor: editData.vehicleColor || "",
          deliveryDate: deliveryDateStr,
          deliveryTime: deliveryTimeStr,
          receiptNo: editData.receiptNo || "",
          advancePayment: editData.advancePayment?.toString() || "",
          amountPaid: editData.amountPaid?.toString() || "",
          vehicleImage: null,
        });
        
        setSelectedMaterialColor(editData.materialColor || "#FFFFFF");
        
        if (purchaseDateParsed) {
          setSelectedPurchaseDate(purchaseDateParsed);
          setPurchaseCurrentMonth(purchaseDateParsed.getMonth());
          setPurchaseCurrentYear(purchaseDateParsed.getFullYear());
        } else {
          setSelectedPurchaseDate(now);
          setPurchaseCurrentMonth(now.getMonth());
          setPurchaseCurrentYear(now.getFullYear());
        }

        if (deliveryDateParsed) {
          setSelectedDeliveryDate(deliveryDateParsed);
          setDeliveryCurrentMonth(deliveryDateParsed.getMonth());
          setDeliveryCurrentYear(deliveryDateParsed.getFullYear());
        } else {
          setSelectedDeliveryDate(null);
        }

        const purchaseTimeMatch = purchaseTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (purchaseTimeMatch) {
          setSelectedPurchaseHour(purchaseTimeMatch[1].padStart(2, '0'));
          setSelectedPurchaseMinute(purchaseTimeMatch[2]);
          setSelectedPurchaseAmPm((purchaseTimeMatch[3] as "AM" | "PM") || "AM");
        }

        const deliveryTimeMatch = deliveryTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (deliveryTimeMatch) {
          setSelectedDeliveryHour(deliveryTimeMatch[1].padStart(2, '0'));
          setSelectedDeliveryMinute(deliveryTimeMatch[2]);
          setSelectedDeliveryAmPm((deliveryTimeMatch[3] as "AM" | "PM") || "AM");
        }
        
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

  useEffect(() => {
    if (selectedPurchaseDate) {
      const dd = String(selectedPurchaseDate.getDate()).padStart(2, '0');
      const mm = String(selectedPurchaseDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedPurchaseDate.getFullYear();
      setFormData(prev => ({ ...prev, purchaseDate: `${dd}/${mm}/${yyyy}` }));
    }
  }, [selectedPurchaseDate]);

  useEffect(() => {
    if (selectedDeliveryDate) {
      const dd = String(selectedDeliveryDate.getDate()).padStart(2, '0');
      const mm = String(selectedDeliveryDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedDeliveryDate.getFullYear();
      setFormData(prev => ({ ...prev, deliveryDate: `${dd}/${mm}/${yyyy}` }));
    } else {
      setFormData(prev => ({ ...prev, deliveryDate: "" }));
    }
  }, [selectedDeliveryDate]);

  useEffect(() => {
    const timeStr = `${selectedPurchaseHour}:${selectedPurchaseMinute} ${selectedPurchaseAmPm}`;
    setFormData(prev => ({ ...prev, purchaseTime: timeStr }));
  }, [selectedPurchaseHour, selectedPurchaseMinute, selectedPurchaseAmPm]);

  useEffect(() => {
    const timeStr = `${selectedDeliveryHour}:${selectedDeliveryMinute} ${selectedDeliveryAmPm}`;
    setFormData(prev => ({ ...prev, deliveryTime: timeStr }));
  }, [selectedDeliveryHour, selectedDeliveryMinute, selectedDeliveryAmPm]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePurchasePrevMonth = () => {
    if (purchaseCurrentMonth === 0) {
      setPurchaseCurrentMonth(11);
      setPurchaseCurrentYear(y => y - 1);
    } else {
      setPurchaseCurrentMonth(m => m - 1);
    }
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseNextMonth = () => {
    if (purchaseCurrentMonth === 11) {
      setPurchaseCurrentMonth(0);
      setPurchaseCurrentYear(y => y + 1);
    } else {
      setPurchaseCurrentMonth(m => m + 1);
    }
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseYearSelect = (year: number) => {
    setPurchaseCurrentYear(year);
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseDateSelect = (day: number) => {
    const date = new Date(purchaseCurrentYear, purchaseCurrentMonth, day);
    setSelectedPurchaseDate(date);
    setShowPurchaseCalendar(false);
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseToday = () => {
    const today = new Date();
    setSelectedPurchaseDate(today);
    setPurchaseCurrentMonth(today.getMonth());
    setPurchaseCurrentYear(today.getFullYear());
    setShowPurchaseCalendar(false);
    setShowPurchaseYearDropdown(false);
  };

  const handleDeliveryPrevMonth = () => {
    if (deliveryCurrentMonth === 0) {
      setDeliveryCurrentMonth(11);
      setDeliveryCurrentYear(y => y - 1);
    } else {
      setDeliveryCurrentMonth(m => m - 1);
    }
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryNextMonth = () => {
    if (deliveryCurrentMonth === 11) {
      setDeliveryCurrentMonth(0);
      setDeliveryCurrentYear(y => y + 1);
    } else {
      setDeliveryCurrentMonth(m => m + 1);
    }
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryYearSelect = (year: number) => {
    setDeliveryCurrentYear(year);
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryDateSelect = (day: number) => {
    const date = new Date(deliveryCurrentYear, deliveryCurrentMonth, day);
    setSelectedDeliveryDate(date);
    setShowDeliveryCalendar(false);
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryToday = () => {
    const today = new Date();
    setSelectedDeliveryDate(today);
    setDeliveryCurrentMonth(today.getMonth());
    setDeliveryCurrentYear(today.getFullYear());
    setShowDeliveryCalendar(false);
    setShowDeliveryYearDropdown(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.vendor.trim()) newErrors.vendor = "Vendor is required";
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = "Valid price is required";
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = "Valid weight is required";
    if (!formData.quality) newErrors.quality = "Quality is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required";
    if (!formData.purchaseTime) newErrors.purchaseTime = "Purchase time is required";
    if (!formData.vehicleName.trim()) newErrors.vehicleName = "Vehicle name is required";
    if (!formData.vehicleType.trim()) newErrors.vehicleType = "Vehicle type is required";
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = "Vehicle number is required";
    if (!formData.driverName.trim()) newErrors.driverName = "Driver name is required";
    if (!formData.vehicleColor.trim()) newErrors.vehicleColor = "Vehicle color is required";
    if (!formData.deliveryDate) newErrors.deliveryDate = "Delivery date is required";
    if (!formData.deliveryTime) newErrors.deliveryTime = "Delivery time is required";
    if (!formData.receiptNo.trim()) newErrors.receiptNo = "Receipt number is required";
    
    if (formData.advancePayment && isNaN(Number(formData.advancePayment))) {
      newErrors.advancePayment = "Advance payment must be a valid number";
    }
    
    if (formData.amountPaid && isNaN(Number(formData.amountPaid))) {
      newErrors.amountPaid = "Amount paid must be a valid number";
    }
    
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
      
      const parseDate = (dateStr: string, timeStr: string): string => {
        const [dd, mm, yyyy] = dateStr.split('/').map(Number);
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!timeMatch) return new Date().toISOString();
        
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const ampm = timeMatch[3];
        
        if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
        if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        
        const date = new Date(yyyy, mm - 1, dd, hour, minute);
        return date.toISOString();
      };

      const purchaseDateTime = parseDate(formData.purchaseDate, formData.purchaseTime);
      const deliveryDateTime = parseDate(formData.deliveryDate, formData.deliveryTime);

      const priceNum = parseFloat(formData.price) || 0;
      const advancePaymentNum = parseFloat(formData.advancePayment) || 0;
      const amountPaidNum = parseFloat(formData.amountPaid) || 0;

      const totalAmountPaid = advancePaymentNum + amountPaidNum;
      const remainingAmount = priceNum - totalAmountPaid;
      
      let paidAmount: 'none' | 'partial' | 'paid' = 'none';
      if (totalAmountPaid >= priceNum) {
        paidAmount = 'paid';
      } else if (totalAmountPaid > 0) {
        paidAmount = 'partial';
      }

      const fields = {
        materialName: formData.materialName,
        vendor: formData.vendor,
        price: priceNum,
        weight: formData.weight,
        quality: formData.quality,
        purchaseDate: purchaseDateTime,
        materialColor: selectedMaterialColor,
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: formData.vehicleColor,
        deliveryDate: deliveryDateTime,
        receiptNo: formData.receiptNo,
        advancePayment: advancePaymentNum,
        amountPaid: totalAmountPaid,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount > 0 ? remainingAmount : 0,
        soldWeight: 0, // Initialize soldWeight as 0 for new purchases
        status: 'available' // Initialize status
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
        // Add initial payment to history if amount was paid during form submission
        if (totalAmountPaid > 0) {
          const initialPayment: PaymentHistory = {
            _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            purchaseId: response.data.data._id,
            amount: totalAmountPaid,
            paymentDate: purchaseDateTime.split('T')[0],
            paymentMethod: 'cash',
            notes: `Initial payment of Rs. ${totalAmountPaid.toLocaleString()}`,
            receiptNo: formData.receiptNo,
            materialName: formData.materialName
          };
          
          // Store in localStorage for payment history
          const savedPayments = localStorage.getItem('purchase_payments');
          const allPayments = savedPayments ? JSON.parse(savedPayments) : [];
          allPayments.push(initialPayment);
          localStorage.setItem('purchase_payments', JSON.stringify(allPayments));
        }
        
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
    const now = new Date();
    const todayStr = getTodayDate();
    const currentTimeStr = getCurrentTime();

    setFormData({
      materialName: "",
      vendor: "",
      price: "",
      weight: "",
      quality: "PP750",
      purchaseDate: todayStr,
      purchaseTime: currentTimeStr,
      materialColor: "#FFFFFF",
      vehicleName: "",
      vehicleType: "",
      vehicleNumber: "",
      driverName: "",
      vehicleColor: "",
      deliveryDate: "",
      deliveryTime: "09:00 AM",
      receiptNo: "",
      advancePayment: "",
      amountPaid: "",
      vehicleImage: null,
    });
    
    setSelectedMaterialColor("#FFFFFF");
    setSelectedPurchaseDate(now);
    setSelectedDeliveryDate(null);
    setPurchaseCurrentMonth(now.getMonth());
    setPurchaseCurrentYear(now.getFullYear());
    setDeliveryCurrentMonth(now.getMonth());
    setDeliveryCurrentYear(now.getFullYear());
    setShowPurchaseYearDropdown(false);
    setShowDeliveryYearDropdown(false);
    
    const currentTimeMatch = currentTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (currentTimeMatch) {
      setSelectedPurchaseHour(currentTimeMatch[1].padStart(2, '0'));
      setSelectedPurchaseMinute(currentTimeMatch[2]);
      setSelectedPurchaseAmPm((currentTimeMatch[3] as "AM" | "PM") || "AM");
    }
    
    setSelectedDeliveryHour("09");
    setSelectedDeliveryMinute("00");
    setSelectedDeliveryAmPm("AM");
    
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

  const renderCalendar = (type: 'purchase' | 'delivery') => {
    const showCalendar = type === 'purchase' ? showPurchaseCalendar : showDeliveryCalendar;
    const calendarRef = type === 'purchase' ? purchaseCalendarRef : deliveryCalendarRef;
    const currentMonth = type === 'purchase' ? purchaseCurrentMonth : deliveryCurrentMonth;
    const currentYear = type === 'purchase' ? purchaseCurrentYear : deliveryCurrentYear;
    const handlePrevMonth = type === 'purchase' ? handlePurchasePrevMonth : handleDeliveryPrevMonth;
    const handleNextMonth = type === 'purchase' ? handlePurchaseNextMonth : handleDeliveryNextMonth;
    const handleToday = type === 'purchase' ? handlePurchaseToday : handleDeliveryToday;
    const handleDateSelect = type === 'purchase' ? handlePurchaseDateSelect : handleDeliveryDateSelect;
    const selectedDate = type === 'purchase' ? selectedPurchaseDate : selectedDeliveryDate;
    const showYearDropdown = type === 'purchase' ? showPurchaseYearDropdown : showDeliveryYearDropdown;
    const setShowYearDropdown = type === 'purchase' ? setShowPurchaseYearDropdown : setShowDeliveryYearDropdown;
    const handleYearSelect = type === 'purchase' ? handlePurchaseYearSelect : handleDeliveryYearSelect;

    return showCalendar && (
      <div 
        ref={calendarRef}
        className="absolute z-[999] mt-1 w-80 bg-background border border-border rounded-lg shadow-2xl"
        style={{ 
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '4px',
        }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-1 relative">
              <div className="text-sm font-semibold text-foreground min-w-[100px] text-center">
                {monthNames[currentMonth]}
              </div>
              <button 
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted rounded"
              >
                {currentYear}
                <ChevronDown className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showYearDropdown && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 max-h-48 overflow-y-auto bg-background border border-border rounded-md shadow-lg z-10">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-muted ${year === currentYear ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleNextMonth} 
              className="p-1 hover:bg-muted rounded"
            >
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
            {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, index) => {
              const day = index + 1;
              const isToday = new Date().getDate() === day && 
                              new Date().getMonth() === currentMonth &&
                              new Date().getFullYear() === currentYear;
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
                      : 'hover:bg-muted text-foreground'
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
    )
  };

  const renderTimePicker = (type: 'purchase' | 'delivery') => {
    const showTimePicker = type === 'purchase' ? showPurchaseTimePicker : showDeliveryTimePicker;
    const timeRef = type === 'purchase' ? purchaseTimeRef : deliveryTimeRef;
    const selectedHour = type === 'purchase' ? selectedPurchaseHour : selectedDeliveryHour;
    const selectedMinute = type === 'purchase' ? selectedPurchaseMinute : selectedDeliveryMinute;
    const selectedAmPm = type === 'purchase' ? selectedPurchaseAmPm : selectedDeliveryAmPm;
    const setSelectedHour = type === 'purchase' ? setSelectedPurchaseHour : setSelectedDeliveryHour;
    const setSelectedMinute = type === 'purchase' ? setSelectedPurchaseMinute : setSelectedDeliveryMinute;
    const setSelectedAmPm = type === 'purchase' ? setSelectedPurchaseAmPm : setSelectedDeliveryAmPm;

    return showTimePicker && (
      <div 
        ref={timeRef}
        className="absolute z-[999] mt-1 w-64 bg-background border border-border rounded-lg shadow-2xl right-0"
      >
        <div className="p-4">
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-2">Hour</div>
              <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                {hours.map(h => (
                  <button
                    key={h}
                    onClick={() => setSelectedHour(h)}
                    className={`py-1.5 text-sm rounded ${selectedHour === h ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-2">Minute</div>
              <div className="grid grid-cols-2 gap-1">
                {minutes.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMinute(m)}
                    className={`py-1.5 text-sm rounded ${selectedMinute === m ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex border rounded overflow-hidden">
            <button
              onClick={() => setSelectedAmPm("AM")}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "AM" ? "bg-primary text-white" : "hover:bg-muted text-foreground"}`}
            >
              AM
            </button>
            <button
              onClick={() => setSelectedAmPm("PM")}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "PM" ? "bg-primary text-white" : "hover:bg-muted text-foreground"}`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    )
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
                <label className="block text-xs text-muted-foreground mb-1.5">Price *</label>
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
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {qualityOptions.map((option) => (
                    <label 
                      key={option.value} 
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-cms-card-hover px-2 py-1 rounded transition-colors"
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={option.value}
                        checked={formData.quality === option.value}
                        onChange={() => handleQualityChange(option.value)}
                        className="sr-only"
                      />
                      <div className="w-4 h-4 border border-border bg-cms-card rounded flex items-center justify-center">
                        {formData.quality === option.value && (
                          <div className="w-2 h-2 bg-primary rounded-sm" />
                        )}
                      </div>
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.quality && (
                  <p className="text-xs text-red-500 mt-1">{errors.quality}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Date & Time *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPurchaseCalendar(prev => !prev);
                        setShowPurchaseTimePicker(false);
                        setShowPurchaseYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="dd/mm/yyyy"
                        value={formData.purchaseDate}
                        className={`w-full bg-cms-card border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderCalendar('purchase')}
                  </div>
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPurchaseTimePicker(prev => !prev);
                        setShowPurchaseCalendar(false);
                        setShowPurchaseYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="-- : --"
                        value={formData.purchaseTime}
                        className={`w-full bg-cms-card border ${errors.purchaseTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderTimePicker('purchase')}
                  </div>
                </div>
                {(errors.purchaseDate || errors.purchaseTime) && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.purchaseDate || errors.purchaseTime}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-2">Material Color *</label>
                <div className="flex flex-wrap items-center gap-3">
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
                        <div 
                          className={`w-5 h-5 rounded-full ${color.color} border-2 ${
                            selectedMaterialColor === color.value 
                              ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' 
                              : 'border-border'
                          }`} 
                        />
                      </div>
                      <span className="text-xs text-foreground">{color.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Advance Payment</label>
                <input
                  type="number"
                  name="advancePayment"
                  min="0"
                  step="0.01"
                  placeholder="e.g 20000"
                  value={formData.advancePayment}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.advancePayment ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.advancePayment && (
                  <p className="text-xs text-red-500 mt-1">{errors.advancePayment}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Optional</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Amount Paid</label>
                <input
                  type="number"
                  name="amountPaid"
                  min="0"
                  step="0.01"
                  placeholder="e.g 20000"
                  value={formData.amountPaid}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.amountPaid ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.amountPaid && (
                  <p className="text-xs text-red-500 mt-1">{errors.amountPaid}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Enter additional payment (if any)</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment Status</label>
                <div className="mt-2">
                  {formData.price && (formData.advancePayment || formData.amountPaid) ? (
                    <PaymentStatusBadge 
                      status={
                        (parseFloat(formData.advancePayment || '0') + parseFloat(formData.amountPaid || '0')) >= parseFloat(formData.price) ? 'paid' :
                        (parseFloat(formData.advancePayment || '0') + parseFloat(formData.amountPaid || '0')) > 0 ? 'partial' : 'none'
                      } 
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Enter amounts to see status</span>
                  )}
                </div>
                {formData.price && (formData.advancePayment || formData.amountPaid) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Remaining: Rs. {Math.max(0, parseFloat(formData.price) - (parseFloat(formData.advancePayment || '0') + parseFloat(formData.amountPaid || '0'))).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

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
                <label className="block text-xs text-muted-foreground mb-1.5">Delivery Date & Time *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeliveryCalendar(prev => !prev);
                        setShowDeliveryTimePicker(false);
                        setShowDeliveryYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="dd/mm/yyyy"
                        value={formData.deliveryDate}
                        className={`w-full bg-cms-card border ${errors.deliveryDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderCalendar('delivery')}
                  </div>
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeliveryTimePicker(prev => !prev);
                        setShowDeliveryCalendar(false);
                        setShowDeliveryYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="-- : --"
                        value={formData.deliveryTime}
                        className={`w-full bg-cms-card border ${errors.deliveryTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderTimePicker('delivery')}
                  </div>
                </div>
                {(errors.deliveryDate || errors.deliveryTime) && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.deliveryDate || errors.deliveryTime}
                  </p>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Recepiet Image</label>
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
  const [purchases, setPurchases] = useState<PurchaseWithRemaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<PurchaseWithRemaining | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [markAsPaidModalOpen, setMarkAsPaidModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<PurchaseWithRemaining | null>(null);
  
  const [allPayments, setAllPayments] = useState<PaymentHistory[]>(() => {
    const savedPayments = localStorage.getItem('purchase_payments');
    return savedPayments ? JSON.parse(savedPayments) : [];
  });

  useEffect(() => {
    localStorage.setItem('purchase_payments', JSON.stringify(allPayments));
  }, [allPayments]);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const parseConcatenatedPrices = (priceString: string | number): number => {
    if (!priceString) return 0;
    
    if (typeof priceString === 'number') {
      return priceString;
    }
    
    const asNumber = Number(priceString);
    if (!isNaN(asNumber)) {
      return asNumber;
    }
    
    const cleanString = priceString.toString().replace(/[^\d]/g, '');
    
    if (cleanString.length === 0) return 0;
    
    if (cleanString.length % 6 === 0) {
      let total = 0;
      const chunkSize = 6;
      
      for (let i = 0; i < cleanString.length; i += chunkSize) {
        const chunk = cleanString.substring(i, i + chunkSize);
        const price = parseInt(chunk, 10);
        if (!isNaN(price)) {
          total += price;
        }
      }
      return total;
    }
    
    const parsed = parseFloat(cleanString);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (amount: number | string) => {
    try {
      let numAmount: number;
      
      if (typeof amount === 'string') {
        numAmount = parseConcatenatedPrices(amount);
      } else {
        numAmount = amount;
      }
      
      if (isNaN(numAmount)) return '0';
      
      return numAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } catch (error) {
      return '0';
    }
  };

  const calculateTotals = () => {
    const totalPrice = purchases.reduce((sum, p) => {
      return sum + parseConcatenatedPrices(p.price);
    }, 0);
    
    const totalAmountPaid = purchases.reduce((sum, p) => {
      return sum + (Number(p.amountPaid) || 0);
    }, 0);
    
    const totalRemainingAmount = purchases.reduce((sum, p) => {
      return sum + (Number(p.remainingAmount) || 0);
    }, 0);
    
    // IMPORTANT: Use the original weight from the purchase, not soldWeight
    const totalWeight = purchases.reduce((sum, p) => {
      const weight = parseFloat(p.weight) || 0;
      return sum + weight;
    }, 0);
    
    const totalSoldWeight = purchases.reduce((sum, p) => {
      return sum + (p.soldWeight || 0);
    }, 0);
    
    const totalRemainingWeight = purchases.reduce((sum, p) => {
      return sum + (p.remainingWeight || 0);
    }, 0);
    
    return {
      totalPurchases: purchases.length,
      totalPrice: totalPrice,
      totalAmountPaid: totalAmountPaid,
      totalRemainingAmount: totalRemainingAmount,
      totalWeight: totalWeight,
      totalSoldWeight: totalSoldWeight,
      totalRemainingWeight: totalRemainingWeight,
    };
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`${PURCHASES_API_URL}/get-all`);
      
      if (response.data.success) {
        const purchasesData = response.data.data || [];
        
        console.log('Raw purchases data:', purchasesData);
        
        // Now the backend already provides soldWeight, remainingWeight, and status
        const purchasesWithRemaining = purchasesData.map((purchase: any) => {
          const originalWeight = parseFloat(purchase.weight) || 0;
          const soldWeight = purchase.soldWeight || 0;
          const remainingWeight = purchase.remainingWeight || (originalWeight - soldWeight);
          
          const parsedPrice = parseConcatenatedPrices(purchase.price);
          
          return {
            ...purchase,
            price: parsedPrice,
            totalWeight: originalWeight, // Original purchase weight
            soldWeight: soldWeight, // Already sold weight from backend
            remainingWeight: remainingWeight, // Calculated remaining from backend
            status: purchase.status || 'available'
          };
        });
        
        setPurchases(purchasesWithRemaining);
        
        const totals = calculateTotals();
        console.log('Final calculated total price:', totals.totalPrice);
        
      } else {
        throw new Error(response.data.message || 'Failed to fetch purchases');
      }
    } catch (error: any) {
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

  const handleEditPurchase = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseForEdit(purchase);
    setIsEditMode(true);
    setDialogOpen(true);
  };

  const handleDeletePurchase = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this purchase?')) {
      try {
        const response = await api.delete(`${PURCHASES_API_URL}/${id}`);
        
        if (response.data.success) {
          const updatedPayments = allPayments.filter(payment => payment.purchaseId !== id);
          setAllPayments(updatedPayments);
          
          await fetchPurchases();
          toast({
            title: "Success",
            description: "Purchase deleted successfully!",
          });
        } else {
          throw new Error(response.data.message || 'Failed to delete purchase');
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to delete purchase",
          variant: "destructive",
        });
      }
    }
  };

  const handleViewDetails = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseId(purchase._id);
    setShowDetails(true);
  };

  const handleAddNew = () => {
    setSelectedPurchaseForEdit(null);
    setIsEditMode(false);
    setDialogOpen(true);
  };

  const handleRecordPayment = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentModalOpen(true);
  };

  const handleMarkAsPaid = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseForPayment(purchase);
    setMarkAsPaidModalOpen(true);
  };

  const handleViewPaymentHistory = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseForPayment(purchase);
    setPaymentHistoryModalOpen(true);
  };

  const handlePaymentSuccess = async (newPayment: PaymentHistory) => {
    setAllPayments(prev => [...prev, newPayment]);
    await fetchPurchases();
    setPaymentModalOpen(false);
    setMarkAsPaidModalOpen(false);
    setSelectedPurchaseForPayment(null);
  };

  const filteredPurchases = purchases.filter(purchase =>
    purchase.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.receiptNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDateTime = (dateString: string) => {
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

  const totals = calculateTotals();

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredPurchases.slice(startIndex, endIndex);

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
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="w-8 h-6 border-2 border-primary rounded-sm flex items-center justify-center">
          <div className="w-4 h-0.5 bg-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Point Of Purchase (POP)</h1>
      </div>

      {/* Updated Totals Section */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Purchases</p>
              <p className="text-2xl font-semibold text-foreground">{totals.totalPurchases}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Price</p>
              <p className="text-2xl font-semibold text-foreground">
                Rs. {formatCurrency(totals.totalPrice)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Amount Paid</p>
              <p className="text-2xl font-semibold text-green-600">
                Rs. {formatCurrency(totals.totalAmountPaid)}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Remaining Amount</p>
              <p className="text-2xl font-semibold text-red-600">
                Rs. {formatCurrency(totals.totalRemainingAmount)}
              </p>
            </div>
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Weight</p>
              <p className="text-2xl font-semibold text-purple-600">
                {formatCurrency(totals.totalWeight)} kg
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="text-red-600">Sold: {formatCurrency(totals.totalSoldWeight)} kg</span>
                  <span className="mx-1">•</span>
                  <span className="text-green-600">Remaining: {formatCurrency(totals.totalRemainingWeight)} kg</span>
                </div>
              </div>
            </div>
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

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
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Receipt No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Amount Paid</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Payment Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Sold Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Stock Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vehicle No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date & Time</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((purchase, index) => {
                  return (
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
                          <span className="text-sm font-medium text-foreground">{purchase.receiptNo || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{purchase.materialName || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{purchase.quality || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-semibold">
                        Rs. {formatCurrency(purchase.price || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                        Rs. {formatCurrency(purchase.amountPaid || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-semibold ${
                          purchase.remainingAmount > 0 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          Rs. {formatCurrency(purchase.remainingAmount || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={purchase.paidAmount || 'none'} />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{formatCurrency(purchase.totalWeight)} kg</div>
                        <div className="text-xs text-muted-foreground">Original: {formatCurrency(purchase.weight)} kg</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className={`font-medium ${purchase.soldWeight > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                          {formatCurrency(purchase.soldWeight)} kg
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className={`font-medium ${
                          purchase.remainingWeight > 0 
                            ? 'text-green-600' 
                            : purchase.remainingWeight === 0 
                              ? 'text-amber-600' 
                              : 'text-red-600'
                        }`}>
                          {formatCurrency(purchase.remainingWeight)} kg
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StockStatusBadge status={purchase.status || 'available'} />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{purchase.vendor || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{purchase.vehicleNumber || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm text-primary">{formatDateTime(purchase.purchaseDate || purchase.createdAt)}</td>
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
                          {purchase.paidAmount !== 'paid' && purchase.remainingAmount > 0 && (
                            <button 
                              onClick={() => handleRecordPayment(purchase)}
                              className="p-1.5 hover:bg-green-100 rounded transition-colors text-muted-foreground hover:text-green-600"
                              title="Record Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {purchase.paidAmount !== 'paid' && purchase.remainingAmount > 0 && (
                            <button 
                              onClick={() => handleMarkAsPaid(purchase)}
                              className="p-1.5 hover:bg-blue-100 rounded transition-colors text-muted-foreground hover:text-blue-600"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {(purchase.amountPaid || 0) > 0 && (
                            <button 
                              onClick={() => handleViewPaymentHistory(purchase)}
                              className="p-1.5 hover:bg-purple-100 rounded transition-colors text-muted-foreground hover:text-purple-600"
                              title="Payment History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
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
                  );
                })}
              </tbody>
            </table>

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

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddPurchase}
        isEdit={isEditMode}
        editData={selectedPurchaseForEdit}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPurchaseForPayment(null);
        }}
        purchase={selectedPurchaseForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <MarkAsPaidModal
        open={markAsPaidModalOpen}
        onClose={() => {
          setMarkAsPaidModalOpen(false);
          setSelectedPurchaseForPayment(null);
        }}
        purchase={selectedPurchaseForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <PaymentHistoryModal
        open={paymentHistoryModalOpen}
        onClose={() => {
          setPaymentHistoryModalOpen(false);
          setSelectedPurchaseForPayment(null);
        }}
        purchase={selectedPurchaseForPayment}
        allPayments={allPayments}
      />
    </div>
  );
}

export default POPView;