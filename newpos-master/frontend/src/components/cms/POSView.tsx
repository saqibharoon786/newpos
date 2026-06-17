import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Save, Upload, Calendar, Clock, X, Package, ChevronDown, CheckCircle, DollarSign, History, Users, Download, FileText } from "lucide-react";
import { AddSaleDialog } from "./AddSaleDialog"; // CHANGED: Import AddSaleDialog instead of AddAssetDialog
import { SaleDetailsView } from "./SaleDetailsView";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { exportAsCsv, exportAsExcelTable, exportAsWordTable, exportAsPdf, inDateRange, toYmd } from "@/lib/exportUtils";

const SALES_API_URL = "/api/sales";
const PURCHASES_API_URL = "/api/purchases";

interface Sale {
  _id: string;
  materialName: string;
  supplierName: string;
  invoiceNo: string;
  weight: string;
  unit: string;
  purchaseDate: string;
  branch: string;
  quality?: string;
  materialColor: string;
  actualPrice: string;
  productionCost: string;
  sellingPrice: string;
  discount: string;
  advancePayment: number;
  
  // Payment tracking fields
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: 'none' | 'partial' | 'paid';
  
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerCnic: string;
  buyerCompany: string;
  finalAmount: string;
  receiptImage?: string;
  
  // Vehicle Details - These might be populated from purchase
  vehicleName?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  vehicleColor?: string;
  deliveryDate?: string;
  vehicleImage?: string;
  
  // Purchase Reference (if linked)
  purchaseId?: string;
  
  createdAt: string;
  updatedAt: string;

  paymentLedger?: Array<{
    _id?: string;
    date: string;
    amount: number;
    method: string;
    notes?: string;
    clientPaymentId?: string;
  }>;
}

interface PaymentHistory {
  _id: string;
  saleId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
  invoiceNo?: string;
  materialName?: string;
}

function paymentsFromSales(sales: Sale[]): PaymentHistory[] {
  const out: PaymentHistory[] = [];
  for (const sale of sales) {
    for (const p of sale.paymentLedger || []) {
      const dateStr =
        typeof p.date === "string"
          ? p.date.slice(0, 10)
          : new Date(p.date).toISOString().slice(0, 10);
      out.push({
        _id: p.clientPaymentId || p._id || `${sale._id}_${dateStr}_${p.amount}`,
        saleId: sale._id,
        amount: p.amount,
        paymentDate: dateStr,
        paymentMethod: p.method || "cash",
        notes: p.notes,
        invoiceNo: sale.invoiceNo,
        materialName: sale.materialName,
      });
    }
  }
  return out;
}

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

const PaymentModal = ({ 
  open, 
  onClose, 
  sale, 
  onPaymentSuccess 
}: { 
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
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
    if (open && sale) {
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
  }, [open, sale]);

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
    if (!sale) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    const remainingAmount = parseFloat(sale.finalAmount || sale.sellingPrice) - sale.amountPaid;
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
      const newAmountPaid = sale.amountPaid + amount;
      const newPaymentStatus = newAmountPaid >= parseFloat(sale.finalAmount || sale.sellingPrice) ? 'paid' : 
                              newAmountPaid > 0 ? 'partial' : 'none';
      const newRemainingAmount = parseFloat(sale.finalAmount || sale.sellingPrice) - newAmountPaid;
      
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        saleId: sale._id,
        amount: amount,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        notes: notes || `Payment of Rs. ${amount.toLocaleString()}`,
        invoiceNo: sale.invoiceNo,
        materialName: sale.materialName
      };

      const updateData = {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus,
        remainingAmount: newRemainingAmount,
        paymentMethod: paymentMethod.toLowerCase(),
        paymentDate: paymentDate,
        paymentNotes: paymentRecord.notes,
        clientPaymentId: paymentRecord._id,
      };

      const response = await api.put(
        `${SALES_API_URL}/${sale._id}`,
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

  if (!open || !sale) return null;

  const remainingAmount = parseFloat(sale.finalAmount || sale.sellingPrice) - sale.amountPaid;

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
              Sale #{sale.invoiceNo} - {sale.materialName}
            </p>
          </div>

          <div className="mb-6 p-4 bg-cms-card rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {parseFloat(sale.finalAmount || sale.sellingPrice).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Received</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {sale.amountPaid.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Receivable (Baqi)</p>
              <p className="text-xl font-bold text-red-600">
                Rs. {remainingAmount.toLocaleString()}
              </p>
            </div>
            <div className="mt-3">
              <PaymentStatusBadge status={sale.paymentStatus} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Received *</label>
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
                <option value="cash">Cash (Drawer)</option>
                <option value="jazzcash">JazzCash</option>
                <option value="easypaisa">EasyPaisa</option>
                <option value="bank">Bank</option>
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
  sale, 
  onPaymentSuccess 
}: { 
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  onPaymentSuccess: (paymentRecord: PaymentHistory) => void;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  const handleMarkPaid = async () => {
    if (!sale) return;

    setIsSubmitting(true);
    try {
      const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice);
      const remainingAmount = totalAmount - sale.amountPaid;
      const method = paymentMethod.toLowerCase();
      
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        saleId: sale._id,
        amount: remainingAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: method,
        notes: 'Marked as fully paid',
        invoiceNo: sale.invoiceNo,
        materialName: sale.materialName
      };

      const updateData = {
        amountPaid: totalAmount,
        paymentStatus: 'paid',
        remainingAmount: 0,
        paymentMethod: method,
        paymentDate: paymentRecord.paymentDate,
        paymentNotes: paymentRecord.notes,
        clientPaymentId: paymentRecord._id,
      };

      const response = await api.put(
        `${SALES_API_URL}/${sale._id}`,
        updateData
      );

      if (response.data.success) {
        toast({
          title: "Success",
          description: `Sale marked as fully paid!`,
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

  if (!open || !sale) return null;

  const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice);
  const remainingAmount = totalAmount - sale.amountPaid;

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
              Are you sure you want to mark this sale as fully paid?
            </p>
          </div>

          <div className="mb-6 p-4 bg-cms-card rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currently Paid</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {sale.amountPaid.toLocaleString()}
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
              <PaymentStatusBadge status={sale.paymentStatus} />
              <span className="text-xs text-muted-foreground">→</span>
              <PaymentStatusBadge status={'paid'} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground"
            >
              <option value="cash">Cash (Drawer)</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">JazzCash / EasyPaisa / Bank payments are added to Finance → Deposit.</p>
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
  sale,
  allPayments
}: {
  open: boolean;
  onClose: () => void;
  sale: Sale | null;
  allPayments: PaymentHistory[];
}) => {
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sale) {
      fetchPaymentHistory();
    }
  }, [open, sale]);

  const fetchPaymentHistory = () => {
    if (!sale) return;
    
    setLoading(true);
    try {
      const salePayments = allPayments.filter(
        payment => payment.saleId === sale._id
      );
      
      const sortedPayments = [...salePayments].sort((a, b) => 
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

  if (!open || !sale) return null;

  const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice);
  const remainingAmount = totalAmount - sale.amountPaid;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center sticky top-0 z-10">
          <div>
            <p className="text-xs text-muted-foreground">Payment History</p>
            <h2 className="text-lg font-bold text-foreground">
              Sale #{sale.invoiceNo} — {sale.materialName}
            </h2>
            <p className="text-sm font-medium text-foreground mt-1">
              Customer: {sale.buyerName || 'N/A'}
            </p>
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
            <div className="mb-4 pb-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Customer Name</p>
              <p className="text-base font-semibold text-foreground">{sale.buyerName || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-lg font-semibold text-foreground">
                  Rs. {totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Received</p>
                <p className="text-lg font-semibold text-green-600">
                  Rs. {sale.amountPaid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receivable (Baqi)</p>
                <p className="text-lg font-bold text-red-600">
                  Rs. {remainingAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <div className="mt-1">
                  <PaymentStatusBadge status={sale.paymentStatus} />
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Total Payments: {paymentHistory.length} | 
              Total Paid: Rs. {sale.amountPaid.toLocaleString()} | 
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
                        Rs. {sale.amountPaid.toLocaleString()}
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
                        Rs. {totalAmount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={2}>
                        Sale Price
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
              For a sale of Rs. 7,500, you can record payments like:
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

/** Modal: pay combined total for a customer; amount is distributed across sales (FIFO). */
const PayTotalModal = ({
  open,
  onClose,
  customerName,
  sales,
  totalRemaining,
  onSuccess,
  formatCurrency,
}: {
  open: boolean;
  onClose: () => void;
  customerName: string;
  sales: Sale[];
  totalRemaining: number;
  onSuccess: () => void;
  formatCurrency: (n: number) => string;
}) => {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && totalRemaining > 0) {
      setPaymentAmount(String(totalRemaining));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("cash");
      setNotes("");
    }
  }, [open, totalRemaining]);

  const handleSubmit = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (amount > totalRemaining) {
      toast({
        title: "Error",
        description: `Amount cannot exceed total remaining Rs. ${formatCurrency(totalRemaining)}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const records: PaymentHistory[] = [];
    let left = amount;
    try {
      for (const sale of sales) {
        if (left <= 0) break;
        const saleRemaining = sale.remainingAmount ?? (parseFloat(sale.finalAmount || sale.sellingPrice) - (sale.amountPaid || 0));
        const pay = Math.min(left, saleRemaining);
        if (pay <= 0) continue;

        const newAmountPaid = (sale.amountPaid || 0) + pay;
        const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice);
        const newPaymentStatus = newAmountPaid >= totalAmount ? "paid" : "partial";
        const newRemainingAmount = Math.max(0, totalAmount - newAmountPaid);

        const paymentRecord: PaymentHistory = {
          _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          saleId: sale._id,
          amount: pay,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          notes: notes || `Payment Rs. ${formatCurrency(pay)}`,
          invoiceNo: sale.invoiceNo,
          materialName: sale.materialName,
        };

        await api.put(`${SALES_API_URL}/${sale._id}`, {
          amountPaid: newAmountPaid,
          paymentStatus: newPaymentStatus,
          remainingAmount: newRemainingAmount,
          paymentMethod: paymentMethod.toLowerCase(),
          paymentDate: paymentDate,
          paymentNotes: paymentRecord.notes,
          clientPaymentId: paymentRecord._id,
        });

        records.push(paymentRecord);
        left -= pay;
      }

      toast({
        title: "Success",
        description: `Payment of Rs. ${formatCurrency(amount)} recorded.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || sales.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md">
        <div className="bg-cms-table-header px-4 py-3 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground">Receive total — {customerName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-cms-card-hover rounded">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-3 bg-cms-card rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">Total remaining</p>
            <p className="text-xl font-bold text-red-600">Rs. {formatCurrency(totalRemaining)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Amount Received</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2 text-foreground"
              min={0}
              step={1}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2 text-foreground"
            >
              <option value="cash">Cash (Drawer)</option>
              <option value="jazzcash">JazzCash</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2 text-foreground"
              placeholder="Notes"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-cms-card-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? "Saving…" : "Received"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export function POSView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [showDialog, setShowDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [markAsPaidModalOpen, setMarkAsPaidModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<Sale | null>(null);
  const [customerPayModalOpen, setCustomerPayModalOpen] = useState(false);
  const [customerViewPaymentsModalOpen, setCustomerViewPaymentsModalOpen] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [customerViewDateFilter, setCustomerViewDateFilter] = useState<string>("");
  const [payTotalModalOpen, setPayTotalModalOpen] = useState(false);
  const [payTotalData, setPayTotalData] = useState<{ customerName: string; sales: Sale[]; totalRemaining: number } | null>(null);
  
  const [allPayments, setAllPayments] = useState<PaymentHistory[]>([]);
  const [paymentsSynced, setPaymentsSynced] = useState(false);

  const loadPaymentsFromSales = async (salesData: Sale[]) => {
    let data = salesData;
    if (!paymentsSynced) {
      const savedPayments = localStorage.getItem("sale_payments");
      if (savedPayments) {
        try {
          const local = JSON.parse(savedPayments);
          if (Array.isArray(local) && local.length > 0) {
            await api.post(`${SALES_API_URL}/sync-payments`, { payments: local });
            const res2 = await api.get(SALES_API_URL);
            if (res2.data?.success) {
              data = res2.data.data || salesData;
              setSales(data);
            }
          }
        } catch {
          /* legacy sync optional */
        }
      }
      setPaymentsSynced(true);
    }
    setAllPayments(paymentsFromSales(data));
  };

  // Fetch sales on component mount
  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch sales data
      const salesResponse = await api.get(SALES_API_URL);
      
      if (salesResponse.data.success) {
        let salesData = salesResponse.data.data || [];
        
        // If sales don't have vehicle details, try to fetch from purchases
        if (salesData.length > 0 && !salesData[0].vehicleNumber) {
          // Fetch purchases to get vehicle details
          const purchasesResponse = await api.get(`${PURCHASES_API_URL}/get-all`);
          
          if (purchasesResponse.data.success) {
            const purchases = purchasesResponse.data.data || [];
            
            // Create a map of material name to purchase (for linking)
            const purchaseMap = new Map();
            purchases.forEach((purchase: any) => {
              purchaseMap.set(purchase.materialName, purchase);
            });
            
            // Enrich sales data with vehicle details from purchases
            salesData = salesData.map((sale: Sale) => {
              const purchase = purchaseMap.get(sale.materialName);
              if (purchase) {
                return {
                  ...sale,
                  vehicleName: purchase.vehicleName || '',
                  vehicleType: purchase.vehicleType || '',
                  vehicleNumber: purchase.vehicleNumber || '',
                  driverName: purchase.driverName || '',
                  vehicleColor: purchase.vehicleColor || '',
                  deliveryDate: purchase.deliveryDate || '',
                  vehicleImage: purchase.vehicleImage || '',
                  purchaseId: purchase._id
                };
              }
              return sale;
            });
          }
        }
        
        setSales(salesData);
        await loadPaymentsFromSales(salesData);
      } else {
        throw new Error(salesResponse.data.message || 'Failed to fetch sales');
      }
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      const msg = error.response?.data?.message || error.message || 'Failed to fetch sales';
      setError(msg);
      toast({
        title: "Error",
        description:
          msg === "Please login to continue"
            ? "Please login again — session expired"
            : `Failed to load sales: ${msg}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSale = async () => {
    await fetchSales();
    setShowDialog(false); // Close the dialog after saving
  };

  const handleEdit = (sale: Sale) => {
    setSelectedSale(sale);
    setIsEditMode(true);
    setShowDialog(true);
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSaleId(sale._id);
    setShowDetails(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this sale?')) {
      try {
        await api.delete(`${SALES_API_URL}/${id}`);
        
        // Remove payments associated with this sale
        const updatedPayments = allPayments.filter(payment => payment.saleId !== id);
        setAllPayments(updatedPayments);
        
        await fetchSales();
        toast({
          title: "Success",
          description: "Sale deleted successfully!",
        });
      } catch (error: any) {
        console.error('Error deleting sale:', error);
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to delete sale",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddNew = () => {
    setSelectedSale(null);
    setIsEditMode(false);
    setShowDialog(true);
  };

  const handleRecordPayment = (sale: Sale) => {
    setSelectedSaleForPayment(sale);
    setPaymentModalOpen(true);
  };

  const handleMarkAsPaid = (sale: Sale) => {
    setSelectedSaleForPayment(sale);
    setMarkAsPaidModalOpen(true);
  };

  const handleViewPaymentHistory = (sale: Sale) => {
    setSelectedSaleForPayment(sale);
    setPaymentHistoryModalOpen(true);
  };

  const handleDeleteCustomer = async (customerName: string) => {
    if (!confirm(`Are you sure you want to delete all sales to customer "${customerName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const customerSales = sales.filter(s => (s.buyerName || "").trim() === customerName);
      for (const sale of customerSales) {
        await api.delete(`${SALES_API_URL}/${sale._id}`);
      }
      
      toast({
        title: "Success",
        description: `Deleted all sales to customer "${customerName}"`,
      });
      
      await fetchSales();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete customer sales",
        variant: "destructive",
      });
    }
  };

  const handlePaymentSuccess = async (_newPayment: PaymentHistory) => {
    await fetchSales();
    setPaymentModalOpen(false);
    setMarkAsPaidModalOpen(false);
    setSelectedSaleForPayment(null);
  };

  // Filter sales based on search term
  const filteredSales = sales.filter(sale => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (sale.materialName?.toLowerCase() || '').includes(searchLower) ||
      (sale.supplierName?.toLowerCase() || '').includes(searchLower) ||
      (sale.invoiceNo?.toLowerCase() || '').includes(searchLower) ||
      (sale.buyerName?.toLowerCase() || '').includes(searchLower) ||
      (sale.vehicleNumber?.toLowerCase() || '').includes(searchLower) ||
      (sale.buyerPhone?.toLowerCase() || '').includes(searchLower) ||
      (sale.buyerEmail?.toLowerCase() || '').includes(searchLower)
    );
  });

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

  // Format currency - REMOVED CURRENCY SYMBOL
  const formatCurrency = (amount: number) => {
    try {
      if (isNaN(amount)) return '0';
      return amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } catch (error) {
      return '0';
    }
  };

  const getExportSales = () => {
    return filteredSales.filter((sale) =>
      inDateRange(sale.purchaseDate || sale.createdAt, exportStartDate || undefined, exportEndDate || undefined)
    );
  };

  const handleExportSales = (format: "excel" | "word" | "pdf") => {
    const exportRows = getExportSales();
    if (exportRows.length === 0) {
      toast({
        title: "No data",
        description: "No POS records found for selected date range.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Date",
      "Invoice No",
      "Material",
      "Customer",
      "Weight (kg)",
      "Units",
      "Total Amount",
      "Payment Received",
      "Receivable (Baqi)",
      "Payment Status",
    ];
    const rows = exportRows.map((sale) => ({
      "Date": formatDate(sale.purchaseDate || sale.createdAt),
      "Invoice No": sale.invoiceNo || "N/A",
      "Material": sale.materialName || "N/A",
      "Customer": sale.buyerName || "N/A",
      "Weight (kg)": sale.weight || "0",
      "Units": sale.unit || "0",
      "Total Amount": parseFloat(sale.finalAmount || sale.sellingPrice) || 0,
      "Payment Received": sale.amountPaid || 0,
      "Receivable (Baqi)": sale.remainingAmount || 0,
      "Payment Status": sale.paymentStatus || "none",
    }));
    const rangeText =
      exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : toYmd(new Date());

    if (format === "excel") {
      exportAsExcelTable(`POS_Report_${rangeText}.xls`, "POS Report", headers, rows);
    } else if (format === "pdf") {
      const body = rows
        .map(
          (r) =>
            `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`).join("")}</tr>`
        )
        .join("");
      exportAsPdf(
        "POS Report",
        `<table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`
      );
    } else {
      exportAsWordTable(`POS_Report_${rangeText}.doc`, "POS Report", headers, rows);
    }
    toast({
      title: "Export complete",
      description: `${exportRows.length} POS records exported.`,
    });
  };

const handleExportCustomerSummary = (format: "excel" | "word" | "pdf") => {
    if (!customerSummary || customerSummary.length === 0) {
      toast({
        title: "No data",
        description: "No customer summary data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Customer",
      "Sales",
      "Total Amount",
      "Payment Received",
      "Remaining",
      "Total Weight (kg)",
      "Total Units",
      "By Type (Paid)",
      "By Type (Weight)",
    ];

    const rows = customerSummary.map((row) => {
      const typePaid = row.qualityPaid
        ? Object.entries(row.qualityPaid)
            .filter(([, amt]) => (amt || 0) > 0)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([k, v]) => `${k}: ${formatCurrency(Number(v) || 0)}`)
            .join(" | ")
        : "";

      const typeWeight = row.qualityWeight
        ? Object.entries(row.qualityWeight)
            .filter(([, w]) => (w || 0) > 0)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([k, v]) => `${k}: ${Number(v).toLocaleString()} kg`)
            .join(" | ")
        : "";

      return {
        "Customer": row.customerName,
        "Sales": row.sales,
        "Total Amount": row.totalAmount,
        "Payment Received": row.amountPaid,
        "Remaining": row.remainingAmount,
        "Total Weight (kg)": row.weight,
        "Total Units": row.units,
        "By Type (Paid)": typePaid,
        "By Type (Weight)": typeWeight,
      };
    });

    const rangeText =
      exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : toYmd(new Date());

    if (format === "excel") {
      exportAsExcelTable(`POS_Customer_Summary_${rangeText}.xls`, "POS Customer-wise Summary", headers, rows);
    } else if (format === "pdf") {
      const body = `<table border="1" cellpadding="4"><thead><tr>${headers
        .map((h) => `<th>${h}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table>`;
      exportAsPdf("POS Customer-wise Summary", body);
    } else {
      exportAsWordTable(`POS_Customer_Summary_${rangeText}.doc`, "POS Customer-wise Summary", headers, rows);
    }

    toast({
      title: "Export complete",
      description: `${rows.length} customers exported.`,
    });
  };

  // Get vehicle number display - safe handling
  const getVehicleNumber = (sale: Sale) => {
    if (sale.vehicleNumber && sale.vehicleNumber.trim() !== '') {
      return sale.vehicleNumber;
    }
    
    // Try to get from other vehicle fields or show default
    if (sale.vehicleName || sale.driverName) {
      return 'Vehicle Assigned';
    }
    
    return 'N/A';
  };

  // Calculate totals
  const calculateTotals = () => {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((total, s) => total + (parseFloat(s.finalAmount || s.sellingPrice) || 0), 0);
    const totalAmountPaid = sales.reduce((total, s) => total + (s.amountPaid || 0), 0);
    const totalRemainingAmount = sales.reduce((total, s) => total + (s.remainingAmount || 0), 0);
    const totalUnitsSold = sales.reduce((total, s) => total + (parseInt(s.unit) || 0), 0);
    const totalWeightSold = sales.reduce((total, s) => total + (parseFloat(s.weight) || 0), 0);

    return {
      totalSales,
      totalRevenue,
      totalAmountPaid,
      totalRemainingAmount,
      totalUnitsSold,
      totalWeightSold
    };
  };

  const totals = calculateTotals();

  // Color hex to name helper for customer summary
  const colorOptions: { name: string; value: string }[] = [
    { name: "White", value: "#FFFFFF" },
    { name: "Yellow", value: "#FACC15" },
    { name: "Red", value: "#EF4444" },
    { name: "Blue", value: "#2563EB" },
    { name: "Orange", value: "#F97316" },
    { name: "Green", value: "#22C55E" },
    { name: "Black", value: "#000000" },
    { name: "Pink", value: "#EC4899" },
    { name: "Purple", value: "#A855F7" },
    { name: "Gray", value: "#6B7280" },
    { name: "Brown", value: "#92400E" },
  ];
  const getColorName = (hex: string) => {
    const c = colorOptions.find(o => (o.value || "").toLowerCase() === (hex || "").toLowerCase());
    return c ? c.name : (hex || "—");
  };

  // Customer-wise summary: total pay = sab items (HD, plastic bag, etc.) ki payment ka sum, with breakdown
  const customerSummary = useMemo(() => {
    const byCustomer: Record<string, {
      sales: number;
      totalAmount: number;
      amountPaid: number;
      remainingAmount: number;
      weight: number;
      units: number;
      qualities: Set<string>;
      colors: Set<string>;
      qualityWeight: Record<string, number>;
      qualityPaid: Record<string, number>;   // payment per quality (HD, Plastic bag, etc.)
      materialPaid: Record<string, number>;  // payment per material name
    }> = {};
    filteredSales.forEach((sale) => {
      const name = (sale.buyerName || "Unknown").trim() || "Unknown";
      const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice) || 0;
      const paid = sale.amountPaid || 0;
      const remaining = sale.remainingAmount || 0;
      const weight = parseFloat(sale.weight) || 0;
      const units = parseInt(sale.unit, 10) || 0;
      const quality = (sale as Sale & { quality?: string }).quality?.trim() || "Unknown";
      const materialName = (sale.materialName || "Unknown").trim() || "Unknown";
      const colorHex = sale.materialColor?.trim() || "";
      if (!byCustomer[name]) {
        byCustomer[name] = {
          sales: 0,
          totalAmount: 0,
          amountPaid: 0,
          remainingAmount: 0,
          weight: 0,
          units: 0,
          qualities: new Set<string>(),
          colors: new Set<string>(),
          qualityWeight: {},
          qualityPaid: {},
          materialPaid: {},
        };
      }
      byCustomer[name].sales += 1;
      byCustomer[name].totalAmount += totalAmount;
      byCustomer[name].amountPaid += paid;
      byCustomer[name].remainingAmount += remaining;
      byCustomer[name].weight += weight;
      byCustomer[name].units += units;
      if (quality) byCustomer[name].qualities.add(quality);
      if (colorHex) byCustomer[name].colors.add(colorHex);
      const qKey = quality || "Unknown";
      byCustomer[name].qualityWeight[qKey] = (byCustomer[name].qualityWeight[qKey] || 0) + weight;
      byCustomer[name].qualityPaid[qKey] = (byCustomer[name].qualityPaid[qKey] || 0) + paid;
      byCustomer[name].materialPaid[materialName] = (byCustomer[name].materialPaid[materialName] || 0) + paid;
    });
    return Object.entries(byCustomer).map(([customerName, data]) => ({
      customerName,
      sales: data.sales,
      totalAmount: data.totalAmount,
      amountPaid: data.amountPaid,
      remainingAmount: data.remainingAmount,
      weight: data.weight,
      units: data.units,
      qualities: Array.from(data.qualities).filter(Boolean).sort(),
      colors: Array.from(data.colors).filter(Boolean),
      qualityWeight: data.qualityWeight,
      qualityPaid: data.qualityPaid,
      materialPaid: data.materialPaid,
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredSales]);

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredSales.slice(startIndex, endIndex);

  // If showing details, render SaleDetailsView
  if (showDetails && selectedSaleId) {
    return (
      <SaleDetailsView 
        saleId={selectedSaleId} 
        onBack={() => {
          setShowDetails(false);
          setSelectedSaleId(null);
        }} 
      />
    );
  }

  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-3 sm:px-4 py-3 mb-4 sm:mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Point Of Sale (POS)</h1>
      </div>

      {/* Stats Cards - UPDATED with payment totals */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-semibold text-foreground">{totals.totalSales}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-semibold text-foreground">
                Rs. {formatCurrency(totals.totalRevenue)}
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
              <p className="text-sm text-muted-foreground">Payment Received</p>
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
              <p className="text-sm text-muted-foreground">Total Weight Sold</p>
              <p className="text-2xl font-semibold text-purple-600">
                {formatCurrency(totals.totalWeightSold)} kg
              </p>
              <p className="text-xs text-muted-foreground mt-1">{totals.totalUnitsSold} units</p>
            </div>
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Customer-wise Summary */}
      {customerSummary.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Customer-wise Summary
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExportCustomerSummary("excel")}
                className="px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={() => handleExportCustomerSummary("pdf")}
                className="px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                onClick={() => handleExportCustomerSummary("word")}
                className="px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Word
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customerSummary.map((row) => (
              <div
                key={row.customerName}
                className="bg-cms-card rounded-lg p-4 border border-border"
              >
                <div className="font-medium text-foreground mb-3 truncate" title={row.customerName}>
                  {row.customerName}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sales</span>
                    <span className="font-medium text-foreground">{row.sales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-foreground">Rs. {formatCurrency(row.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Received</span>
                    <span className="font-semibold text-green-600">Rs. {formatCurrency(row.amountPaid)}</span>
                  </div>
                  {row.qualityPaid && Object.keys(row.qualityPaid).length > 0 && (
                    <div className="pt-0.5 pl-1">
                      <span className="text-xs text-muted-foreground block mb-0.5">By type:</span>
                      <div className="space-y-0.5">
                        {Object.entries(row.qualityPaid)
                          .filter(([, amt]) => amt > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([q, amt]) => (
                            <div key={q} className="flex justify-between items-center text-xs">
                              <span className="text-foreground">{q}</span>
                              <span className="font-medium text-green-600">Rs. {formatCurrency(amt)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className={`font-semibold ${row.remainingAmount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      Rs. {formatCurrency(row.remainingAmount)}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-muted-foreground block mb-1">Quality (weight):</span>
                    {row.qualityWeight && Object.keys(row.qualityWeight).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(row.qualityWeight)
                          .sort((a, b) => b[1] - a[1])
                          .map(([q, w]) => (
                            <div key={q} className="flex justify-between items-center text-xs">
                              <span className="font-medium text-foreground">{q}</span>
                              <span className="font-semibold text-primary">{Number(w).toLocaleString()} kg</span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="text-xs text-foreground">—</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">Color:</span>
                    {row.colors.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.colors.map((hex) => (
                          <span key={hex} className="inline-flex items-center gap-1">
                            <span
                              className="w-3 h-3 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: hex }}
                              title={getColorName(hex)}
                            />
                            <span className="text-xs text-foreground">{getColorName(hex)}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-foreground">—</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                    <span>{row.weight} kg</span>
                    <span>{row.units} units</span>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <button
                      onClick={() => {
                        setSelectedCustomerName(row.customerName);
                        setCustomerPayModalOpen(true);
                      }}
                      disabled={row.remainingAmount <= 0}
                      className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Pay
                    </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedCustomerName(row.customerName);
                        setCustomerViewDateFilter("");
                        setCustomerViewPaymentsModalOpen(true);
                      }}
                      className="flex-1 px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(row.customerName)}
                      className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sales..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-72"
          />
        </div>
          <input
            type="date"
            value={exportStartDate}
            onChange={(e) => setExportStartDate(e.target.value)}
            className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            title="Export start date"
          />
          <input
            type="date"
            value={exportEndDate}
            onChange={(e) => setExportEndDate(e.target.value)}
            className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            title="Export end date"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => handleExportSales("excel")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => handleExportSales("word")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
          <button
            onClick={() => handleExportSales("pdf")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleAddNew}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sale
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
            <span className="ml-2 text-muted-foreground">Loading sales...</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No sales found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No sales match your search.' : 'Add your first sale to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add First Sale
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-cms-table-header">
                  <th className="text-left px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-foreground">Invoice No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Customer Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Units</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Payment Received</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Receivable (Baqi)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Payment Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vehicle No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((sale, index) => {
                  const totalAmount = parseFloat(sale.finalAmount || sale.sellingPrice) || 0;
                  const remainingAmount = sale.remainingAmount || 0;
                  
                  return (
                    <tr
                      key={sale._id}
                      className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'} hover:bg-cms-card-hover transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-foreground">{sale.invoiceNo || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-border"
                            style={{ backgroundColor: sale.materialColor || '#FFFFFF' }}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{sale.materialName || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground">{sale.supplierName || ''}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{sale.buyerName || 'N/A'}</span>
                          {sale.buyerPhone && (
                            <span className="text-xs text-muted-foreground">{sale.buyerPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {sale.weight || '0'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {sale.unit || '0'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">Rs. {formatCurrency(totalAmount)}</span>
                          <span className="text-xs text-muted-foreground">
                            {(() => {
                              const kg = parseFloat(sale.weight || "0") || 0;
                              const rate = kg > 0 ? totalAmount / kg : 0;
                              return kg > 0
                                ? `Rs. ${rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg`
                                : "";
                            })()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-green-600">
                            Rs. {formatCurrency(sale.amountPaid || 0)}
                          </span>
                          {sale.amountPaid > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {((sale.amountPaid / totalAmount) * 100).toFixed(1)}% of total
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            Rs. {formatCurrency(remainingAmount)}
                          </span>
                          {remainingAmount === 0 && sale.amountPaid > 0 && (
                            <span className="text-xs text-green-600">Paid in full</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={sale.paymentStatus} />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {getVehicleNumber(sale)}
                      </td>
                      <td className="px-4 py-3 text-sm text-primary">{formatDate(sale.purchaseDate || sale.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleViewDetails(sale)}
                            className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEdit(sale)}
                            className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {sale.paymentStatus !== 'paid' && remainingAmount > 0 && (
                            <button 
                              onClick={() => handleRecordPayment(sale)}
                              className="p-1.5 hover:bg-green-100 rounded transition-colors text-muted-foreground hover:text-green-600"
                              title="Record Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {sale.paymentStatus !== 'paid' && remainingAmount > 0 && (
                            <button 
                              onClick={() => handleMarkAsPaid(sale)}
                              className="p-1.5 hover:bg-blue-100 rounded transition-colors text-muted-foreground hover:text-blue-600"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {(sale.amountPaid || 0) > 0 && (
                            <button 
                              onClick={() => handleViewPaymentHistory(sale)}
                              className="p-1.5 hover:bg-purple-100 rounded transition-colors text-muted-foreground hover:text-purple-600"
                              title="Payment History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDelete(sale._id)}
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
            </div>

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

      {/* Payment Modals */}
      <PaymentModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedSaleForPayment(null);
        }}
        sale={selectedSaleForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <MarkAsPaidModal
        open={markAsPaidModalOpen}
        onClose={() => {
          setMarkAsPaidModalOpen(false);
          setSelectedSaleForPayment(null);
        }}
        sale={selectedSaleForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <PaymentHistoryModal
        open={paymentHistoryModalOpen}
        onClose={() => {
          setPaymentHistoryModalOpen(false);
          setSelectedSaleForPayment(null);
        }}
        sale={selectedSaleForPayment}
        allPayments={allPayments}
      />

      {/* Customer Pay Modal — total remaining + one Pay total button */}
      {customerPayModalOpen && selectedCustomerName && (() => {
        const customerSales = filteredSales.filter(
          (s) => (s.buyerName || "").trim() === selectedCustomerName && (s.remainingAmount || 0) > 0
        );
        const totalRemaining = customerSales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden flex flex-col">
              <div className="bg-cms-table-header px-4 py-3 border-b border-border flex justify-between items-center">
                <h3 className="text-sm font-semibold text-foreground">Pay — {selectedCustomerName}</h3>
                <button onClick={() => { setCustomerPayModalOpen(false); setSelectedCustomerName(null); }} className="p-1 hover:bg-cms-card-hover rounded">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground mb-2">Total remaining (all items combined):</p>
                <div className="p-4 rounded-lg border border-border bg-cms-card mb-4">
                  <p className="text-2xl font-bold text-red-600">Rs. {formatCurrency(totalRemaining)}</p>
                </div>
                {totalRemaining > 0 ? (
                  <button
                    onClick={() => {
                      setPayTotalData({ customerName: selectedCustomerName, sales: customerSales, totalRemaining });
                      setCustomerPayModalOpen(false);
                      setSelectedCustomerName(null);
                      setPayTotalModalOpen(true);
                    }}
                    className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Pay total
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No remaining amount to pay for this customer.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <PayTotalModal
        open={payTotalModalOpen}
        onClose={() => { setPayTotalModalOpen(false); setPayTotalData(null); }}
        customerName={payTotalData?.customerName ?? ""}
        sales={payTotalData?.sales ?? []}
        totalRemaining={payTotalData?.totalRemaining ?? 0}
        onSuccess={async () => {
          await fetchSales();
          setPayTotalModalOpen(false);
          setPayTotalData(null);
        }}
        formatCurrency={formatCurrency}
      />

      {/* Customer View Payments Modal - sara record is date ko, payment history */}
      {customerViewPaymentsModalOpen && selectedCustomerName && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-cms-table-header px-4 py-3 border-b border-border flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground">Payment records — {selectedCustomerName}</h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customerViewDateFilter}
                  onChange={(e) => setCustomerViewDateFilter(e.target.value)}
                  className="bg-cms-card border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
                  placeholder="Filter by date"
                />
                <button onClick={() => { setCustomerViewPaymentsModalOpen(false); setSelectedCustomerName(null); setCustomerViewDateFilter(""); }} className="p-1.5 hover:bg-cms-card-hover rounded">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {(() => {
                const customerSaleIds = filteredSales.filter((s) => (s.buyerName || "").trim() === selectedCustomerName).map((s) => s._id);
                let payments = allPayments.filter((p) => customerSaleIds.includes(p.saleId));
                if (customerViewDateFilter) {
                  payments = payments.filter((p) => p.paymentDate === customerViewDateFilter);
                }
                payments = [...payments].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
                const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
                return (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {customerViewDateFilter ? `Payments on ${customerViewDateFilter}` : "All payment records (date-wise)"}
                    </p>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No payment records found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-cms-table-header">
                              <th className="text-left px-3 py-2 font-medium text-foreground">Date</th>
                              <th className="text-left px-3 py-2 font-medium text-foreground">Invoice</th>
                              <th className="text-left px-3 py-2 font-medium text-foreground">Material</th>
                              <th className="text-left px-3 py-2 font-medium text-foreground">Amount</th>
                              <th className="text-left px-3 py-2 font-medium text-foreground">Method</th>
                              <th className="text-left px-3 py-2 font-medium text-foreground">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p, idx) => {
                              const sale = sales.find((s) => s._id === p.saleId);
                              return (
                                <tr key={p._id || idx} className={`border-t border-border ${idx % 2 === 0 ? "bg-cms-table-row" : "bg-cms-table-row-alt"}`}>
                                  <td className="px-3 py-2 text-foreground">
                                    {new Date(p.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </td>
                                  <td className="px-3 py-2 text-foreground">{p.invoiceNo || (sale?.invoiceNo ?? "—")}</td>
                                  <td className="px-3 py-2 text-foreground">{p.materialName || (sale?.materialName ?? "—")}</td>
                                  <td className="px-3 py-2 font-semibold text-green-600">Rs. {p.amount.toLocaleString()}</td>
                                  <td className="px-3 py-2 text-foreground capitalize">{(p.paymentMethod || "").replace("_", " ")}</td>
                                  <td className="px-3 py-2 text-muted-foreground">{p.notes || "—"}</td>
                                </tr>
                              );
                            })}
                            <tr className="border-t-2 border-border bg-cms-card">
                              <td className="px-3 py-2 font-semibold text-foreground" colSpan={3}>Total</td>
                              <td className="px-3 py-2 font-bold text-green-600">Rs. {totalAmount.toLocaleString()}</td>
                              <td className="px-3 py-2 text-muted-foreground" colSpan={2}>{payments.length} payment(s)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog - UNCOMMENTED AND CORRECTED */}
      <AddSaleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSave={handleAddSale}
        isEdit={isEditMode}
        editData={selectedSale}
      />
    </div>
  );
}