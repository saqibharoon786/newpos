import { useState, useEffect } from "react";
import { Search, Plus, Printer, Phone, Mail, Users, Eye, Edit2, Trash2, RefreshCw, FolderOpen, Download, MoreVertical, Calendar, Loader2, DollarSign } from "lucide-react";
import { AddCustomerDialog, CustomerFormData } from "./AddCustomerDialog";
import { AddCustomerQuickDialog } from "./AddCustomerQuickDialog";
import { CustomerWiseSummary } from "./CustomerWiseSummary";
import { toast } from "sonner";
import api from "@/lib/api";
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from "@/lib/exportUtils";

interface Customer {
  _id: string;
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
  amount: number;
  amountPaid: number;
  paidAmount: string;
  financeAdvanceBalance?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerAdvanceRow {
  date: string;
  amount: number;
  method?: string;
  description?: string;
  reference?: string;
  source?: string;
  transactionId?: string;
  ledgerEntryId?: string;
  canDelete?: boolean;
}

interface CustomerFinanceSummary {
  financeAdvanceBalance: number;
  totalAdvanceCredit: number;
  totalBalanceDue: number;
  posPending: number;
}

const FINANCE_API = "/api/finance";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  drawer: "Cash Drawer",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank",
};

// Helper function to get month name
const getMonthName = (monthNumber: number): string => {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return months[monthNumber - 1] || "";
};

// Updated date formatting function to show month names like "22 Jan 2026"
const formatDateWithMonthName = (dateString: string | Date): string => {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = getMonthName(date.getMonth() + 1);
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  } catch (error) {
    return "N/A";
  }
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

// Calculate pending amount
const calculatePendingAmount = (amount: number, amountPaid: number): number => {
  return Math.max(0, amount - amountPaid);
};

// Get payment status badge color
const getPaymentStatusColor = (paidAmount: string) => {
  switch (paidAmount) {
    case 'fully':
      return 'bg-green-500/10 text-green-600';
    case 'partial':
      return 'bg-yellow-500/10 text-yellow-600';
    case 'none':
      return 'bg-gray-500/10 text-gray-600';
    default:
      return 'bg-gray-500/10 text-gray-600';
  }
};

// Get payment status text
const getPaymentStatusText = (paidAmount: string) => {
  switch (paidAmount) {
    case 'fully':
      return 'Fully Paid';
    case 'partial':
      return 'Partially Paid';
    case 'none':
      return 'Not Paid';
    default:
      return 'Not Paid';
  }
};

interface PosSale {
  buyerName?: string;
  finalAmount?: string;
  sellingPrice?: string;
  amountPaid?: number;
  remainingAmount?: number;
  weight?: string;
  unit?: string;
  quality?: string;
  materialName?: string;
  materialColor?: string;
}

export default function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [posSales, setPosSales] = useState<PosSale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [customerAdvanceRows, setCustomerAdvanceRows] = useState<CustomerAdvanceRow[]>([]);
  const [customerFinanceSummary, setCustomerFinanceSummary] =
    useState<CustomerFinanceSummary | null>(null);
  const [loadingCustomerAdvance, setLoadingCustomerAdvance] = useState(false);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);

  const fetchPosSales = async () => {
    try {
      setLoadingSales(true);
      const response = await api.get("/api/sales");
      if (response.data.success) {
        setPosSales(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch POS sales:", error);
      setPosSales([]);
    } finally {
      setLoadingSales(false);
    }
  };

  // Fetch customers from backend
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/api/customers/getall-customers");
      
      if (response.data.success) {
        // Transform backend data to match frontend interface
        const transformedCustomers = response.data.data.map((customer: any) => ({
          _id: customer._id,
          customerName: customer.customerName || "",
          customerId: customer.customerId || `CUST-${new Date(customer.createdAt).getFullYear()}${String(new Date(customer.createdAt).getMonth() + 1).padStart(2, '0')}${String(new Date(customer.createdAt).getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 100000)}`,
          phoneNo: customer.phoneNo || "",
          email: customer.email || "",
          cnicNo: customer.cnicNo || "",
          registrationDate: customer.registrationDate || new Date().toISOString().split('T')[0],
          address: customer.address || "",
          province: customer.province || "",
          city: customer.city || "",
          photo: customer.photo || null,
          documents: customer.documents || [],
          amount: customer.amount || 0,
          amountPaid: customer.amountPaid || 0,
          paidAmount: customer.paidAmount || 'none',
          financeAdvanceBalance: customer.financeAdvanceBalance || 0,
          isActive: customer.isActive !== undefined ? customer.isActive : true,
          createdAt: customer.createdAt || new Date().toISOString(),
          updatedAt: customer.updatedAt || new Date().toISOString(),
        }));
        
        setCustomers(transformedCustomers);
      } else {
        toast.error("Failed to fetch customers: " + (response.data.message || "Unknown error"));
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err.response?.data?.message || err.message || "Failed to load customers");
      setCustomers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchCustomers(), fetchPosSales()]);
  };

  // Load customers on component mount
  useEffect(() => {
    fetchCustomers();
    fetchPosSales();
  }, []);

  const fetchCustomerFinanceData = async (customerId: string) => {
    setLoadingCustomerAdvance(true);
    try {
      const [histRes, linkRes] = await Promise.all([
        api.get(`${FINANCE_API}/customer-advance/${customerId}/history`),
        api.get(`${FINANCE_API}/customer-linked/${customerId}`),
      ]);
      if (histRes.data?.success) {
        const all = (histRes.data.history || []) as CustomerAdvanceRow[];
        setCustomerAdvanceRows(all.filter((r) => r.source === "finance"));
      } else {
        setCustomerAdvanceRows([]);
      }
      if (linkRes.data?.success && linkRes.data.data?.customer) {
        const c = linkRes.data.data.customer;
        const pos = linkRes.data.data.pos || {};
        setCustomerFinanceSummary({
          financeAdvanceBalance: c.financeAdvanceBalance || 0,
          totalAdvanceCredit: c.totalAdvanceCredit || 0,
          totalBalanceDue: c.totalBalanceDue || 0,
          posPending: pos.totalRemaining || 0,
        });
        setSelectedCustomer((prev) =>
          prev && prev._id === customerId
            ? { ...prev, financeAdvanceBalance: c.financeAdvanceBalance || 0 }
            : prev
        );
      }
    } catch {
      setCustomerAdvanceRows([]);
      setCustomerFinanceSummary(null);
    } finally {
      setLoadingCustomerAdvance(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer?._id) {
      fetchCustomerFinanceData(selectedCustomer._id);
    } else {
      setCustomerAdvanceRows([]);
      setCustomerFinanceSummary(null);
    }
  }, [selectedCustomer?._id]);

  const handleDeleteCustomerAdvance = async (row: CustomerAdvanceRow) => {
    if (
      !selectedCustomer ||
      !window.confirm(
        "Ye finance advance entry delete karen? Cash account aur customer balance adjust ho jayega."
      )
    ) {
      return;
    }
    const deleteKey = row.transactionId || row.ledgerEntryId || "";
    setDeletingAdvanceId(deleteKey);
    try {
      let res;
      if (row.transactionId) {
        res = await api.delete(`${FINANCE_API}/party-advance/${row.transactionId}`);
      } else if (row.ledgerEntryId) {
        res = await api.delete(
          `${FINANCE_API}/customer-advance/${selectedCustomer._id}/entry/${row.ledgerEntryId}`
        );
      } else {
        toast.error("Delete nahi ho sakta — entry link missing");
        return;
      }
      if (res.data?.success) {
        toast.success(res.data.message || "Advance delete ho gayi");
        await Promise.all([
          fetchCustomerFinanceData(selectedCustomer._id),
          fetchCustomers(),
        ]);
      } else {
        toast.error(res.data?.message || "Delete failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Delete failed");
    } finally {
      setDeletingAdvanceId(null);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phoneNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCustomers = (format: "csv" | "excel" | "pdf") => {
    if (!filteredCustomers.length) {
      toast.error("Export ke liye koi customer nahi");
      return;
    }

    const headers = [
      "Customer ID",
      "Customer Name",
      "Phone",
      "Email",
      "City",
      "Province",
      "Total Amount (PKR)",
      "Paid (PKR)",
      "Pending (PKR)",
      "Payment Status",
      "Finance Advance (PKR)",
      "Registration Date",
    ];

    const rows = filteredCustomers.map((c) => {
      const pending = calculatePendingAmount(c.amount, c.amountPaid);
      return {
        "Customer ID": c.customerId,
        "Customer Name": c.customerName,
        Phone: c.phoneNo || "",
        Email: c.email || "",
        City: c.city || "",
        Province: c.province || "",
        "Total Amount (PKR)": c.amount,
        "Paid (PKR)": c.amountPaid,
        "Pending (PKR)": pending,
        "Payment Status": getPaymentStatusText(c.paidAmount),
        "Finance Advance (PKR)": c.financeAdvanceBalance ?? 0,
        "Registration Date": formatDateWithMonthName(c.registrationDate),
      };
    });

    const name = `Customers_${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      exportAsCsv(`${name}.csv`, headers, rows);
    } else if (format === "excel") {
      exportAsExcelTable(`${name}.xls`, "Customers", headers, rows);
    } else {
      const body = rows
        .map(
          (r) =>
            `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`).join("")}</tr>`
        )
        .join("");
      exportAsPdf(
        "Customers",
        `<table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`
      );
    }

    toast.success(`${rows.length} customer(s) exported`);
  };

  const handlePrintAllCustomers = () => {
    if (!filteredCustomers.length) {
      toast.error("Print ke liye koi customer nahi");
      return;
    }
    exportCustomers("pdf");
  };

  // Calculate summary statistics
  const totalAmount = customers.reduce((sum, customer) => sum + customer.amount, 0);
  const totalPaid = customers.reduce((sum, customer) => sum + customer.amountPaid, 0);
  const totalPending = customers.reduce((sum, customer) => sum + calculatePendingAmount(customer.amount, customer.amountPaid), 0);
  
  // Count customers by payment status
  const fullyPaidCustomers = customers.filter(c => c.paidAmount === 'fully').length;
  const partiallyPaidCustomers = customers.filter(c => c.paidAmount === 'partial').length;
  const notPaidCustomers = customers.filter(c => c.paidAmount === 'none').length;

  // Optimized Print Functionality for Single Page
  const handlePrintCustomer = (customer: Customer) => {
    setIsPrinting(true);
    
    const pendingAmount = calculatePendingAmount(customer.amount, customer.amountPaid);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Details - ${customer.customerName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', 'Arial', sans-serif;
            font-size: 8pt;
            line-height: 1.2;
            color: #000;
            width: 100%;
            height: 100%;
            padding: 0;
            margin: 0;
          }
          
          .print-container {
            width: 100%;
            max-height: 280mm;
            overflow: hidden;
            padding: 0;
          }
          
          /* Header */
          .print-header {
            text-align: center;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1.5px solid #000;
          }
          
          .print-title {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 2px;
            color: #000;
          }
          
          .print-subtitle {
            font-size: 9pt;
            color: #666;
          }
          
          /* Customer Summary */
          .customer-summary {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            padding: 5px;
            background: #f5f5f5;
            border-radius: 3px;
          }
          
          .avatar-container {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            overflow: hidden;
            margin-right: 10px;
            border: 1px solid #ddd;
            flex-shrink: 0;
          }
          
          .avatar-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .customer-basic-info {
            flex: 1;
          }
          
          .customer-name {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }
          
          .customer-id {
            font-size: 9pt;
            color: #666;
          }
          
          /* Financial Summary */
          .financial-summary {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            padding: 8px;
            border: 1px solid #dee2e6;
          }
          
          .financial-item {
            text-align: center;
            flex: 1;
            padding: 0 5px;
          }
          
          .financial-label {
            font-size: 7pt;
            color: #666;
            margin-bottom: 2px;
          }
          
          .financial-value {
            font-size: 10pt;
            font-weight: bold;
            color: #000;
          }
          
          .financial-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 7pt;
            font-weight: bold;
            margin-top: 2px;
          }
          
          /* Sections */
          .print-section {
            margin-bottom: 8px;
            page-break-inside: avoid;
          }
          
          .section-title {
            font-size: 10pt;
            font-weight: bold;
            color: #000;
            padding: 4px 0;
            margin-bottom: 4px;
            border-bottom: 1px solid #ccc;
            background: #f0f0f0;
            padding-left: 5px;
          }
          
          /* Compact Grids */
          .compact-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 4px;
            margin-bottom: 4px;
          }
          
          .compact-item {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            font-size: 8pt;
          }
          
          .compact-label {
            font-weight: 600;
            color: #444;
            min-width: 90px;
          }
          
          .compact-value {
            color: #000;
            text-align: right;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          /* Footer */
          .print-footer {
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #ccc;
            text-align: center;
            color: #666;
            font-size: 7pt;
          }
          
          /* Utility */
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .mb-1 { margin-bottom: 4px; }
          .mt-1 { margin-top: 4px; }
          .no-wrap { white-space: nowrap; }
          .truncate { 
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          /* Print Optimization */
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              height: 100%;
              width: 100%;
            }
            
            .print-container {
              height: 100%;
              max-height: 100%;
              page-break-inside: avoid;
              page-break-after: avoid;
              page-break-before: avoid;
            }
            
            /* Prevent breaks */
            .no-break {
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            
            /* Force single page */
            html, body {
              height: 100%;
              overflow: hidden;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container no-break">
          <!-- Header -->
          <div class="print-header">
            <div class="print-title">CUSTOMER DETAILS REPORT</div>
            <div class="print-subtitle">Date: ${new Date().toLocaleDateString('en-GB')} | Time: ${new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
          
          <!-- Customer Summary -->
          <div class="customer-summary">
            <div class="avatar-container">
              <img src="${customer.photo || ''}" alt="${customer.customerName}" onerror="this.style.display='none'">
            </div>
            <div class="customer-basic-info">
              <div class="customer-name">${customer.customerName}</div>
              <div class="customer-id">ID: ${customer.customerId}</div>
              <div class="customer-id">Phone: ${customer.phoneNo} | Email: ${customer.email || 'N/A'}</div>
            </div>
          </div>
          
          <!-- Financial Summary -->
          <div class="financial-summary">
            <div class="financial-item">
              <div class="financial-label">Total Amount</div>
              <div class="financial-value">PKR ${customer.amount.toLocaleString()}</div>
            </div>
            <div class="financial-item">
              <div class="financial-label">Amount/Payment Received</div>
              <div class="financial-value">PKR ${customer.amountPaid.toLocaleString()}</div>
            </div>
            <div class="financial-item">
              <div class="financial-label">Pending Amount</div>
              <div class="financial-value">PKR ${pendingAmount.toLocaleString()}</div>
            </div>
            <div class="financial-item">
              <div class="financial-label">Payment Status</div>
              <div class="financial-value">
                <span class="financial-status" style="background-color: ${
                  customer.paidAmount === 'fully' ? '#10b981' : 
                  customer.paidAmount === 'partial' ? '#f59e0b' : 
                  '#6b7280'
                }; color: white;">
                  ${getPaymentStatusText(customer.paidAmount)}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Personal Details -->
          <div class="print-section no-break">
            <div class="section-title">PERSONAL INFORMATION</div>
            <div class="compact-grid">
              <div class="compact-item">
                <span class="compact-label">Full Name:</span>
                <span class="compact-value">${customer.customerName}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Phone:</span>
                <span class="compact-value">${customer.phoneNo}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Email:</span>
                <span class="compact-value truncate">${customer.email || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">CNIC:</span>
                <span class="compact-value">${customer.cnicNo || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Registration Date:</span>
                <span class="compact-value">${formatDateWithMonthName(customer.registrationDate)}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Account Status:</span>
                <span class="compact-value">
                  <span style="background-color: ${customer.isActive ? '#10b981' : '#ef4444'}; color: white; padding: 1px 6px; border-radius: 8px; font-size: 7pt;">
                    ${customer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
            </div>
          </div>
          
          <!-- Address Information -->
          <div class="print-section no-break">
            <div class="section-title">ADDRESS INFORMATION</div>
            <div class="compact-grid">
              <div class="compact-item">
                <span class="compact-label">Address:</span>
                <span class="compact-value">${customer.address || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">City:</span>
                <span class="compact-value">${customer.city || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Province:</span>
                <span class="compact-value">${customer.province || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Member Since:</span>
                <span class="compact-value">${formatDateWithMonthName(customer.createdAt)}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Last Updated:</span>
                <span class="compact-value">${formatDateWithMonthName(customer.updatedAt)}</span>
              </div>
            </div>
          </div>
          
          <!-- Documents -->
          <div class="print-section no-break">
            <div class="section-title">DOCUMENTS</div>
            <div class="compact-item">
              <span class="compact-label">Total Documents:</span>
              <span class="compact-value">${customer.documents?.length || 0} file(s)</span>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="print-footer">
            <div>Customer Management System - Official Document</div>
            <div>Page 1 of 1</div>
          </div>
        </div>
        
        <script>
          // Print after a short delay to ensure styles are loaded
          setTimeout(function() {
            window.print();
            
            // Close window after printing
            setTimeout(function() {
              if (window.onafterprint !== null) {
                window.close();
              }
            }, 500);
          }, 100);
          
          // Clean up state
          window.onafterprint = function() {
            window.onafterprint = null;
          };
        </script>
      </body>
      </html>
    `;
    
    // Create and open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Reset printing state
      printWindow.addEventListener('afterprint', () => {
        setIsPrinting(false);
        printWindow.close();
      });
      
      // Fallback cleanup
      setTimeout(() => {
        if (!printWindow.closed) {
          setIsPrinting(false);
        }
      }, 5000);
    } else {
      // Fallback if popup is blocked
      alert('Please allow popups to print this document.');
      setIsPrinting(false);
    }
  };

  const handleAddCustomer = () => {
    // Clear search term before opening add dialog
    setSearchTerm("");
    setAddDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    // Clear search term before opening edit dialog
    setSearchTerm("");
    
    // Convert Customer to CustomerFormData
    const customerFormData: CustomerFormData = {
      _id: customer._id,
      customerName: customer.customerName,
      customerId: customer.customerId,
      phoneNo: customer.phoneNo,
      email: customer.email,
      cnicNo: customer.cnicNo,
      registrationDate: customer.registrationDate,
      address: customer.address,
      province: customer.province,
      city: customer.city,
      photo: customer.photo,
      documents: customer.documents,
      amount: customer.amount,
      amountPaid: customer.amountPaid,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
    setCustomerToEdit(customerFormData);
    setEditDialogOpen(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (
      !window.confirm(
        "Poora customer record delete karen? Is ke finance advance entries bhi hat jayengi."
      )
    ) {
      return;
    }

    try {
      const response = await api.delete(`/api/customers/${id}`);

      if (response.data.success) {
        toast.success("Customer deleted successfully");
        fetchCustomers();
        setSelectedCustomer(null);
        setSearchTerm("");
      } else {
        toast.error(response.data.message || "Failed to delete customer");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to delete customer");
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    // Clear search term when viewing details
    setSearchTerm("");
  };

  const handleRefresh = () => {
    setSearchTerm("");
    refreshAll();
  };

  // Handle customer added successfully
  const handleCustomerAdded = () => {
    fetchCustomers();
    fetchPosSales();
    // Clear search term when adding new customer
    setSearchTerm("");
  };

  // Handle customer updated successfully
  const handleCustomerUpdated = () => {
    fetchCustomers();
    setSelectedCustomer(null); // Close detail view if open
    // Clear search term when updating customer
    setSearchTerm("");
  };

  // Handle closing detail view
  const handleCloseDetailView = () => {
    setSelectedCustomer(null);
    // Clear search term when closing detail view
    setSearchTerm("");
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchTerm("");
  };

  // Render Customer Detail View
  const renderCustomerDetailView = () => {
    if (!selectedCustomer) return null;

    const pendingAmount = calculatePendingAmount(selectedCustomer.amount, selectedCustomer.amountPaid);

    return (
      <div className="bg-cms-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCloseDetailView}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              ←
            </button>
            <div className="flex items-center gap-4">
              <img 
                src={selectedCustomer.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"} 
                alt={selectedCustomer.customerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-border"
              />
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedCustomer.customerName}</h2>
                <p className="text-sm text-muted-foreground">Customer ID: {selectedCustomer.customerId}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleEditCustomer(selectedCustomer)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => handlePrintCustomer(selectedCustomer)}
              disabled={isPrinting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Printing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Print
                </>
              )}
            </button>
            <button
              onClick={() => handleDeleteCustomer(selectedCustomer._id)}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Finance / POS linked balances */}
        {customerFinanceSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
              <p className="text-xs text-muted-foreground">Finance Advance (receive)</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(customerFinanceSummary.financeAdvanceBalance)}
              </p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Advance Credit</p>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(customerFinanceSummary.totalAdvanceCredit)}
              </p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
              <p className="text-xs text-muted-foreground">Balance Due (POS)</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(customerFinanceSummary.totalBalanceDue)}
              </p>
            </div>
          </div>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-500/10 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(selectedCustomer.amount)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-500/10 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount/Payment Received</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(selectedCustomer.amountPaid)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-500/10 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Amount</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(pendingAmount)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-500/10 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <p className={`text-lg font-bold ${getPaymentStatusColor(selectedCustomer.paidAmount).split(' ')[1]}`}>
                  {getPaymentStatusText(selectedCustomer.paidAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Personal Info */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Personal Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm text-foreground">{selectedCustomer.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="text-sm text-foreground">{selectedCustomer.phoneNo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground truncate">{selectedCustomer.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CNIC</p>
                <p className="text-sm text-foreground">{selectedCustomer.cnicNo || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Address Info */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Address Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm text-foreground">{selectedCustomer.address || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">City</p>
                <p className="text-sm text-foreground">{selectedCustomer.city || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Province</p>
                <p className="text-sm text-foreground">{selectedCustomer.province || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    {formatDateWithMonthName(selectedCustomer.registrationDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status & Documents */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Status & Documents</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <span className={`px-3 py-1 rounded-full text-xs ${selectedCustomer.isActive ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                  {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    {formatDateWithMonthName(selectedCustomer.createdAt)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    {formatDateWithMonthName(selectedCustomer.updatedAt)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="text-sm text-foreground">
                  {selectedCustomer.documents?.length || 0} document(s)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Finance advance history — galat entry delete */}
        <div className="bg-cms-sidebar p-4 rounded-lg mb-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Finance Advance History</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Galat amount Finance se record hui ho to yahan se delete karen
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                selectedCustomer._id && fetchCustomerFinanceData(selectedCustomer._id)
              }
              disabled={loadingCustomerAdvance}
              className="p-2 hover:bg-muted rounded-md"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingCustomerAdvance ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {loadingCustomerAdvance ? (
            <div className="py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : customerAdvanceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Koi finance advance record nahi — Finance module se add karen
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3 w-20">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {customerAdvanceRows.map((row, i) => {
                    const rowKey = row.transactionId || row.ledgerEntryId || String(i);
                    const isDeleting = deletingAdvanceId === rowKey;
                    return (
                      <tr key={rowKey} className="border-t border-border">
                        <td className="p-3 whitespace-nowrap">
                          {formatDateWithMonthName(row.date)}
                        </td>
                        <td className="p-3">
                          {PAYMENT_METHOD_LABELS[row.method || ""] || row.method || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                          {row.description || row.reference || "—"}
                        </td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomerAdvance(row)}
                            disabled={isDeleting}
                            className="p-2 rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-50"
                            title="Delete advance"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Documents Preview */}
        {selectedCustomer.documents && selectedCustomer.documents.length > 0 && (
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Uploaded Documents</h3>
            <div className="flex flex-wrap gap-3">
              {selectedCustomer.documents.map((doc, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img 
                    src={doc} 
                    alt={`Document ${index + 1}`} 
                    className="w-full h-full object-cover rounded-lg border border-border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-size='10' fill='%23999'%3EDoc%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (selectedCustomer) {
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
        {renderCustomerDetailView()}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center justify-between border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
            <Users className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Customers</h1>
          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            title="Refresh customers"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Total: {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-cms-card rounded-xl p-8 text-center mb-6">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      )}

      {/* Main Content - Show when not loading */}
      {!isLoading && (
        <>
          {/* POS sales summary — same as POS module */}
          {!loadingSales && posSales.length > 0 && (
            <CustomerWiseSummary
              sales={posSales}
              title="Customer-wise Summary (from POS sales)"
              exportFilePrefix="Customers_POS_Summary"
            />
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Amount</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Amount/Payment Received</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Pending Amount</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatCurrency(totalPending)}</p>
            </div>
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Customers</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{customers.length}</p>
            </div>
          </div>

          {/* Payment Status Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-green-500/10 rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Fully Paid</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{fullyPaidCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">Customers</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Partially Paid</p>
              <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{partiallyPaidCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">Customers</p>
            </div>
            <div className="bg-gray-500/10 rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Not Paid</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-600">{notPaidCustomers}</p>
              <p className="text-xs text-muted-foreground mt-1">Customers</p>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers by name, phone, email, or city"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-cms-card border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-80"
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={handleAddCustomer}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
              <button
                type="button"
                onClick={handlePrintAllCustomers}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                type="button"
                onClick={() => exportCustomers("excel")}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={() => exportCustomers("pdf")}
                title="Export PDF"
                className="hidden sm:flex px-3 py-2.5 bg-cms-card border border-border hover:bg-cms-card-hover text-foreground rounded-lg text-xs font-medium items-center gap-2 transition-colors"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => exportCustomers("csv")}
                title="Export CSV"
                className="hidden sm:flex px-3 py-2.5 bg-cms-card border border-border hover:bg-cms-card-hover text-foreground rounded-lg text-xs font-medium items-center gap-2 transition-colors"
              >
                CSV
              </button>
            </div>
          </div>

          {/* Empty State - When no customers exist */}
          {customers.length === 0 ? (
            <div className="bg-cms-card rounded-xl p-8 sm:p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                No Customers Yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Get started by adding your first customer. You can add customer details, contact information, and upload documents.
              </p>
              <button
                onClick={handleAddCustomer}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 mx-auto transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Your First Customer
              </button>
            </div>
          ) : (
            <>
              {/* Customer Table */}
              <div className="bg-cms-card rounded-xl overflow-hidden border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-cms-table-header border-b border-border">
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Location
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount (PKR)
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Payment Status
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Registration Date
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredCustomers.map((customer) => {
                        const pendingAmount = calculatePendingAmount(customer.amount, customer.amountPaid);
                        
                        return (
                          <tr key={customer._id} className="hover:bg-cms-sidebar/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <img 
                                    src={customer.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"} 
                                    alt={customer.customerName}
                                    className="w-10 h-10 rounded-full object-cover border border-border"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face";
                                    }}
                                  />
                                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                    customer.isActive ? 'bg-green-500' : 'bg-red-500'
                                  }`}></div>
                                </div>
                                <div>
                                  <p className="font-medium text-foreground text-sm">{customer.customerName}</p>
                                  <p className="text-xs text-muted-foreground">ID: {customer.customerId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm text-foreground">{customer.phoneNo}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm text-foreground truncate max-w-[180px]">
                                    {customer.email || "No email"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-1">
                                <p className="text-sm text-foreground">{customer.city || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">{customer.province || "N/A"}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Total:</span>
                                  <span className="text-sm font-medium text-foreground">{formatCurrency(customer.amount)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Paid:</span>
                                  <span className="text-sm font-medium text-green-600">{formatCurrency(customer.amountPaid)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-muted-foreground">Pending:</span>
                                  <span className="text-sm font-medium text-yellow-600">{formatCurrency(pendingAmount)}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className={`px-3 py-1 text-xs rounded-full ${getPaymentStatusColor(customer.paidAmount)}`}>
                                  {getPaymentStatusText(customer.paidAmount)}
                                </span>
                                {customer.paidAmount === 'partial' && (
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className="bg-yellow-500 h-1.5 rounded-full" 
                                      style={{ width: `${(customer.amountPaid / customer.amount) * 100}%` }}
                                    ></div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <p className="text-sm text-foreground">
                                  {formatDateWithMonthName(customer.registrationDate)}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleViewCustomer(customer)}
                                  className="p-1.5 hover:bg-muted rounded-md transition-colors text-green-600 hover:text-green-700"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handlePrintCustomer(customer)}
                                  disabled={isPrinting}
                                  className="p-1.5 hover:bg-muted rounded-md transition-colors text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Print customer details"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEditCustomer(customer)}
                                  className="p-1.5 hover:bg-muted rounded-md transition-colors text-blue-600 hover:text-blue-700"
                                  title="Edit customer"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(customer._id)}
                                  className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors text-red-600 hover:text-red-700"
                                  title="Delete customer"
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

                {/* Table Footer */}
                <div className="bg-cms-table-header border-t border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {filteredCustomers.length} of {customers.length} customers
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                        Previous
                      </button>
                      <span className="px-3 py-1.5 text-sm text-foreground">1</span>
                      <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empty Search State */}
              {filteredCustomers.length === 0 && searchTerm && (
                <div className="text-center py-12 bg-cms-card rounded-xl border border-border mt-6">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No customers found for "{searchTerm}"</p>
                  <button
                    onClick={handleClearSearch}
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <AddCustomerQuickDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSaved={handleCustomerAdded}
      />

      {/* Edit Customer Dialog */}
      <AddCustomerDialog 
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onCustomerUpdated={handleCustomerUpdated}
        customerToEdit={customerToEdit}
        isEditMode={true}
      />
    </div>
  );
}