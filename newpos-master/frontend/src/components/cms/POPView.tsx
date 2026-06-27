import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Save, Upload, Calendar, Clock, X, Package, ChevronDown, CheckCircle, DollarSign, History, Wallet, Smartphone, Building, Download, FileText } from "lucide-react";
import { PurchaseDetailsView } from "./PurchaseDetailsView";
import { toast } from "@/hooks/use-toast";
import api, { API_BASE_URL } from "@/lib/api";
import { canApprove, getCurrentUser } from "@/lib/auth";
import { PRODUCT_CODES, getMaterialNameForCode, getProductByCode } from "@/lib/productCodes";
import { exportAsCsv, exportAsExcelTable, exportAsWordTable, exportAsPdf, inDateRange, toYmd } from "@/lib/exportUtils";
import { getPurchaseTotalPaid, getPurchaseRemainingAmount, getPurchasePaidStatus, getPurchasePrice } from "@/lib/purchasePayment";
import { fetchCompanySettings, getLogoUrl } from "@/lib/companySettings";

// API endpoints
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;
const FINANCE_API_URL = `${API_BASE_URL}/api/finance`;

// Finance API functions with all payment methods
const financeApi = {
  // Get all balances
  getAllBalances: async () => {
    try {
      const response = await api.get(`${FINANCE_API_URL}/balances`);
      if (response.data.success) {
        return response.data.balances || {
          drawer: 0,
          easypaisa: 0,
          jazzcash: 0,
          bank: 0,
        };
      }
      return {
        drawer: 0,
        easypaisa: 0,
        jazzcash: 0,
        bank: 0,
      };
    } catch (error) {
      console.error("Error fetching balances:", error);
      return {
        drawer: 0,
        easypaisa: 0,
        jazzcash: 0,
        bank: 0,
      };
    }
  },

  // Update balance for specific payment method
  updateBalance: async (method: string, amount: number, description: string, type: 'withdraw' | 'deposit' = 'withdraw') => {
    try {
      const endpoint = type === 'withdraw' ? 'withdraw' : 'deposit';
      const response = await api.post(`${FINANCE_API_URL}/${endpoint}`, {
        method: method,
        amount: amount,
        description: description
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error updating ${method} balance:`, error);
      throw error;
    }
  },

  // Get method label
  getMethodLabel: (method: string) => {
    const labels: Record<string, string> = {
      drawer: 'Cash Drawer',
      easypaisa: 'Easypaisa',
      jazzcash: 'JazzCash',
      bank: 'Bank Account',
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      online: 'Online Payment',
      other: 'Other'
    };
    return labels[method] || method;
  },

  // Get method icon
  getMethodIcon: (method: string, className = "w-4 h-4") => {
    const m = method.toLowerCase().replace(' ', '');
    switch (m) {
      case 'drawer':
      case 'cashdrawer':
      case 'cash':
        return <Wallet className={className} />;
      case 'easypaisa':
        return <Smartphone className={className} />;
      case 'jazzcash':
        return <Smartphone className={className} />;
      case 'bank':
      case 'bankaccount':
      case 'bank_transfer':
        return <Building className={className} />;
      default:
        return <Wallet className={className} />;
    }
  }
};

const CALENDAR_POPOVER_WIDTH = 320;

function getCalendarPopoverPosition(anchor: HTMLElement | null) {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left;
  const top = rect.bottom + 4;
  if (left + CALENDAR_POPOVER_WIDTH > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - CALENDAR_POPOVER_WIDTH - 8);
  }
  if (left < 8) left = 8;
  return { top, left };
}

interface PurchaseMaterial {
  name: string;
  weight: number;
  pricePerKg: number;
  totalAmount: number;
  productCode: string;
}

interface VendorMaterialProfile {
  productCode: string;
  materialName: string;
  pricePerKg: number;
  defaultWeight?: number;
}

interface VendorOption {
  _id: string;
  vendorId?: string;
  name: string;
  phone?: string;
  materials?: VendorMaterialProfile[];
}

interface MaterialCatalogItem {
  _id: string;
  name: string;
  productCode?: string;
  defaultPricePerKg?: number;
}

interface PurchaseMaterialRow {
  name: string;
  weight: string;
  pricePerKg: string;
  productCode: string;
}

interface VendorBalance {
  payableBalance: number;
  advanceBalance: number;
  netBalance?: number;
}

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
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  materials?: PurchaseMaterial[];
  materialColor: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  vehicleColor: string;
  deliveryDate: string;
  deliveryTime?: string;
  invoiceNo?: string;
  billNo?: string;
  receiptNo: string;
  vehicleImage: string;
  advancePayment: number;
  amountPaid: number;
  totalPaid?: number;
  paidAmount: 'none' | 'partial' | 'paid';
  remainingAmount: number;
  status: 'available' | 'partially_sold' | 'sold_out';
  createdAt: string;
  updatedAt: string;
}

interface PurchaseWithRemaining extends Purchase {
  totalWeight: number; // Original weight (same as weight field)
  soldWeight: number; // Already exists in Purchase (sales from POP)
  processWeight?: number; // Weight sent to processing (productionConsumedWeight)
  remainingWeight: number; // Already exists in Purchase
  materialColorName: string;
  materialColorSearchNames: string[];
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
  financeUpdated?: boolean;
  financeMethod?: string;
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF", searchNames: ["white", "safed"] },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15", searchNames: ["yellow", "peela", "pila"] },
  { name: "Red", color: "bg-red-500", value: "#EF4444", searchNames: ["red", "lal"] },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB", searchNames: ["blue", "neela", "nila"] },
  { name: "Orange", color: "bg-orange-500", value: "#F97316", searchNames: ["orange", "narangi"] },
  { name: "Green", color: "bg-green-500", value: "#22C55E", searchNames: ["green", "hara", "green"] },
  { name: "Black", color: "bg-black", value: "#000000", searchNames: ["black", "kala"] },
  { name: "Pink", color: "bg-pink-500", value: "#EC4899", searchNames: ["pink", "gulabi"] },
  { name: "Purple", color: "bg-purple-500", value: "#A855F7", searchNames: ["purple", "jamuni"] },
  { name: "Gray", color: "bg-gray-500", value: "#6B7280", searchNames: ["gray", "grey", "surahi"] },
  { name: "Brown", color: "bg-amber-900", value: "#92400E", searchNames: ["brown", "bhoora"] },
];

// Function to get color name from hex value
const getColorName = (hexColor: string): string => {
  if (!hexColor) return "";
  
  // Convert to lowercase for comparison
  const hex = hexColor.toLowerCase();
  
  // Find matching color
  const color = colorOptions.find(c => 
    c.value.toLowerCase() === hex || 
    hex.includes(c.value.toLowerCase().replace('#', ''))
  );
  
  return color ? color.name.toLowerCase() : "";
};

// Function to get all searchable color names for a hex color
const getColorSearchNames = (hexColor: string): string[] => {
  if (!hexColor) return [];
  
  const hex = hexColor.toLowerCase();
  const color = colorOptions.find(c => 
    c.value.toLowerCase() === hex || 
    hex.includes(c.value.toLowerCase().replace('#', ''))
  );
  
  return color ? color.searchNames : [];
};

// Quality options with ability to add custom ones
const initialQualityOptions = [
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

// Vendor Summary Component
const VendorSummary = ({ 
  purchases, 
  searchTerm,
  onPayTotal,
  onViewPayments,
  onDeleteVendor
}: { 
  purchases: PurchaseWithRemaining[], 
  searchTerm: string,
  onPayTotal: (vendorName: string, vendorPurchases: PurchaseWithRemaining[], totalRemaining: number) => void,
  onViewPayments: (vendorName: string) => void,
  onDeleteVendor: (vendorName: string) => void
}) => {
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  
  const purchasesInRange = purchases.filter((p) =>
    inDateRange(p.purchaseDate || p.createdAt, exportStartDate || undefined, exportEndDate || undefined)
  );

  // Calculate vendor-wise summary
  const calculateVendorSummary = () => {
    const vendorSummary: Record<string, {
      totalPurchases: number;
      totalPrice: number;
      totalAmountPaid: number;
      totalRemainingAmount: number;
      totalWeight: number;
      totalProcessWeight: number;
      totalRemainingWeight: number;
      materials: {name: string, weight: number, remainingAmount: number}[];
      paymentStatus: {
        paid: number;
        partial: number;
        none: number;
      };
      stockStatus: {
        available: number;
        partially_sold: number;
        sold_out: number;
      };
    }> = {};
    
    purchasesInRange.forEach(purchase => {
      const vendor = purchase.vendor || 'Unknown';
      const price = purchase.price || 0;
      const amountPaid = getPurchaseTotalPaid(purchase);
      const remainingAmount = getPurchaseRemainingAmount(purchase);
      const weight = parseFloat(purchase.weight) || 0;
      const processWeight = purchase.processWeight ?? purchase.productionConsumedWeight ?? 0;
      const remainingWeight = purchase.remainingWeight || 0;
      
      if (!vendorSummary[vendor]) {
        vendorSummary[vendor] = {
          totalPurchases: 0,
          totalPrice: 0,
          totalAmountPaid: 0,
          totalRemainingAmount: 0,
          totalWeight: 0,
          totalProcessWeight: 0,
          totalRemainingWeight: 0,
          materials: [],
          paymentStatus: {
            paid: 0,
            partial: 0,
            none: 0
          },
          stockStatus: {
            available: 0,
            partially_sold: 0,
            sold_out: 0
          }
        };
      }
      
      // Update totals
      vendorSummary[vendor].totalPurchases += 1;
      vendorSummary[vendor].totalPrice += price;
      vendorSummary[vendor].totalAmountPaid += amountPaid;
      vendorSummary[vendor].totalRemainingAmount += remainingAmount;
      vendorSummary[vendor].totalWeight += weight;
      vendorSummary[vendor].totalProcessWeight += processWeight;
      vendorSummary[vendor].totalRemainingWeight += remainingWeight;
      
      // Add material if not already in list
      const materialExists = vendorSummary[vendor].materials.find(
        m => m.name === purchase.materialName
      );
      if (!materialExists) {
        vendorSummary[vendor].materials.push({
          name: purchase.materialName || 'Unknown',
          weight: weight,
          remainingAmount: remainingAmount
        });
      }
      
      // Update payment status count
      switch(getPurchasePaidStatus(purchase)) {
        case 'paid':
          vendorSummary[vendor].paymentStatus.paid += 1;
          break;
        case 'partial':
          vendorSummary[vendor].paymentStatus.partial += 1;
          break;
        case 'none':
          vendorSummary[vendor].paymentStatus.none += 1;
          break;
      }
      
      // Update stock status count
      switch(purchase.status) {
        case 'available':
          vendorSummary[vendor].stockStatus.available += 1;
          break;
        case 'partially_sold':
          vendorSummary[vendor].stockStatus.partially_sold += 1;
          break;
        case 'sold_out':
          vendorSummary[vendor].stockStatus.sold_out += 1;
          break;
      }
    });
    
    return vendorSummary;
  };
  
  const vendorSummary = calculateVendorSummary();
  
  if (purchases.length === 0) return null;

  const handleExportVendorSummary = (format: "excel" | "word" | "pdf") => {
    const headers = [
      "Vendor",
      "Total Purchases",
      "Total Price",
      "Amount Paid",
      "Remaining Amount",
      "Total Weight (kg)",
      "Used Weight (kg)",
      "Remaining Weight (kg)",
      "Payment Status Count",
      "Stock Status Count",
      "Materials",
    ];
    const rows = Object.entries(vendorSummary)
      .sort((a, b) => (b[1].totalRemainingAmount || 0) - (a[1].totalRemainingAmount || 0))
      .map(([vendorName, data]) => ({
        "Vendor": vendorName,
        "Total Purchases": data.totalPurchases,
        "Total Price": data.totalPrice,
        "Amount Paid": data.totalAmountPaid,
        "Remaining Amount": data.totalRemainingAmount,
        "Total Weight (kg)": Math.round((data.totalWeight || 0) * 100) / 100,
        "Used Weight (kg)": Math.round((data.totalProcessWeight || 0) * 100) / 100,
        "Remaining Weight (kg)": Math.round((data.totalRemainingWeight || 0) * 100) / 100,
        "Payment Status Count": `paid: ${data.paymentStatus.paid} | partial: ${data.paymentStatus.partial} | none: ${data.paymentStatus.none}`,
        "Stock Status Count": `available: ${data.stockStatus.available} | partial: ${data.stockStatus.partially_sold} | sold: ${data.stockStatus.sold_out}`,
        "Materials": (data.materials || []).map((m) => `${m.name} (${Math.round((m.weight || 0) * 100) / 100} kg)`).join(" | "),
      }));

    if (rows.length === 0) {
      toast({ title: "No data", description: "No vendor summary to export.", variant: "destructive" });
      return;
    }

    const suffix =
      exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : toYmd(new Date());

    if (format === "excel") {
      // Use .xls table to keep alignment/boxes clear in Excel
      exportAsExcelTable(`POP_Vendor_Summary_${suffix}.xls`, "POP Vendor-wise Summary", headers, rows);
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
      exportAsPdf("POP Vendor-wise Summary", body);
    } else {
      exportAsWordTable(`POP_Vendor_Summary_${suffix}.doc`, "POP Vendor-wise Summary", headers, rows);
    }
    toast({ title: "Export complete", description: `${rows.length} vendors exported.` });
  };
  
  return (
    <div className="bg-cms-card rounded-lg p-4 mb-6 border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Building className="w-5 h-5 text-primary" />
            Vendor Summary
            {searchTerm && (
              <span className="text-sm font-normal text-muted-foreground">
                (Filtered by: "{searchTerm}")
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Total: {Object.keys(vendorSummary).length} vendor{Object.keys(vendorSummary).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={exportStartDate}
            onChange={(e) => setExportStartDate(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="Start date"
          />
          <input
            type="date"
            value={exportEndDate}
            onChange={(e) => setExportEndDate(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="End date"
          />
          <button
            onClick={() => handleExportVendorSummary("excel")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors hover:bg-secondary"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            onClick={() => handleExportVendorSummary("pdf")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors hover:bg-secondary"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={() => handleExportVendorSummary("word")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2 transition-colors hover:bg-secondary"
          >
            <FileText className="w-3.5 h-3.5" />
            Word
          </button>
        </div>
      </div>
      
      {/* Vendor-wise Summary */}
      <div className="space-y-3">
        {Object.entries(vendorSummary)
          .sort((a, b) => b[1].totalRemainingAmount - a[1].totalRemainingAmount) // Sort by highest remaining amount
          .map(([vendorName, data]) => {
            const isExpanded = expandedVendor === vendorName;
            
            return (
              <div key={vendorName} className="bg-cms-table-header rounded-lg p-3 border border-border">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedVendor(isExpanded ? null : vendorName)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building className="w-3 h-3 text-primary" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-foreground capitalize">
                        {vendorName}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {data.totalPurchases} purchase{data.totalPurchases !== 1 ? 's' : ''} • 
                        {data.materials.length} material{data.materials.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Remaining Amount</div>
                      <div className={`text-sm font-bold ${
                        data.totalRemainingAmount > 0 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        Rs. {data.totalRemainingAmount.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Total Weight</div>
                      <div className="text-sm font-semibold text-foreground">
                        {data.totalWeight.toLocaleString()} kg
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    {/* Payment Summary */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">Payment Summary</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-background rounded p-2">
                          <div className="text-xs text-muted-foreground">Total Price</div>
                          <div className="text-sm font-semibold text-foreground">
                            Rs. {data.totalPrice.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-background rounded p-2">
                          <div className="text-xs text-muted-foreground">Amount Paid</div>
                          <div className="text-sm font-semibold text-green-600">
                            Rs. {data.totalAmountPaid.toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-background rounded p-2">
                          <div className="text-xs text-muted-foreground">Remaining Amount</div>
                          <div className={`text-sm font-bold ${
                            data.totalRemainingAmount > 0 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            Rs. {data.totalRemainingAmount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      {/* Payment Status Breakdown */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs text-muted-foreground">Paid: {data.paymentStatus.paid}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <span className="text-xs text-muted-foreground">Partial: {data.paymentStatus.partial}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-xs text-muted-foreground">Unpaid: {data.paymentStatus.none}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Weight Summary */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">Weight Summary</h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-background rounded p-2">
                          <div className="text-xs text-muted-foreground">Total Weight</div>
                          <div className="text-sm font-semibold text-foreground">
                            {data.totalWeight.toLocaleString()} kg
                          </div>
                        </div>
                        <div className="bg-background rounded p-2">
                      <div className="text-xs text-muted-foreground">Weight Used</div>
                      <div className="text-sm font-semibold text-primary">
                        {data.totalProcessWeight.toLocaleString()} kg
                      </div>
                        </div>
                        <div className="bg-background rounded p-2">
                          <div className="text-xs text-muted-foreground">Remaining</div>
                          <div className="text-sm font-semibold text-green-600">
                            {data.totalRemainingWeight.toLocaleString()} kg
                          </div>
                        </div>
                      </div>
                      
                      {/* Stock Status Breakdown */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs text-muted-foreground">Available: {data.stockStatus.available}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                          <span className="text-xs text-muted-foreground">Partially Sold: {data.stockStatus.partially_sold}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-xs text-muted-foreground">Sold Out: {data.stockStatus.sold_out}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Materials List */}
                    {data.materials.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-2">Materials Purchased</h4>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {data.materials.map((material, index) => (
                            <div key={index} className="flex justify-between items-center text-xs py-1.5 px-2 bg-background rounded">
                              <span className="text-foreground">{material.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-muted-foreground">{material.weight.toLocaleString()} kg</span>
                                <span className={`font-medium ${
                                  material.remainingAmount > 0 
                                    ? 'text-red-600' 
                                    : 'text-green-600'
                                }`}>
                                  Rs. {material.remainingAmount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => onViewPayments(vendorName)}
                          className="bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md py-2 px-3 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <History className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => onDeleteVendor(vendorName)}
                          className="bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-md py-2 px-3 text-sm font-medium transition-colors flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                      {data.totalRemainingAmount > 0 && (
                        <button
                          onClick={() => {
                            const vendorPurchases = purchases.filter(p => p.vendor === vendorName);
                            onPayTotal(vendorName, vendorPurchases, data.totalRemainingAmount);
                          }}
                          className="w-full bg-primary text-primary-foreground rounded-md py-2 px-4 text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <DollarSign className="w-4 h-4" />
                          Pay Total (Rs. {data.totalRemainingAmount.toLocaleString()})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      
      {/* Combined Summary Stats */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              {Object.keys(vendorSummary).length}
            </div>
            <div className="text-xs text-muted-foreground">Total Vendors</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              Rs. {Object.values(vendorSummary).reduce((sum, v) => sum + v.totalPrice, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Price</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              Rs. {Object.values(vendorSummary).reduce((sum, v) => sum + v.totalAmountPaid, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Paid</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              Rs. {Object.values(vendorSummary).reduce((sum, v) => sum + v.totalRemainingAmount, 0).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Total Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">
              {Object.values(vendorSummary).reduce((sum, v) => sum + v.totalWeight, 0).toLocaleString()} kg
            </div>
            <div className="text-xs text-muted-foreground">Total Weight</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// New Weight Summary Component
const WeightSummary = ({ 
  purchases, 
  searchTerm 
}: { 
  purchases: PurchaseWithRemaining[], 
  searchTerm: string 
}) => {
  const [summaryMode, setSummaryMode] = useState<'color' | 'quality' | 'both'>('both');
  
  // Calculate weight summary by color and quality
  const calculateWeightSummary = () => {
    const colorSummary: Record<string, {
      totalWeight: number;
      processWeight: number;
      remainingWeight: number;
      qualities: Record<string, {
        totalWeight: number;
        processWeight: number;
        remainingWeight: number;
      }>;
    }> = {};
    
    const qualitySummary: Record<string, {
      totalWeight: number;
      processWeight: number;
      remainingWeight: number;
      colors: Record<string, {
        totalWeight: number;
        processWeight: number;
        remainingWeight: number;
      }>;
    }> = {};
    
    purchases.forEach(purchase => {
      const colorName = purchase.materialColorName || 'Unknown';
      const quality = purchase.quality || 'Unknown';
      const weight = parseFloat(purchase.weight) || 0;
      const processWeight = purchase.processWeight ?? purchase.productionConsumedWeight ?? 0;
      const remainingWeight = purchase.remainingWeight || 0;
      
      // Color summary
      if (!colorSummary[colorName]) {
        colorSummary[colorName] = {
          totalWeight: 0,
          processWeight: 0,
          remainingWeight: 0,
          qualities: {}
        };
      }
      
      colorSummary[colorName].totalWeight += weight;
      colorSummary[colorName].processWeight += processWeight;
      colorSummary[colorName].remainingWeight += remainingWeight;
      
      // Quality within color
      if (!colorSummary[colorName].qualities[quality]) {
        colorSummary[colorName].qualities[quality] = {
          totalWeight: 0,
          processWeight: 0,
          remainingWeight: 0
        };
      }
      
      colorSummary[colorName].qualities[quality].totalWeight += weight;
      colorSummary[colorName].qualities[quality].processWeight += processWeight;
      colorSummary[colorName].qualities[quality].remainingWeight += remainingWeight;
      
      // Quality summary
      if (!qualitySummary[quality]) {
        qualitySummary[quality] = {
          totalWeight: 0,
          processWeight: 0,
          remainingWeight: 0,
          colors: {}
        };
      }
      
      qualitySummary[quality].totalWeight += weight;
      qualitySummary[quality].processWeight += processWeight;
      qualitySummary[quality].remainingWeight += remainingWeight;
      
      // Color within quality
      if (!qualitySummary[quality].colors[colorName]) {
        qualitySummary[quality].colors[colorName] = {
          totalWeight: 0,
          processWeight: 0,
          remainingWeight: 0
        };
      }
      
      qualitySummary[quality].colors[colorName].totalWeight += weight;
      qualitySummary[quality].colors[colorName].processWeight += processWeight;
      qualitySummary[quality].colors[colorName].remainingWeight += remainingWeight;
    });
    
    return { colorSummary, qualitySummary };
  };
  
  const { colorSummary, qualitySummary } = calculateWeightSummary();
  
  // Get color object from name
  const getColorObject = (colorName: string) => {
    return colorOptions.find(c => c.name.toLowerCase() === colorName.toLowerCase()) || 
           { name: colorName, color: "bg-gray-300", value: "#CCCCCC" };
  };
  
  if (purchases.length === 0) return null;
  
  return (
    <div className="bg-cms-card rounded-lg p-4 mb-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Weight Summary
            {searchTerm && (
              <span className="text-sm font-normal text-muted-foreground">
                (Filtered by: "{searchTerm}")
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">
            Total: {purchases.length} purchase{purchases.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">View:</span>
          <div className="flex bg-cms-table-header rounded-lg p-1">
            <button
              onClick={() => setSummaryMode('color')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${summaryMode === 'color' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              By Color
            </button>
            <button
              onClick={() => setSummaryMode('quality')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${summaryMode === 'quality' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              By Quality
            </button>
            <button
              onClick={() => setSummaryMode('both')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${summaryMode === 'both' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Both
            </button>
          </div>
        </div>
      </div>
      
      {/* Color-wise Summary */}
      {(summaryMode === 'color' || summaryMode === 'both') && (
        <div className={`${summaryMode === 'both' ? 'mb-6' : ''}`}>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-blue-500" />
            Color-wise Weight Distribution
          </h4>
          <p className="text-xs text-muted-foreground mb-3">Weight Used = amount put in machine. Remaining = Total − Weight Used.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(colorSummary)
              .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
              .map(([colorName, data]) => {
                const colorObj = getColorObject(colorName);
                const color = colorObj.value;
                
                return (
                  <div key={colorName} className="bg-cms-table-header rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium text-foreground capitalize">
                          {colorName}
                        </span>
                      </div>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {data.totalWeight.toLocaleString()} kg
                      </span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Weight:</span>
                        <span className="font-medium text-foreground">{data.totalWeight.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Weight Used:</span>
                        <span className="font-medium text-primary">{data.processWeight.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-medium text-green-600">{data.remainingWeight.toLocaleString()} kg</span>
                      </div>
                    </div>
                    
                    {/* Quality breakdown within this color */}
                    {Object.keys(data.qualities).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">Breakdown by Quality:</div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {Object.entries(data.qualities)
                            .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                            .map(([quality, qData]) => (
                              <div key={quality} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                                  <span className="text-foreground">{quality}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-green-600">{qData.remainingWeight.toLocaleString()} kg</span>
                                  <span className="text-xs text-muted-foreground">/</span>
                                  <span className="text-foreground">{qData.totalWeight.toLocaleString()} kg</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
      
      {/* Quality-wise Summary */}
      {(summaryMode === 'quality' || summaryMode === 'both') && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Quality-wise Weight Distribution
          </h4>
          <p className="text-xs text-muted-foreground mb-3">Weight Used = amount put in machine. Remaining = Total − Weight Used.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(qualitySummary)
              .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
              .map(([quality, data]) => (
                <div key={quality} className="bg-cms-table-header rounded-lg p-3 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                        <Package className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {quality}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                      {data.totalWeight.toLocaleString()} kg
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total Weight:</span>
                      <span className="font-medium text-foreground">{data.totalWeight.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Weight Used:</span>
                      <span className="font-medium text-primary">{data.processWeight.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Remaining:</span>
                      <span className="font-medium text-green-600">{data.remainingWeight.toLocaleString()} kg</span>
                    </div>
                  </div>
                  
                  {/* Color breakdown within this quality */}
                  {Object.keys(data.colors).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="text-xs text-muted-foreground mb-2">Breakdown by Color:</div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {Object.entries(data.colors)
                          .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                          .map(([colorName, cData]) => {
                            const colorObj = getColorObject(colorName);
                            return (
                              <div key={colorName} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: colorObj.value }}
                                  />
                                  <span className="text-foreground capitalize">{colorName}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-green-600">{cData.remainingWeight.toLocaleString()} kg</span>
                                  <span className="text-xs text-muted-foreground">/</span>
                                  <span className="text-foreground">{cData.totalWeight.toLocaleString()} kg</span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
      
      {/* Combined Summary Stats */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {purchases.reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0).toLocaleString()} kg
            </div>
            <div className="text-xs text-muted-foreground">Total Weight</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {purchases.reduce((sum, p) => sum + (p.processWeight ?? p.productionConsumedWeight ?? 0), 0).toLocaleString()} kg
            </div>
            <div className="text-xs text-muted-foreground">Total Weight Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {purchases.reduce((sum, p) => sum + (p.remainingWeight || 0), 0).toLocaleString()} kg
            </div>
            <div className="text-xs text-muted-foreground">Total Remaining</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Payment Modal Component
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
  const [balances, setBalances] = useState({
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0,
  });
  const [checkingBalance, setCheckingBalance] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const paymentDateAnchorRef = useRef<HTMLDivElement>(null);
  const [calendarPopoverPos, setCalendarPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Map payment methods to finance methods
  const getFinanceMethod = (paymentMethod: string): string => {
    const methodMap: Record<string, string> = {
      'cash': 'drawer',
      'bank_transfer': 'bank',
      'cheque': 'bank',
      'easypaisa': 'easypaisa',
      'jazzcash': 'jazzcash',
      'online': 'bank',
      'other': 'drawer'
    };
    return methodMap[paymentMethod] || 'drawer';
  };

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
      fetchBalances();
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

  useLayoutEffect(() => {
    if (calendarOpen) {
      setCalendarPopoverPos(getCalendarPopoverPosition(paymentDateAnchorRef.current));
    } else {
      setCalendarPopoverPos(null);
    }
  }, [calendarOpen]);

  useEffect(() => {
    if (!calendarOpen) return;
    const reposition = () => {
      setCalendarPopoverPos(getCalendarPopoverPosition(paymentDateAnchorRef.current));
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [calendarOpen]);

  const fetchBalances = async () => {
    setCheckingBalance(true);
    try {
      const balancesData = await financeApi.getAllBalances();
      setBalances(balancesData);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
      toast({
        title: "Warning",
        description: "Could not fetch current balances",
        variant: "destructive",
      });
    } finally {
      setCheckingBalance(false);
    }
  };

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
    calendarOpen && calendarPopoverPos && (
      <div 
        ref={calendarRef}
        className="fixed z-[9999] w-80 bg-background border border-border rounded-lg shadow-2xl"
        style={{
          top: calendarPopoverPos.top,
          left: calendarPopoverPos.left,
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
              
              const selectedDateObj = parseDateFromYMD(paymentDate);
              const isSelected = selectedDateObj.getDate() === day &&
                                selectedDateObj.getMonth() === currentMonth &&
                                selectedDateObj.getFullYear() === currentYear;
              
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

  const getCurrentBalance = () => {
    const financeMethod = getFinanceMethod(paymentMethod);
    return balances[financeMethod as keyof typeof balances] || 0;
  };

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

    const currentTotalPaid = getPurchaseTotalPaid(purchase);
    const remainingAmount = getPurchaseRemainingAmount(purchase);
    if (amount > remainingAmount) {
      toast({
        title: "Error",
        description: `Payment amount cannot exceed remaining amount of Rs. ${remainingAmount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    const financeMethod = getFinanceMethod(paymentMethod);
    const currentBalance = getCurrentBalance();
    
    const shouldCheckBalance = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);
    
    if (shouldCheckBalance && amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `${financeApi.getMethodLabel(financeMethod)} has Rs. ${currentBalance.toLocaleString()}. Required: Rs. ${amount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newTotalPaid = currentTotalPaid + amount;
      const advance = Number(purchase.advancePayment) || 0;
      const newAmountPaidField = Math.max(0, newTotalPaid - advance);
      const purchasePrice = getPurchasePrice(purchase);
      const newPaidStatus = getPurchasePaidStatus({
        ...purchase,
        totalPaid: newTotalPaid,
        price: purchasePrice,
      });
      const newRemainingAmount = Math.max(0, purchasePrice - newTotalPaid);
      
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        purchaseId: purchase._id,
        amount: amount,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        notes: notes || `Payment of Rs. ${amount.toLocaleString()}`,
        receiptNo: purchase.receiptNo,
        materialName: purchase.materialName,
        financeUpdated: false,
        financeMethod: financeMethod
      };

      const updateData = {
        amountPaid: newAmountPaidField,
        paidAmount: newPaidStatus,
        remainingAmount: newRemainingAmount,
        totalPaid: newTotalPaid,
      };

      if (shouldCheckBalance) {
        try {
          await financeApi.updateBalance(
            financeMethod,
            amount,
            `Payment for Purchase ${purchase.invoiceNo || purchase.receiptNo || ''} - ${purchase.materialName}`
          );
          paymentRecord.financeUpdated = true;
          toast({
            title: "Finance Updated",
            description: `Rs. ${amount.toLocaleString()} deducted from ${financeApi.getMethodLabel(financeMethod)}`,
          });
        } catch (financeError: any) {
          console.error("Failed to update finance:", financeError);
          toast({
            title: "Warning",
            description: `Payment recorded but failed to update ${financeApi.getMethodLabel(financeMethod)} balance`,
            variant: "destructive",
          });
        }
      }

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

  const totalPaid = getPurchaseTotalPaid(purchase);
  const remainingAmount = getPurchaseRemainingAmount(purchase);
  const financeMethod = getFinanceMethod(paymentMethod);
  const currentBalance = getCurrentBalance();
  const showBalanceCheck = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);

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
              Purchase {purchase.invoiceNo || `#${purchase.receiptNo}`} - {purchase.materialName}
              {(purchase.billNo || purchase.receiptNo) ? (
                <span className="text-xs text-muted-foreground ml-1">(Bill: {purchase.billNo || purchase.receiptNo})</span>
              ) : null}
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
                  Rs. {totalPaid.toLocaleString()}
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
              <PaymentStatusBadge status={getPurchasePaidStatus(purchase)} />
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
              <div className="relative" ref={paymentDateAnchorRef}>
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
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="cash">Cash (From Drawer)</option>
                <option value="easypaisa">Easypaisa</option>
                <option value="jazzcash">JazzCash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="online">Online Payment</option>
                <option value="other">Other</option>
              </select>
              {showBalanceCheck && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {financeApi.getMethodIcon(financeMethod, "w-3 h-3")}
                      <span className="text-xs text-blue-700">Current {financeApi.getMethodLabel(financeMethod)} Balance:</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-800">
                      {checkingBalance ? (
                        <Loader2 className="w-3 h-3 animate-spin inline" />
                      ) : (
                        `Rs. ${currentBalance.toLocaleString()}`
                      )}
                    </span>
                  </div>
                  {paymentAmount && parseFloat(paymentAmount) > 0 && (
                    <div className="mt-1 text-xs text-blue-600">
                      After payment: Rs. {(currentBalance - parseFloat(paymentAmount)).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
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
              disabled={isSubmitting || !paymentAmount || (showBalanceCheck && parseFloat(paymentAmount) > currentBalance)}
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

// PayTotalVendorModal Component
const PayTotalVendorModal = ({
  open,
  onClose,
  vendorName,
  purchases,
  totalRemaining,
  onSuccess,
  formatCurrency,
}: {
  open: boolean;
  onClose: () => void;
  vendorName: string;
  purchases: PurchaseWithRemaining[];
  totalRemaining: number;
  onSuccess: (records: PaymentHistory[]) => void;
  formatCurrency: (n: number) => string;
}) => {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balances, setBalances] = useState({
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0,
  });
  const [checkingBalance, setCheckingBalance] = useState<boolean>(false);

  useEffect(() => {
    if (open && totalRemaining > 0) {
      setPaymentAmount(String(totalRemaining));
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("cash");
      setNotes("");
      fetchBalances();
    }
  }, [open, totalRemaining]);

  const fetchBalances = async () => {
    setCheckingBalance(true);
    try {
      const balancesData = await financeApi.getAllBalances();
      setBalances(balancesData);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    } finally {
      setCheckingBalance(false);
    }
  };

  const getFinanceMethod = (paymentMethod: string): string => {
    const methodMap: Record<string, string> = {
      'cash': 'drawer',
      'bank_transfer': 'bank',
      'cheque': 'bank',
      'easypaisa': 'easypaisa',
      'jazzcash': 'jazzcash',
      'online': 'bank',
      'other': 'drawer'
    };
    return methodMap[paymentMethod] || 'drawer';
  };

  const getCurrentBalance = () => {
    const financeMethod = getFinanceMethod(paymentMethod);
    return balances[financeMethod as keyof typeof balances] || 0;
  };

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

    const financeMethod = getFinanceMethod(paymentMethod);
    const currentBalance = getCurrentBalance();
    const shouldCheckBalance = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);

    if (shouldCheckBalance && amount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `${financeApi.getMethodLabel(financeMethod)} has Rs. ${currentBalance.toLocaleString()}. Required: Rs. ${amount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const records: PaymentHistory[] = [];
    let left = amount;
    try {
      // Update finance balance first
      if (shouldCheckBalance) {
        try {
          await financeApi.updateBalance(
            financeMethod,
            amount,
            `POP Payment - ${vendorName} - Multiple purchases`
          );
          toast({
            title: "Finance Updated",
            description: `Rs. ${amount.toLocaleString()} deducted from ${financeApi.getMethodLabel(financeMethod)}`,
          });
        } catch (financeError: any) {
          console.error("Failed to update finance:", financeError);
          toast({
            title: "Error",
            description: `Failed to update ${financeApi.getMethodLabel(financeMethod)} balance`,
            variant: "destructive",
          });
          return;
        }
      }

      for (const purchase of purchases) {
        if (left <= 0) break;
        const purchaseRemaining = getPurchaseRemainingAmount(purchase);
        const pay = Math.min(left, purchaseRemaining);
        if (pay <= 0) continue;

        const newTotalPaid = getPurchaseTotalPaid(purchase) + pay;
        const totalAmount = getPurchasePrice(purchase);
        const advance = Number(purchase.advancePayment) || 0;
        const newAmountPaidField = Math.max(0, newTotalPaid - advance);
        const newPaidAmount = getPurchasePaidStatus({
          ...purchase,
          totalPaid: newTotalPaid,
          price: totalAmount,
        });
        const newRemainingAmount = Math.max(0, totalAmount - newTotalPaid);

        const paymentRecord: PaymentHistory = {
          _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          purchaseId: purchase._id,
          amount: pay,
          paymentDate: paymentDate,
          paymentMethod: paymentMethod,
          notes: notes || `Payment Rs. ${formatCurrency(pay)}`,
          receiptNo: purchase.receiptNo,
          materialName: purchase.materialName,
          financeUpdated: shouldCheckBalance,
          financeMethod: financeMethod
        };

        await api.put(`${PURCHASES_API_URL}/${purchase._id}`, {
          amountPaid: newAmountPaidField,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          totalPaid: newTotalPaid,
        });

        records.push(paymentRecord);
        left -= pay;
      }

      toast({
        title: "Success",
        description: `Payment of Rs. ${formatCurrency(amount)} recorded.`,
      });
      onSuccess(records);
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

  if (!open || purchases.length === 0) return null;

  const financeMethod = getFinanceMethod(paymentMethod);
  const currentBalance = getCurrentBalance();
  const showBalanceCheck = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md">
        <div className="bg-cms-table-header px-4 py-3 border-b border-border flex justify-between items-center">
          <h3 className="text-sm font-semibold text-foreground">Pay total — {vendorName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-cms-card-hover rounded">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-3 bg-cms-card rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">Total remaining</p>
            <p className="text-xl font-bold text-red-600">Rs. {formatCurrency(totalRemaining)}</p>
          </div>
          
          {showBalanceCheck && (
            <div className="p-3 bg-cms-card rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-sm font-semibold text-foreground">
                    {financeApi.getMethodLabel(financeMethod)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${
                    currentBalance >= parseFloat(paymentAmount || "0") 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    Rs. {formatCurrency(currentBalance)}
                  </p>
                  {checkingBalance && (
                    <p className="text-xs text-muted-foreground">Checking...</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Amount to pay</label>
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
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
              <option value="bank">Bank (Generic)</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online Payment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2 text-foreground"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 font-medium disabled:opacity-50"
          >
            {isSubmitting ? "Processing..." : `Pay Rs. ${formatCurrency(parseFloat(paymentAmount) || 0)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// MarkAsPaidModal Component
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
  const [balances, setBalances] = useState({
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0,
  });
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [checkingBalance, setCheckingBalance] = useState<boolean>(false);

  useEffect(() => {
    if (open && purchase) {
      fetchBalances();
    }
  }, [open, purchase]);

  const fetchBalances = async () => {
    setCheckingBalance(true);
    try {
      const balancesData = await financeApi.getAllBalances();
      setBalances(balancesData);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    } finally {
      setCheckingBalance(false);
    }
  };

  const getFinanceMethod = (paymentMethod: string): string => {
    const methodMap: Record<string, string> = {
      'cash': 'drawer',
      'bank_transfer': 'bank',
      'cheque': 'bank',
      'easypaisa': 'easypaisa',
      'jazzcash': 'jazzcash',
      'online': 'bank',
      'other': 'drawer'
    };
    return methodMap[paymentMethod] || 'drawer';
  };

  const getCurrentBalance = () => {
    const financeMethod = getFinanceMethod(paymentMethod);
    return balances[financeMethod as keyof typeof balances] || 0;
  };

  const handleMarkPaid = async () => {
    if (!purchase) return;

    const remainingAmount = getPurchaseRemainingAmount(purchase);
    const financeMethod = getFinanceMethod(paymentMethod);
    const currentBalance = getCurrentBalance();
    
    const shouldCheckBalance = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);
    
    if (shouldCheckBalance && remainingAmount > currentBalance) {
      toast({
        title: "Insufficient Balance",
        description: `${financeApi.getMethodLabel(financeMethod)} has Rs. ${currentBalance.toLocaleString()}. Required: Rs. ${remainingAmount.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentRecord: PaymentHistory = {
        _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        purchaseId: purchase._id,
        amount: remainingAmount,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: paymentMethod,
        notes: 'Marked as fully paid',
        receiptNo: purchase.receiptNo,
        materialName: purchase.materialName,
        financeUpdated: false,
        financeMethod: financeMethod
      };

      const advance = Number(purchase.advancePayment) || 0;
      const purchasePrice = getPurchasePrice(purchase);
      const updateData = {
        amountPaid: Math.max(0, purchasePrice - advance),
        paidAmount: 'paid',
        remainingAmount: 0,
        totalPaid: purchasePrice,
      };

      if (shouldCheckBalance) {
        try {
          await financeApi.updateBalance(
            financeMethod,
            remainingAmount,
            `Full payment for Purchase ${purchase.invoiceNo || purchase.receiptNo || ''} - ${purchase.materialName}`
          );
          paymentRecord.financeUpdated = true;
          toast({
            title: "Finance Updated",
            description: `Rs. ${remainingAmount.toLocaleString()} deducted from ${financeApi.getMethodLabel(financeMethod)}`,
          });
        } catch (financeError: any) {
          console.error("Failed to update finance:", financeError);
          toast({
            title: "Warning",
            description: `Payment recorded but failed to update ${financeApi.getMethodLabel(financeMethod)} balance`,
            variant: "destructive",
          });
        }
      }

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

  const totalPaid = getPurchaseTotalPaid(purchase);
  const remainingAmount = getPurchaseRemainingAmount(purchase);
  const financeMethod = getFinanceMethod(paymentMethod);
  const currentBalance = getCurrentBalance();
  const showBalanceCheck = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);

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
                  Rs. {totalPaid.toLocaleString()}
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
              <PaymentStatusBadge status={getPurchasePaidStatus(purchase)} />
              <span className="text-xs text-muted-foreground">→</span>
              <PaymentStatusBadge status={'paid'} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="cash">Cash (From Drawer)</option>
              <option value="easypaisa">Easypaisa</option>
              <option value="jazzcash">JazzCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="online">Online Payment</option>
              <option value="other">Other</option>
            </select>
            {showBalanceCheck && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {financeApi.getMethodIcon(financeMethod, "w-3 h-3")}
                    <span className="text-xs text-blue-700">Current {financeApi.getMethodLabel(financeMethod)} Balance:</span>
                  </div>
                  <span className="text-sm font-semibold text-blue-800">
                    {checkingBalance ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      `Rs. ${currentBalance.toLocaleString()}`
                    )}
                  </span>
                </div>
                <div className="mt-1 text-xs text-blue-600">
                  After payment: Rs. {(currentBalance - remainingAmount).toLocaleString()}
                </div>
              </div>
            )}
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
                  {showBalanceCheck && ` Amount will be deducted from ${financeApi.getMethodLabel(financeMethod)} balance.`}
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
              disabled={isSubmitting || (showBalanceCheck && remainingAmount > currentBalance)}
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

// PaymentHistoryModal Component
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

  const totalPaid = getPurchaseTotalPaid(purchase);
  const remainingAmount = getPurchaseRemainingAmount(purchase);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center sticky top-0 z-10">
          <div>
            <p className="text-xs text-muted-foreground">Payment History</p>
            <h2 className="text-lg font-bold text-foreground">
              Purchase {purchase.invoiceNo || `#${purchase.receiptNo}`} - {purchase.materialName}
              {(purchase.billNo || purchase.receiptNo) ? (
                <span className="text-xs text-muted-foreground ml-1">(Bill: {purchase.billNo || purchase.receiptNo})</span>
              ) : null}
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
                  Rs. {totalPaid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Amount</p>
                <p className="text-xl font-bold text-red-600">
                  Rs. {remainingAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <div className="mt-1">
                  <PaymentStatusBadge status={getPurchasePaidStatus(purchase)} />
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Total Payments: {paymentHistory.length} | 
              Total Paid: Rs. {totalPaid.toLocaleString()} | 
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
                      <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Finance Updated</th>
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {financeApi.getMethodIcon(payment.paymentMethod, "w-4 h-4")}
                              <span className="text-sm text-foreground capitalize">
                                {payment.paymentMethod.replace('_', ' ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">
                            Rs. {payment.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {payment.notes || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {payment.financeUpdated ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Updated
                                </span>
                                <span className="text-xs text-gray-500">
                                  {financeApi.getMethodLabel(payment.financeMethod || payment.paymentMethod)}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                Not Updated
                              </span>
                            )}
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
                        Rs. {totalPaid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={3}>
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
                        <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={3}>
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
                      <td className="px-4 py-3 text-sm text-muted-foreground" colSpan={3}>
                        Purchase Price
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">Payment Methods Integration</h4>
            <p className="text-xs text-blue-700">
              When selecting payment methods like Easypaisa or JazzCash, the amount will be automatically deducted from the respective finance module balance.
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <div className="p-2 bg-blue-100 rounded flex items-center gap-2">
                <Wallet className="w-3 h-3" />
                <span>Drawer</span>
              </div>
              <div className="p-2 bg-blue-100 rounded flex items-center gap-2">
                <Smartphone className="w-3 h-3" />
                <span>Easypaisa</span>
              </div>
              <div className="p-2 bg-blue-100 rounded flex items-center gap-2">
                <Smartphone className="w-3 h-3" />
                <span>JazzCash</span>
              </div>
              <div className="p-2 bg-blue-100 rounded flex items-center gap-2">
                <Building className="w-3 h-3" />
                <span>Bank</span>
              </div>
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

function resolveVendorMaterialWeight(m: VendorMaterialProfile): string {
  const saved = Number(m.defaultWeight);
  if (saved > 0) return String(saved);
  const bagSize = getProductByCode(m.productCode || "")?.bagSize;
  if (bagSize && bagSize > 0) return String(bagSize);
  return "";
}

function vendorMaterialsToRows(materials: VendorMaterialProfile[]): PurchaseMaterialRow[] {
  return materials.map((m) => ({
    name: m.materialName || getMaterialNameForCode(m.productCode) || "",
    weight: resolveVendorMaterialWeight(m),
    pricePerKg: String(m.pricePerKg ?? ""),
    productCode: m.productCode || "",
  }));
}

function totalsFromMaterialRows(rows: PurchaseMaterialRow[]) {
  const validRows = rows.filter((r) => r.name.trim());
  const totalWeight = validRows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
  const totalPrice = validRows.reduce(
    (s, r) => s + (parseFloat(r.weight) || 0) * (parseFloat(r.pricePerKg) || 0),
    0
  );
  const names = validRows.map((r) => r.name.trim()).join(", ");
  return { totalWeight, totalPrice, names };
}

// PurchaseDialog Component
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
  const purchaseDateAnchorRef = useRef<HTMLDivElement>(null);
  const deliveryDateAnchorRef = useRef<HTMLDivElement>(null);
  const [calendarPopoverPos, setCalendarPopoverPos] = useState<{ top: number; left: number } | null>(null);
  /** When true, Total Price was typed manually — do not overwrite from material rows */
  const priceManualRef = useRef(false);

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
    billNo: "",
    advancePayment: "",
    amountPaid: "",
    paymentMethod: "cash",
    vehicleImage: null as File | null,
  });

  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [registeredVendors, setRegisteredVendors] = useState<VendorOption[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [vendorBalance, setVendorBalance] = useState<VendorBalance | null>(null);
  const [loadingVendorBalance, setLoadingVendorBalance] = useState(false);
  const [materialRows, setMaterialRows] = useState<PurchaseMaterialRow[]>([
    { name: "", weight: "", pricePerKg: "", productCode: "" },
    { name: "", weight: "", pricePerKg: "", productCode: "" },
  ]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState("");
  
  const [qualityOptions, setQualityOptions] = useState(initialQualityOptions);
  const [showCustomQualityInput, setShowCustomQualityInput] = useState(false);
  const [customQuality, setCustomQuality] = useState("");

  const [balances, setBalances] = useState({
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0,
  });
  const [checkingBalance, setCheckingBalance] = useState<boolean>(false);

  const fetchVendorBalance = async (vendorName: string) => {
    if (!vendorName.trim()) {
      setVendorBalance(null);
      return;
    }
    setLoadingVendorBalance(true);
    try {
      const response = await api.get(`/api/purchases/vendor/${encodeURIComponent(vendorName)}/balance`);
      if (response.data.success) {
        setVendorBalance(response.data.data);
      } else {
        setVendorBalance(null);
      }
    } catch (error) {
      console.error("Failed to fetch vendor balance:", error);
      setVendorBalance(null);
    } finally {
      setLoadingVendorBalance(false);
    }
  };

  const fetchMaterialCatalog = async () => {
    try {
      const materialsRes = await api.get("/api/materials");
      if (materialsRes.data.success) {
        setMaterialCatalog(materialsRes.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch materials:", error);
    }
  };

  const fetchRegisteredVendors = async () => {
    try {
      const res = await api.get("/api/vendors");
      if (res.data.success) {
        setRegisteredVendors(res.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMaterialCatalog();
      fetchRegisteredVendors();
      if (!isEdit) {
        api.get("/api/purchases/next-invoice")
          .then((res) => {
            if (res.data?.success && res.data.data?.invoiceNo) {
              setPreviewInvoiceNo(res.data.data.invoiceNo);
            }
          })
          .catch(() => setPreviewInvoiceNo(""));
      }
    }
  }, [open, isEdit]);

  useEffect(() => {
    if (!formData.vendor.trim() || registeredVendors.length === 0) return;
    const match = registeredVendors.find(
      (v) => v.name.toLowerCase() === formData.vendor.trim().toLowerCase()
    );
    if (match && match._id !== selectedVendorId) {
      setSelectedVendorId(match._id);
    }
  }, [registeredVendors, formData.vendor]);

  useEffect(() => {
    const validRows = materialRows.filter((r) => r.name.trim());
    if (validRows.length === 0) return;
    const { totalWeight, totalPrice, names } = totalsFromMaterialRows(materialRows);
    setFormData((prev) => ({
      ...prev,
      materialName: names,
      weight: totalWeight > 0 ? String(totalWeight) : "",
      ...(priceManualRef.current
        ? {}
        : { price: totalPrice > 0 ? String(totalPrice) : "" }),
    }));
  }, [materialRows]);

  /** New POP: auto-apply vendor advance balance to Advance Payment (paid section) */
  useEffect(() => {
    if (isEdit || !open) return;
    const price = parseFloat(formData.price) || 0;
    const adv = vendorBalance?.advanceBalance ?? 0;
    if (price <= 0) return;
    const applied = adv > 0 ? Math.min(adv, price) : 0;
    setFormData((prev) => ({
      ...prev,
      advancePayment: applied > 0 ? String(applied) : "",
    }));
  }, [isEdit, open, vendorBalance?.advanceBalance, formData.price, formData.vendor]);

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

  useLayoutEffect(() => {
    if (showPurchaseCalendar) {
      setCalendarPopoverPos(getCalendarPopoverPosition(purchaseDateAnchorRef.current));
    } else if (showDeliveryCalendar) {
      setCalendarPopoverPos(getCalendarPopoverPosition(deliveryDateAnchorRef.current));
    } else {
      setCalendarPopoverPos(null);
    }
  }, [showPurchaseCalendar, showDeliveryCalendar]);

  useEffect(() => {
    if (!showPurchaseCalendar && !showDeliveryCalendar) return;
    const reposition = () => {
      if (showPurchaseCalendar) {
        setCalendarPopoverPos(getCalendarPopoverPosition(purchaseDateAnchorRef.current));
      } else if (showDeliveryCalendar) {
        setCalendarPopoverPos(getCalendarPopoverPosition(deliveryDateAnchorRef.current));
      }
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [showPurchaseCalendar, showDeliveryCalendar]);

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

  const getFinanceMethod = (paymentMethod: string): string => {
    const methodMap: Record<string, string> = {
      'cash': 'drawer',
      'bank_transfer': 'bank',
      'cheque': 'bank',
      'easypaisa': 'easypaisa',
      'jazzcash': 'jazzcash',
      'online': 'bank',
      'other': 'drawer'
    };
    return methodMap[paymentMethod] || 'drawer';
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
            console.error("Error parsing purchase date:", error);
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
            console.error("Error parsing delivery date:", error);
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

        priceManualRef.current = false;

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
          billNo: editData.billNo || editData.receiptNo || "",
          advancePayment: editData.advancePayment?.toString() || "",
          amountPaid: editData.amountPaid?.toString() || "",
          paymentMethod: editData.paymentMethod || "cash",
          vehicleImage: null,
        });

        if (editData.materials?.length) {
          setMaterialRows(
            editData.materials.map((m) => ({
              name: m.name || "",
              weight: m.weight != null ? String(m.weight) : "",
              pricePerKg: m.pricePerKg != null ? String(m.pricePerKg) : "",
              productCode: m.productCode || "",
            }))
          );
        } else {
          setMaterialRows([
            { name: editData.materialName || "", weight: editData.weight != null ? String(editData.weight) : "", pricePerKg: "", productCode: "" },
            { name: "", weight: "", pricePerKg: "", productCode: "" },
          ]);
        }
        if (editData.vendor) {
          fetchVendorBalance(editData.vendor);
          const match = registeredVendors.find(
            (v) => v.name.toLowerCase() === (editData.vendor || "").toLowerCase()
          );
          setSelectedVendorId(match?._id || "");
        } else {
          setSelectedVendorId("");
          setVendorBalance(null);
        }
        
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
        setPreviewInvoiceNo(editData.invoiceNo || "");
      } else {
        resetForm();
      }
      
      fetchBalances();
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
    const activeRows = materialRows.filter(
      (r) =>
        r.name.trim() ||
        r.productCode.trim() ||
        r.weight.trim() ||
        r.pricePerKg.trim()
    );
    const validMaterials = materialRows.filter(
      (r) =>
        r.productCode.trim() &&
        r.name.trim() &&
        parseFloat(r.weight) > 0 &&
        parseFloat(r.pricePerKg) > 0
    );
    if (validMaterials.length === 0) {
      newErrors.materialName =
        "Har material ke liye code (100/105/110), naam, weight (kg) aur price/kg zaroori hai";
    } else if (activeRows.length > validMaterials.length) {
      newErrors.materialName =
        "Koi material incomplete hai — code select karein ya auto-filled data hata di hai to dubara bharein";
    }
    if (!formData.vendor.trim()) newErrors.vendor = "Vendor name is required";
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = "Valid price is required";
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = "Valid weight is required";
    if (!formData.quality) newErrors.quality = "Quality is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required";
    if (!formData.purchaseTime) newErrors.purchaseTime = "Purchase time is required";
    // Vehicle details are optional per business requirements
    
    const priceNum = parseFloat(formData.price) || 0;
    const advanceNum = parseFloat(formData.advancePayment) || 0;
    const amountPaidNum = parseFloat(formData.amountPaid) || 0;
    const totalPaidNum = advanceNum + amountPaidNum;

    if (formData.advancePayment && isNaN(Number(formData.advancePayment))) {
      newErrors.advancePayment = "Advance payment must be a valid number";
    } else if (advanceNum < 0) {
      newErrors.advancePayment = "Advance payment cannot be negative";
    } else if (priceNum > 0 && advanceNum > priceNum) {
      newErrors.advancePayment = `Advance cannot exceed total price (Rs. ${priceNum.toLocaleString()})`;
    }

    if (formData.amountPaid && isNaN(Number(formData.amountPaid))) {
      newErrors.amountPaid = "Amount paid must be a valid number";
    } else if (amountPaidNum < 0) {
      newErrors.amountPaid = "Amount paid cannot be negative";
    } else if (priceNum > 0 && amountPaidNum > priceNum) {
      newErrors.amountPaid = `Amount paid cannot exceed total price (Rs. ${priceNum.toLocaleString()})`;
    }

    if (priceNum > 0 && totalPaidNum > priceNum) {
      const msg = `Total payment (Rs. ${totalPaidNum.toLocaleString()}) cannot exceed price (Rs. ${priceNum.toLocaleString()})`;
      newErrors.amountPaid = newErrors.amountPaid || msg;
      if (!newErrors.advancePayment) newErrors.advancePayment = msg;
    }

    setErrors(newErrors);
    const firstError =
      newErrors.materialName ||
      newErrors.vendor ||
      newErrors.price ||
      newErrors.weight ||
      Object.values(newErrors)[0];
    return {
      ok: Object.keys(newErrors).length === 0,
      message: firstError,
    };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === "price") {
      priceManualRef.current = true;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleVendorBlur = () => {
    if (formData.vendor.trim()) {
      fetchVendorBalance(formData.vendor.trim());
    } else {
      setVendorBalance(null);
    }
  };

  const applyVendorToForm = (vendor: VendorOption) => {
    priceManualRef.current = false;
    setFormData((prev) => ({ ...prev, vendor: vendor.name }));
    if (errors.vendor) {
      setErrors((prev) => ({ ...prev, vendor: "" }));
    }
    fetchVendorBalance(vendor.name);
    const mats = vendor.materials || [];
    if (mats.length === 0) return;
    const rows = vendorMaterialsToRows(mats);
    setMaterialRows(rows);
    const { totalWeight, totalPrice, names } = totalsFromMaterialRows(rows);
    setFormData((prev) => ({
      ...prev,
      vendor: vendor.name,
      materialName: names,
      weight: totalWeight > 0 ? String(totalWeight) : "",
      price: totalPrice > 0 ? String(totalPrice) : "",
    }));
    if (errors.materialName) {
      setErrors((prev) => ({ ...prev, materialName: "" }));
    }
  };

  const handleVendorSelect = async (vendorId: string) => {
    setSelectedVendorId(vendorId);
    if (!vendorId) {
      priceManualRef.current = false;
      setFormData((prev) => ({ ...prev, vendor: "", materialName: "", weight: "", price: "" }));
      setMaterialRows([
        { name: "", weight: "", pricePerKg: "", productCode: "" },
        { name: "", weight: "", pricePerKg: "", productCode: "" },
      ]);
      setVendorBalance(null);
      return;
    }
    try {
      const res = await api.get(`/api/vendors/${vendorId}`);
      if (res.data.success && res.data.data) {
        applyVendorToForm(res.data.data);
        return;
      }
    } catch (error) {
      console.error("Failed to fetch vendor details:", error);
    }
    const vendor = registeredVendors.find((v) => v._id === vendorId);
    if (vendor) applyVendorToForm(vendor);
  };

  const updateMaterialRow = (index: number, field: keyof PurchaseMaterialRow, value: string) => {
    if (field === "weight" || field === "pricePerKg" || field === "name" || field === "productCode") {
      priceManualRef.current = false;
    }
    setMaterialRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "productCode" && value) {
        const materialName = getMaterialNameForCode(value);
        if (materialName) {
          next[index].name = materialName;
        }
        const bagSize = getProductByCode(value)?.bagSize;
        if (bagSize && bagSize > 0 && !next[index].weight.trim()) {
          next[index].weight = String(bagSize);
        }
      }
      return next;
    });
    if (errors.materialName) {
      setErrors((prev) => ({ ...prev, materialName: "" }));
    }
  };

  const addMaterialRow = () => {
    priceManualRef.current = false;
    setMaterialRows(prev => [...prev, { name: "", weight: "", pricePerKg: "", productCode: "" }]);
  };

  const removeMaterialRow = (index: number) => {
    priceManualRef.current = false;
    setMaterialRows(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleQualityChange = (quality: string) => {
    setFormData(prev => ({ ...prev, quality }));
    if (errors.quality) {
      setErrors(prev => ({ ...prev, quality: "" }));
    }
  };

  const handleAddCustomQuality = () => {
    if (customQuality.trim() && !qualityOptions.some(option => option.value.toLowerCase() === customQuality.toLowerCase())) {
      const newOption = { value: customQuality, label: customQuality };
      setQualityOptions(prev => [...prev, newOption]);
      setFormData(prev => ({ ...prev, quality: customQuality }));
      setCustomQuality("");
      setShowCustomQualityInput(false);
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

  const fetchBalances = async () => {
    setCheckingBalance(true);
    try {
      const balancesData = await financeApi.getAllBalances();
      setBalances(balancesData);
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    } finally {
      setCheckingBalance(false);
    }
  };

  const getCurrentBalance = () => {
    const financeMethod = getFinanceMethod(formData.paymentMethod);
    return balances[financeMethod as keyof typeof balances] || 0;
  };

  const handleSubmit = async () => {
    const validation = validateForm();
    if (!validation.ok) {
      toast({
        title: "Validation failed",
        description: validation.message || "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      
      const parseDate = (dateStr: string, timeStr: string): string => {
        if (!dateStr?.trim()) return "";
        const [dd, mm, yyyy] = dateStr.split('/').map(Number);
        if (!dd || !mm || !yyyy) return "";
        const timeMatch = (timeStr || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!timeMatch) return new Date(yyyy, mm - 1, dd).toISOString();
        
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const ampm = timeMatch[3];
        
        if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
        if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        
        const date = new Date(yyyy, mm - 1, dd, hour, minute);
        return date.toISOString();
      };

      const purchaseDateTime = parseDate(formData.purchaseDate, formData.purchaseTime);
      const deliveryDateTime = formData.deliveryDate.trim()
        ? parseDate(formData.deliveryDate, formData.deliveryTime || "09:00 AM")
        : "";

      const priceNum = parseFloat(formData.price) || 0;
      const advancePaymentNum = parseFloat(formData.advancePayment) || 0;
      const amountPaidNum = parseFloat(formData.amountPaid) || 0;

      const totalAmountPaid = advancePaymentNum + amountPaidNum;
      const remainingAmount = priceNum - totalAmountPaid;

      if (totalAmountPaid > priceNum) {
        toast({
          title: "Payment exceeds price",
          description: `Total payment Rs. ${totalAmountPaid.toLocaleString()} is more than purchase price Rs. ${priceNum.toLocaleString()}. Record cannot be saved.`,
          variant: "destructive",
        });
        setErrors((prev) => ({
          ...prev,
          amountPaid: `Cannot pay more than Rs. ${priceNum.toLocaleString()}`,
        }));
        setIsSubmitting(false);
        return;
      }

      const financeMethod = getFinanceMethod(formData.paymentMethod);
      const shouldCheckBalance = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);
      const previousAmountPaid = isEdit ? Number(editData?.amountPaid) || 0 : 0;
      const extraPayment = Math.max(0, amountPaidNum - previousAmountPaid);
      if (!isEdit && shouldCheckBalance && amountPaidNum > 0) {
        const currentBalance = getCurrentBalance();
        if (amountPaidNum > currentBalance) {
          toast({
            title: "Insufficient Balance",
            description: `${financeApi.getMethodLabel(financeMethod)} has Rs. ${currentBalance.toLocaleString()}. Cannot pay Rs. ${amountPaidNum.toLocaleString()}.`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }
      
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
        materialColor: formData.materialColor || "#FFFFFF",
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: formData.vehicleColor,
        deliveryDate: deliveryDateTime,
        receiptNo: formData.billNo,
        billNo: formData.billNo,
        paymentMethod: formData.paymentMethod,
        advancePayment: advancePaymentNum,
        amountPaid: amountPaidNum,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount > 0 ? remainingAmount : 0,
      };

      if (isEdit && editData) {
        Object.assign(fields, {
          soldWeight: editData.soldWeight ?? 0,
          productionConsumedWeight: (editData as Purchase & { productionConsumedWeight?: number }).productionConsumedWeight ?? 0,
          status: editData.status || 'available',
        });
      } else {
        Object.assign(fields, { soldWeight: 0, status: 'available' });
      }

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          formDataToSend.append(key, String(value));
        }
      });

      if (formData.vehicleImage) {
        formDataToSend.append('vehicleImage', formData.vehicleImage);
      }

      const materialsPayload = materialRows
        .filter(
          (row) =>
            row.productCode.trim() &&
            row.name.trim() &&
            parseFloat(row.weight) > 0 &&
            parseFloat(row.pricePerKg) > 0
        )
        .map((row) => {
          const weight = parseFloat(row.weight) || 0;
          const pricePerKg = parseFloat(row.pricePerKg) || 0;
          return {
            name: row.name.trim(),
            weight,
            pricePerKg,
            totalAmount: weight * pricePerKg,
            productCode: row.productCode,
          };
        });
      formDataToSend.append('materials', JSON.stringify(materialsPayload));

      let response;
      if (isEdit && editData && editData._id) {
        response = await api.put(
          `/api/purchases/${editData._id}`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        response = await api.post(
          `/api/purchases/add`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }
      
      if (response.data.success) {
        if (totalAmountPaid > 0) {
          const initialPayment: PaymentHistory = {
            _id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            purchaseId: response.data.data._id,
            amount: totalAmountPaid,
            paymentDate: purchaseDateTime.split('T')[0],
            paymentMethod: formData.paymentMethod,
            notes: `Initial payment of Rs. ${totalAmountPaid.toLocaleString()}`,
            receiptNo: formData.billNo,
            materialName: formData.materialName,
            financeUpdated: false
          };
          
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

    priceManualRef.current = false;

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
      billNo: "",
      advancePayment: "",
      amountPaid: "",
      paymentMethod: "cash",
      vehicleImage: null,
    });
    
    setPreviewInvoiceNo("");
    setVendorBalance(null);
    setSelectedVendorId("");
    setMaterialRows([
      { name: "", weight: "", pricePerKg: "", productCode: "" },
      { name: "", weight: "", pricePerKg: "", productCode: "" },
    ]);
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
    setShowCustomQualityInput(false);
    setCustomQuality("");
    setBalances({
      drawer: 0,
      easypaisa: 0,
      jazzcash: 0,
      bank: 0,
    });
    setCheckingBalance(false);
    
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

    return showCalendar && calendarPopoverPos && (
      <div 
        ref={calendarRef}
        className="fixed z-[9999] w-80 bg-background border border-border rounded-lg shadow-2xl"
        style={{
          top: calendarPopoverPos.top,
          left: calendarPopoverPos.left,
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

  const financeMethod = getFinanceMethod(formData.paymentMethod);
  const currentBalance = getCurrentBalance();
  const showBalanceCheck = ['drawer', 'easypaisa', 'jazzcash', 'bank'].includes(financeMethod);
  const totalAmount = (parseFloat(formData.advancePayment || '0') + parseFloat(formData.amountPaid || '0'));
  const billPrice = parseFloat(formData.price || '0') || 0;
  const remainingPayable = Math.max(0, billPrice - totalAmount);

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

            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-1.5">Vendor *</label>
              <select
                value={selectedVendorId}
                onChange={(e) => handleVendorSelect(e.target.value)}
                className={`w-full bg-cms-card border ${errors.vendor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary mb-2`}
              >
                <option value="">Select registered vendor...</option>
                {registeredVendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name}
                    {v.vendorId ? ` (${v.vendorId})` : ""}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="vendor"
                placeholder="Or type vendor name manually..."
                value={formData.vendor}
                onChange={(e) => {
                  handleInputChange(e);
                  setSelectedVendorId("");
                }}
                onBlur={handleVendorBlur}
                className={`w-full bg-cms-card border ${errors.vendor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {selectedVendorId && (registeredVendors.find((v) => v._id === selectedVendorId)?.materials?.length ?? 0) > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  Materials, weight, code & price/kg loaded from vendor — totals auto-calculated
                </p>
              )}
              {errors.vendor && (
                <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>
              )}
              {formData.vendor.trim() && (
                <div className="mt-2 p-2 bg-muted/50 border border-border rounded-md text-xs space-y-1 max-w-md">
                  {loadingVendorBalance ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading balance...
                    </div>
                  ) : vendorBalance ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payable</span>
                        <span className="font-medium text-red-600">Rs. {(vendorBalance.payableBalance || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Advance (available)</span>
                        <span className="font-medium text-green-600">Rs. {(vendorBalance.advanceBalance || 0).toLocaleString()}</span>
                      </div>
                      {!isEdit && billPrice > 0 && (vendorBalance.advanceBalance || 0) > 0 && (
                        <p className="text-[11px] text-green-700 dark:text-green-400 pt-1 border-t border-border/50">
                          Auto: Rs. {Math.min(vendorBalance.advanceBalance || 0, billPrice).toLocaleString()} advance is bill par apply ho jayegi
                        </p>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>

            <div className="mb-4 p-4 border border-border rounded-lg bg-cms-card/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Materials *</h4>
                  <p className="text-xs text-muted-foreground">Add 2–3 materials by hand — name, weight, price per kg</p>
                </div>
                <button
                  type="button"
                  onClick={addMaterialRow}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Material
                </button>
              </div>
              {errors.materialName && (
                <p className="text-xs text-red-500 mb-2">{errors.materialName}</p>
              )}
              <div className="space-y-3">
                {materialRows.map((row, index) => {
                  const rowTotal = (parseFloat(row.weight) || 0) * (parseFloat(row.pricePerKg) || 0);
                  const catalogNames = materialCatalog.map((m) => m.name);
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-background border border-border rounded-md">
                      <div className="col-span-4">
                        <label className="block text-xs text-muted-foreground mb-1">Material Name</label>
                        <input
                          type="text"
                          list={`material-names-${index}`}
                          placeholder="e.g HD, LDPE, PP..."
                          value={row.name}
                          onChange={(e) => updateMaterialRow(index, "name", e.target.value)}
                          className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm text-foreground"
                        />
                        <datalist id={`material-names-${index}`}>
                          {catalogNames.map((n) => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Weight (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={row.weight}
                          onChange={(e) => updateMaterialRow(index, "weight", e.target.value)}
                          className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Price/kg</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.pricePerKg}
                          onChange={(e) => updateMaterialRow(index, "pricePerKg", e.target.value)}
                          className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm text-foreground"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-muted-foreground mb-1">Total</label>
                        <div className="px-2 py-2 text-sm font-medium text-foreground bg-muted/50 border border-border rounded-md">
                          Rs. {rowTotal.toLocaleString()}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs text-muted-foreground mb-1">Code *</label>
                        <select
                          value={row.productCode}
                          onChange={(e) => updateMaterialRow(index, "productCode", e.target.value)}
                          className="w-full bg-cms-card border border-border rounded-md px-1 py-2 text-xs text-foreground"
                        >
                          <option value="">—</option>
                          {PRODUCT_CODES.map((code) => (
                            <option key={code.code} value={code.code}>{code.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {materialRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMaterialRow(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {formData.materialName && (
                <p className="text-xs text-muted-foreground mt-2">
                  Combined: {formData.materialName} — {formData.weight} kg — Rs. {parseFloat(formData.price || "0").toLocaleString()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Total Price (Rs.) *</label>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  placeholder="Auto from materials"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.price ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Total Weight (kg) *</label>
                <input
                  type="number"
                  name="weight"
                  min="0"
                  step="0.1"
                  placeholder="Auto from materials"
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
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
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
                  
                  <div className="mt-2">
                    {!showCustomQualityInput ? (
                      <button
                        type="button"
                        onClick={() => setShowCustomQualityInput(true)}
                        className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Custom Quality
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customQuality}
                          onChange={(e) => setCustomQuality(e.target.value)}
                          placeholder="Enter custom quality"
                          className="flex-1 bg-cms-card border border-border rounded-md px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomQuality}
                          className="px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomQualityInput(false);
                            setCustomQuality("");
                          }}
                          className="px-2 py-1 bg-cms-card border border-border text-foreground rounded-md text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {errors.quality && (
                  <p className="text-xs text-red-500 mt-1">{errors.quality}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Date & Time *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={purchaseDateAnchorRef}>
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
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment Method</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="cash">Cash (From Drawer)</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="bank">Bank (Generic)</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="online">Online Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Advance (vendor credit — paid)
                </label>
                <input
                  type="number"
                  name="advancePayment"
                  min="0"
                  step="0.01"
                  placeholder="Auto from vendor advance"
                  value={formData.advancePayment}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.advancePayment ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.advancePayment && (
                  <p className="text-xs text-red-500 mt-1">{errors.advancePayment}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Pehle di hui vendor advance — bill par paid count hoti hai
                </p>
              </div>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Enter additional payment (if any)
                </p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment Status</label>
                <div className="mt-2">
                  {formData.price && (formData.advancePayment || formData.amountPaid) ? (
                    totalAmount > parseFloat(formData.price) ? (
                      <span className="text-xs font-medium text-red-600">
                        Overpaid — reduce payment to save
                      </span>
                    ) : (
                    <PaymentStatusBadge 
                      status={
                        totalAmount >= parseFloat(formData.price) ? 'paid' :
                        totalAmount > 0 ? 'partial' : 'none'
                      } 
                    />
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">Enter amounts to see status</span>
                  )}
                </div>
                {billPrice > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-800 dark:text-amber-200">Remaining payable</span>
                      <span className="font-bold text-amber-900 dark:text-amber-100">
                        Rs. {remainingPayable.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                {formData.price && (formData.advancePayment || formData.amountPaid) && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {financeApi.getMethodIcon(financeMethod, "w-3 h-3")}
                        <span className="text-xs text-blue-700">{financeApi.getMethodLabel(financeMethod)} Balance:</span>
                      </div>
                      <span className="text-sm font-semibold text-blue-800">
                        {checkingBalance ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          `Rs. ${currentBalance.toLocaleString()}`
                        )}
                      </span>
                    </div>
                    {totalAmount > 0 && (
                      <div className="mt-1 text-xs text-blue-600">
                        Remaining after payment: Rs. {(currentBalance - totalAmount).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Delivery Vehicle Details</h3>
            <p className="text-xs text-muted-foreground mb-4">Optional — khali chhor sakte hain</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Name</label>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Type</label>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Number</label>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Driver Name</label>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Color</label>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Delivery Date & Time</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={deliveryDateAnchorRef}>
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
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Invoice No. (PV — auto)</label>
                <input
                  type="text"
                  readOnly
                  placeholder="PV052600001"
                  value={previewInvoiceNo}
                  className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary read-only:opacity-80"
                />
                <p className="text-xs text-muted-foreground mt-1">System-generated purchase invoice</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Bill Number (manual)</label>
                <input
                  type="text"
                  name="billNo"
                  placeholder="e.g. vendor bill / challan no."
                  value={formData.billNo}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.billNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.billNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.billNo}</p>
                )}
              </div>
              <div>
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

// Main POPView Component
export function POPView() {
  const [purchases, setPurchases] = useState<PurchaseWithRemaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [approvingPurchase, setApprovingPurchase] = useState(false);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<PurchaseWithRemaining | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [markAsPaidModalOpen, setMarkAsPaidModalOpen] = useState(false);
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [selectedPurchaseForPayment, setSelectedPurchaseForPayment] = useState<PurchaseWithRemaining | null>(null);
  
  // Vendor pay total modal states
  const [vendorPayModalOpen, setVendorPayModalOpen] = useState(false);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);
  const [payTotalVendorData, setPayTotalVendorData] = useState<{ vendorName: string; purchases: PurchaseWithRemaining[]; totalRemaining: number } | null>(null);
  
  // Vendor payment history modal states
  const [vendorViewPaymentsModalOpen, setVendorViewPaymentsModalOpen] = useState(false);
  const [selectedVendorForPayments, setSelectedVendorForPayments] = useState<string | null>(null);
  const [vendorViewDateFilter, setVendorViewDateFilter] = useState<string>("");
  
  // Handler for vendor pay total
  const handleVendorPayTotal = (vendorName: string, vendorPurchases: PurchaseWithRemaining[], totalRemaining: number) => {
    setPayTotalVendorData({
      vendorName,
      purchases: vendorPurchases,
      totalRemaining
    });
    setVendorPayModalOpen(true);
  };
  
  // Handler for viewing vendor payments
  const handleViewVendorPayments = (vendorName: string) => {
    setSelectedVendorForPayments(vendorName);
    setVendorViewDateFilter("");
    setVendorViewPaymentsModalOpen(true);
  };
  
  // Handler for deleting vendor
  const handleDeleteVendor = async (vendorName: string) => {
    if (!confirm(`Are you sure you want to delete all purchases from vendor "${vendorName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const vendorPurchases = purchases.filter(p => p.vendor === vendorName);
      for (const purchase of vendorPurchases) {
        await api.delete(`${PURCHASES_API_URL}/${purchase._id}`);
      }
      
      toast({
        title: "Success",
        description: `Deleted all purchases from vendor "${vendorName}"`,
      });
      
      await fetchPurchases();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete vendor purchases",
        variant: "destructive",
      });
    }
  };
  
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
      return sum + getPurchaseTotalPaid(p);
    }, 0);
    
    const totalRemainingAmount = purchases.reduce((sum, p) => {
      return sum + getPurchaseRemainingAmount(p);
    }, 0);
    
    const totalWeight = purchases.reduce((sum, p) => {
      const weight = parseFloat(p.weight) || 0;
      return sum + weight;
    }, 0);
    
    const totalProcessWeight = purchases.reduce((sum, p) => {
      return sum + (p.processWeight ?? p.productionConsumedWeight ?? 0);
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
      totalProcessWeight,
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
        
        const purchasesWithRemaining = purchasesData.map((purchase: any) => {
          const originalWeight = parseFloat(purchase.weight) || 0;
          const soldWeight = purchase.soldWeight || 0;
          const productionConsumed = purchase.productionConsumedWeight || 0;
          const remainingWeight = purchase.remainingWeight ?? Math.max(0, originalWeight - soldWeight - productionConsumed);
          
          const parsedPrice = parseConcatenatedPrices(purchase.price);
          
          const colorNames = getColorSearchNames(purchase.materialColor);
          
          const withPrice = { ...purchase, price: parsedPrice };
          const totalPaid = getPurchaseTotalPaid(withPrice);
          const remainingAmount = getPurchaseRemainingAmount(withPrice);
          const paidAmount = getPurchasePaidStatus(withPrice);

          return {
            ...withPrice,
            totalPaid,
            remainingAmount,
            paidAmount,
            totalWeight: originalWeight,
            soldWeight: soldWeight,
            processWeight: productionConsumed,
            remainingWeight: remainingWeight,
            status: purchase.status || 'available',
            materialColorName: getColorName(purchase.materialColor),
            materialColorSearchNames: colorNames
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

  const handleEditPurchase = async (purchase: PurchaseWithRemaining) => {
    try {
      const res = await api.get(`/api/purchases/${purchase._id}`);
      if (res.data.success && res.data.data) {
        setSelectedPurchaseForEdit(res.data.data);
      } else {
        setSelectedPurchaseForEdit(purchase);
      }
    } catch {
      setSelectedPurchaseForEdit(purchase);
    }
    setIsEditMode(true);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setIsEditMode(false);
      setSelectedPurchaseForEdit(null);
    }
  };

  const handleDeletePurchase = async (id: string) => {
    if (
      window.confirm(
        'Is POP ko delete karen? Linked POS sales, production, vendor ledger aur finance amounts sab adjust ho jayengi.'
      )
    ) {
      try {
        const response = await api.delete(`${PURCHASES_API_URL}/${id}`);
        
        if (response.data.success) {
          const updatedPayments = allPayments.filter(payment => payment.purchaseId !== id);
          setAllPayments(updatedPayments);
          
          await fetchPurchases();
          const s = response.data.summary;
          const detail = s
            ? `Sales: ${s.salesDeleted}, Production: ${s.productionsDeleted}, Vendor entries: ${s.vendorLedgerEntriesRemoved}, Finance reversals: ${s.financeReversals}`
            : '';
          toast({
            title: "Success",
            description: detail
              ? `Purchase deleted. ${detail}`
              : response.data.message || "Purchase deleted successfully!",
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

  const handlePaymentSuccess = async (newPayment: PaymentHistory | PaymentHistory[]) => {
    const payments = Array.isArray(newPayment) ? newPayment : [newPayment];
    setAllPayments(prev => [...prev, ...payments]);
    await fetchPurchases();
    setPaymentModalOpen(false);
    setMarkAsPaidModalOpen(false);
    setVendorPayModalOpen(false);
    setSelectedPurchaseForPayment(null);
    setPayTotalVendorData(null);
  };

  const filteredPurchases = purchases.filter(purchase => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) return true;
    
    if (purchase.materialName?.toLowerCase().includes(searchLower)) return true;
    if (purchase.vendor?.toLowerCase().includes(searchLower)) return true;
    if (purchase.quality?.toLowerCase().includes(searchLower)) return true;
    if (purchase.invoiceNo?.toLowerCase().includes(searchLower)) return true;
    if (purchase.billNo?.toLowerCase().includes(searchLower)) return true;
    if (purchase.receiptNo?.toLowerCase().includes(searchLower)) return true;
    if (purchase.materialColor?.toLowerCase().includes(searchLower)) return true;
    if (purchase.materialColorName?.toLowerCase().includes(searchLower)) return true;
    if (purchase.materialColorSearchNames?.some(name => name.includes(searchLower))) return true;
    if (purchase.vehicleColor?.toLowerCase().includes(searchLower)) return true;
    if (purchase.vehicleNumber?.toLowerCase().includes(searchLower)) return true;
    if (purchase.driverName?.toLowerCase().includes(searchLower)) return true;
    if (purchase.vehicleType?.toLowerCase().includes(searchLower)) return true;
    if (purchase.vehicleName?.toLowerCase().includes(searchLower)) return true;
    
    return false;
  });

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

  const getExportPurchases = () => {
    return filteredPurchases.filter((purchase) =>
      inDateRange(purchase.purchaseDate || purchase.createdAt, exportStartDate || undefined, exportEndDate || undefined)
    );
  };

  const handleExportPurchases = (format: "excel" | "word" | "pdf") => {
    const exportRows = getExportPurchases();
    if (exportRows.length === 0) {
      toast({
        title: "No data",
        description: "No POP records found for selected date range.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Date",
      "Invoice No",
      "Bill No",
      "Material Name",
      "Quality",
      "Vendor",
      "Total Weight (kg)",
      "Used Weight (kg)",
      "Remaining Weight (kg)",
      "Price",
      "Amount Paid",
      "Remaining Amount",
      "Payment Status",
    ];
    const rows = exportRows.map((p) => ({
      "Date": formatDateTime(p.purchaseDate || p.createdAt),
      "Invoice No": p.invoiceNo || "N/A",
      "Bill No": p.billNo || p.receiptNo || "N/A",
      "Material Name": p.materialName || "N/A",
      "Quality": p.quality || "N/A",
      "Vendor": p.vendor || "N/A",
      "Total Weight (kg)": p.weight || 0,
      "Used Weight (kg)": p.productionConsumedWeight || 0,
      "Remaining Weight (kg)": p.remainingWeight || 0,
      "Price": p.price || 0,
      "Amount Paid": getPurchaseTotalPaid(p),
      "Remaining Amount": getPurchaseRemainingAmount(p),
      "Payment Status": getPurchasePaidStatus(p),
    }));
    const rangeText =
      exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : toYmd(new Date());

    if (format === "excel") {
      exportAsCsv(`POP_Report_${rangeText}.csv`, headers, rows);
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
      exportAsPdf("POP Report", body);
    } else {
      exportAsWordTable(`POP_Report_${rangeText}.doc`, "POP Report", headers, rows);
    }
    toast({
      title: "Export complete",
      description: `${exportRows.length} POP records exported.`,
    });
  };

  const totals = calculateTotals();

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredPurchases.slice(startIndex, endIndex);

  if (showDetails && selectedPurchaseId) {
    const selectedPurchase = purchases.find((p) => p._id === selectedPurchaseId);
    const userRole = getCurrentUser().role;

    const handleApprovePurchase = async () => {
      try {
        setApprovingPurchase(true);
        const response = await api.patch(`/api/purchases/${selectedPurchaseId}/approve`);
        if (response.data.success) {
          toast({
            title: "Approved",
            description: "Purchase approved successfully.",
          });
          await fetchPurchases();
        } else {
          throw new Error(response.data.message || "Failed to approve purchase");
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.response?.data?.message || error.message || "Failed to approve purchase",
          variant: "destructive",
        });
      } finally {
        setApprovingPurchase(false);
      }
    };

    return (
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
        {canApprove(userRole) && selectedPurchase?.approvalStatus === "pending" && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleApprovePurchase}
              disabled={approvingPurchase}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {approvingPurchase ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </>
              )}
            </button>
          </div>
        )}
        <PurchaseDetailsView 
          purchaseId={selectedPurchaseId} 
          onBack={() => {
            setShowDetails(false);
            setSelectedPurchaseId(null);
          }} 
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
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
                  <span className="text-primary">Weight Used: {formatCurrency(totals.totalProcessWeight)} kg</span>
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

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by Material, Quality (e.g., PP750), Color (e.g., red, lal), Receipt No., Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-96"
          />
          {searchTerm && (
            <X
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setSearchTerm("")}
            />
          )}
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
            onClick={() => handleExportPurchases("excel")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => handleExportPurchases("pdf")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => handleExportPurchases("word")}
            className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word
          </button>
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

      {/* Vendor Summary Component */}
      {filteredPurchases.length > 0 && (
        <VendorSummary 
          purchases={filteredPurchases} 
          searchTerm={searchTerm}
          onPayTotal={handleVendorPayTotal}
          onViewPayments={handleViewVendorPayments}
          onDeleteVendor={handleDeleteVendor}
        />
      )}

      {/* Weight Summary Component */}
      {filteredPurchases.length > 0 && (
        <WeightSummary purchases={filteredPurchases} searchTerm={searchTerm} />
      )}

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
              {searchTerm ? `No purchases match "${searchTerm}"` : 'Add your first purchase to get started.'}
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Invoice No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Bill No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Quality</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Amount Paid</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Payment Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Weight Used (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Stock Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vendor</th>
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
                        <span className="text-sm font-mono font-medium text-foreground">{purchase.invoiceNo || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full border border-border"
                            style={{ backgroundColor: purchase.materialColor || '#FFFFFF' }}
                          />
                          <span className="text-sm font-medium text-foreground">{purchase.billNo || purchase.receiptNo || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{purchase.materialName || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: purchase.materialColor || '#FFFFFF' }}
                          />
                          <span>{purchase.materialColorName || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{purchase.quality || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-semibold">
                        Rs. {formatCurrency(purchase.price || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                        Rs. {formatCurrency(getPurchaseTotalPaid(purchase))}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-semibold ${
                          getPurchaseRemainingAmount(purchase) > 0 
                            ? 'text-red-600' 
                            : 'text-green-600'
                        }`}>
                          Rs. {formatCurrency(getPurchaseRemainingAmount(purchase))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={getPurchasePaidStatus(purchase)} />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="font-medium">{formatCurrency(purchase.totalWeight)} kg</div>
                        <div className="text-xs text-muted-foreground">Original: {formatCurrency(purchase.weight)} kg</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className={`font-medium ${(purchase.processWeight ?? purchase.productionConsumedWeight ?? 0) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          {formatCurrency(purchase.processWeight ?? purchase.productionConsumedWeight ?? 0)} kg
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
                          {getPurchasePaidStatus(purchase) !== 'paid' && getPurchaseRemainingAmount(purchase) > 0 && (
                            <button 
                              onClick={() => handleRecordPayment(purchase)}
                              className="p-1.5 hover:bg-green-100 rounded transition-colors text-muted-foreground hover:text-green-600"
                              title="Record Payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {getPurchasePaidStatus(purchase) !== 'paid' && getPurchaseRemainingAmount(purchase) > 0 && (
                            <button 
                              onClick={() => handleMarkAsPaid(purchase)}
                              className="p-1.5 hover:bg-blue-100 rounded transition-colors text-muted-foreground hover:text-blue-600"
                              title="Mark as Paid"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {getPurchaseTotalPaid(purchase) > 0 && (
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

            {filteredPurchases.length > 0 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border bg-cms-card">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages || 1}
                </span>
                {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
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
                {totalPages > 1 && totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="text-muted-foreground px-2">...</span>
                )}
                {totalPages > 1 && totalPages > 5 && currentPage < totalPages - 2 && (
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
                  aria-label="Next page"
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
        onOpenChange={handleDialogOpenChange}
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

      <PayTotalVendorModal
        open={vendorPayModalOpen}
        onClose={() => {
          setVendorPayModalOpen(false);
          setPayTotalVendorData(null);
        }}
        vendorName={payTotalVendorData?.vendorName ?? ""}
        purchases={payTotalVendorData?.purchases ?? []}
        totalRemaining={payTotalVendorData?.totalRemaining ?? 0}
        onSuccess={handlePaymentSuccess}
        formatCurrency={formatCurrency}
      />

      {/* Vendor View Payments Modal - sara record is date ko, payment history */}
      {vendorViewPaymentsModalOpen && selectedVendorForPayments && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-cms-table-header px-4 py-3 border-b border-border flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground">Payment records — {selectedVendorForPayments}</h3>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={vendorViewDateFilter}
                  onChange={(e) => setVendorViewDateFilter(e.target.value)}
                  className="bg-cms-card border border-border rounded-md px-2 py-1.5 text-xs text-foreground"
                  placeholder="Filter by date"
                />
                <button onClick={() => { setVendorViewPaymentsModalOpen(false); setSelectedVendorForPayments(null); setVendorViewDateFilter(""); }} className="p-1.5 hover:bg-cms-card-hover rounded">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {(() => {
                const vendorPurchaseIds = filteredPurchases.filter((p) => p.vendor === selectedVendorForPayments).map((p) => p._id);
                let payments = allPayments.filter((p) => vendorPurchaseIds.includes(p.purchaseId));
                if (vendorViewDateFilter) {
                  payments = payments.filter((p) => p.paymentDate === vendorViewDateFilter);
                }
                payments = [...payments].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());
                const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
                return (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {vendorViewDateFilter ? `Payments on ${vendorViewDateFilter}` : "All payment records (date-wise)"}
                    </p>
                    {payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No payment records found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-cms-table-header">
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Receipt No</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Material</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Method</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((payment, index) => (
                              <tr key={index} className="border-b border-border hover:bg-cms-card-hover">
                                <td className="px-3 py-2 text-foreground">{new Date(payment.paymentDate).toLocaleDateString('en-GB')}</td>
                                <td className="px-3 py-2 text-foreground">{payment.receiptNo || 'N/A'}</td>
                                <td className="px-3 py-2 text-foreground">{payment.materialName || 'N/A'}</td>
                                <td className="px-3 py-2 text-foreground">{payment.paymentMethod || 'N/A'}</td>
                                <td className="px-3 py-2 text-right text-foreground font-medium">Rs. {payment.amount.toLocaleString()}</td>
                                <td className="px-3 py-2 text-foreground">{payment.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-cms-table-header font-medium">
                              <td colSpan={4} className="px-3 py-2 text-right text-foreground">Total Payments:</td>
                              <td className="px-3 py-2 text-right text-foreground font-bold">Rs. {totalAmount.toLocaleString()}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                        <p className="text-xs text-muted-foreground mt-2">
                          {payments.length} payment{payments.length !== 1 ? 's' : ''} • Total: Rs. {totalAmount.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default POPView;