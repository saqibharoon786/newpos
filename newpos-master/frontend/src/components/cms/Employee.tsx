// Employee.tsx - UPDATED WITH PRINT FUNCTIONALITY
import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Printer,
  Mail,
  Phone,
  Clock,
  Building2,
  DollarSign,
  Pencil,
  ArrowLeft,
  Trash2,
  User,
  MapPin,
  CreditCard,
  Calendar,
  AlertCircle,
  Briefcase,
  Wallet,
  FileImage,
  Eye,
  MoreVertical,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  History,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import api, { API_BASE_URL } from "@/lib/api";

const EMPLOYEES_API = "/api/employees";
const FINANCE_API = "/api/finance";

const PAYMENT_METHODS = [
  { value: "drawer", label: "Cash Drawer" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "bank", label: "Bank Account" },
] as const;

interface FinanceHistoryRow {
  _id?: string;
  date: string;
  type: string;
  amount: number;
  method?: string;
  description?: string;
  reference?: string;
  grossSalary?: number;
  advanceDeducted?: number;
  netPaid?: number;
  transactionId?: string;
  canDelete?: boolean;
}

interface FinanceBalances {
  drawer: number;
  easypaisa: number;
  jazzcash: number;
  bank: number;
}

function monthStartYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEndYmd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

interface EmployeeType {
  _id: string;
  id: string;
  employeeId: string;
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  schedule: string;
  salary: string;
  avatar: string;
  address: string;
  cnic: string;
  dob: string;
  emergencyContact: string;
  reportingManager: string;
  hireDate: string;
  responsibilities: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  advancePayment: number;
  advanceRecoveryMode?: "self_pay" | "salary_deduct";
  monthlyAdvanceDeduction?: number;
  cnicFrontImage?: string;
  cnicBackImage?: string;
}

const Employee = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeType | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  
  const [cnicFrontPreview, setCnicFrontPreview] = useState<string | null>(null);
  const [cnicBackPreview, setCnicBackPreview] = useState<string | null>(null);
  const [editCnicFrontPreview, setEditCnicFrontPreview] = useState<string | null>(null);
  const [editCnicBackPreview, setEditCnicBackPreview] = useState<string | null>(null);
  
  // Date Picker States
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showHireDatePicker, setShowHireDatePicker] = useState(false);
  const [showEditDobPicker, setShowEditDobPicker] = useState(false);
  const [showEditHireDatePicker, setShowEditHireDatePicker] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDobDate, setSelectedDobDate] = useState<Date | null>(null);
  const [selectedHireDate, setSelectedHireDate] = useState<Date | null>(null);
  const [selectedEditDobDate, setSelectedEditDobDate] = useState<Date | null>(null);
  const [selectedEditHireDate, setSelectedEditHireDate] = useState<Date | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeDepartments: 0,
    pendingInterviews: 0,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const cnicFrontInputRef = useRef<HTMLInputElement>(null);
  const cnicBackInputRef = useRef<HTMLInputElement>(null);
  const editCnicFrontInputRef = useRef<HTMLInputElement>(null);
  const editCnicBackInputRef = useRef<HTMLInputElement>(null);
  
  const dobPickerRef = useRef<HTMLDivElement>(null);
  const hireDatePickerRef = useRef<HTMLDivElement>(null);
  const editDobPickerRef = useRef<HTMLDivElement>(null);
  const editHireDatePickerRef = useRef<HTMLDivElement>(null);

  const [financeBalances, setFinanceBalances] = useState<FinanceBalances | null>(null);
  const [financeHistory, setFinanceHistory] = useState<FinanceHistoryRow[]>([]);
  const [financeLinked, setFinanceLinked] = useState<{
    employee: {
      salary: number;
      advanceBalance: number;
      netSalaryAfterAdvance: number;
      advanceRecoveryMode?: "self_pay" | "salary_deduct";
      monthlyAdvanceDeduction?: number;
      plannedMonthlyDeduction?: number;
    };
  } | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeAction, setFinanceAction] = useState<"advance" | "repayment" | "salary" | null>(null);
  const [financeDateFrom, setFinanceDateFrom] = useState(monthStartYmd);
  const [financeDateTo, setFinanceDateTo] = useState(monthEndYmd);
  const [advanceSettings, setAdvanceSettings] = useState({
    advanceRecoveryMode: "salary_deduct" as "self_pay" | "salary_deduct",
    monthlyAdvanceDeduction: "",
  });
  const [savingAdvanceSettings, setSavingAdvanceSettings] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    method: "drawer",
    amount: "",
    description: "",
    reference: "",
    grossSalary: "",
    advanceToDeduct: "",
    periodLabel: "",
    deductFromSalary: true,
  });

  const [formData, setFormData] = useState({
    employeeId: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    cnic: "",
    dob: "",
    emergencyContact: "",
    title: "",
    department: "",
    reportingManager: "",
    hireDate: "",
    startTime: "09:00",
    endTime: "17:00",
    responsibilities: "",
    salary: "",
    advancePayment: "0",
  });

  const [editFormData, setEditFormData] = useState({
    _id: "",
    employeeId: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    cnic: "",
    dob: "",
    emergencyContact: "",
    title: "",
    department: "",
    reportingManager: "",
    hireDate: "",
    startTime: "09:00",
    endTime: "17:00",
    responsibilities: "",
    salary: "",
    advancePayment: "0",
  });

  // ==================== PRINT FUNCTIONALITY ====================
  const handlePrint = (employee: EmployeeType) => {
    setIsPrinting(true);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Employee Details - ${employee.name}</title>
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
          
          /* Employee Summary */
          .employee-summary {
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
          
          .employee-basic-info {
            flex: 1;
          }
          
          .employee-name {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 2px;
          }
          
          .employee-id {
            font-size: 9pt;
            color: #666;
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
            min-width: 120px;
          }
          
          .compact-value {
            color: #000;
            text-align: right;
            max-width: 120px;
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
          
          /* Status Badge */
          .status-badge {
            padding: 1px 6px;
            border-radius: 8px;
            font-size: 7pt;
            font-weight: 600;
            display: inline-block;
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
            <div class="print-title">EMPLOYEE DETAILS REPORT</div>
            <div class="print-subtitle">Date: ${new Date().toLocaleDateString('en-GB')} | Time: ${new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
          
          <!-- Employee Summary -->
          <div class="employee-summary">
            <div class="avatar-container">
              <img src="${employee.avatar || ''}" alt="${employee.name}" onerror="this.style.display='none'">
            </div>
            <div class="employee-basic-info">
              <div class="employee-name">${employee.name}</div>
              <div class="employee-id">ID: ${employee.employeeId}</div>
              <div class="employee-id">Phone: ${employee.phone} | Email: ${employee.email || 'N/A'}</div>
            </div>
          </div>
          
          <!-- Personal Details -->
          <div class="print-section no-break">
            <div class="section-title">PERSONAL INFORMATION</div>
            <div class="compact-grid">
              <div class="compact-item">
                <span class="compact-label">Full Name:</span>
                <span class="compact-value">${employee.name}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Phone:</span>
                <span class="compact-value">${employee.phone}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Email:</span>
                <span class="compact-value truncate">${employee.email || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">CNIC:</span>
                <span class="compact-value">${employee.cnic || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Address:</span>
                <span class="compact-value">${employee.address || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Date of Birth:</span>
                <span class="compact-value">${employee.dob || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Emergency Contact:</span>
                <span class="compact-value">${employee.emergencyContact || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Advance Payment:</span>
                <span class="compact-value">Rs. ${employee.advancePayment?.toLocaleString() || '0'}</span>
              </div>
            </div>
          </div>
          
          <!-- Employment Details -->
          <div class="print-section no-break">
            <div class="section-title">EMPLOYMENT INFORMATION</div>
            <div class="compact-grid">
              <div class="compact-item">
                <span class="compact-label">Employee ID:</span>
                <span class="compact-value">${employee.employeeId}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Job Title:</span>
                <span class="compact-value">${employee.title || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Department:</span>
                <span class="compact-value">${employee.department || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Reporting Manager:</span>
                <span class="compact-value">${employee.reportingManager || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Hire Date:</span>
                <span class="compact-value">${employee.hireDate || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Work Schedule:</span>
                <span class="compact-value">${employee.startTime ? formatTimeForDisplay(employee.startTime) : '09:00'} - ${employee.endTime ? formatTimeForDisplay(employee.endTime) : '17:00'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Salary:</span>
                <span class="compact-value">${formatSalary(employee.salary)}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Job Responsibilities:</span>
                <span class="compact-value">${employee.responsibilities || 'N/A'}</span>
              </div>
              <div class="compact-item">
                <span class="compact-label">Status:</span>
                <span class="compact-value">
                  <span class="status-badge" style="background-color: ${employee.isActive ? '#10b981' : '#ef4444'}; color: white;">
                    ${employee.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="print-footer">
            <div>Employee Management System - Official Document</div>
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

  // Helper functions for print
  const formatTimeForDisplay = (timeString: string) => {
    if (!timeString) return "09:00 AM";
    
    if (timeString.includes("AM") || timeString.includes("PM")) {
      return timeString;
    }
    
    const match = timeString.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const period = hours >= 12 ? "PM" : "AM";
      
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      
      return `${hours}:${minutes} ${period}`;
    }
    
    return timeString;
  };

  const formatSalary = (salary: string | number) => {
    if (typeof salary === "number") {
      return `Rs. ${salary.toLocaleString()}`;
    }
    if (typeof salary === "string") {
      if (salary.startsWith("Rs.")) return salary;
      const num = parseFloat(salary.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(num)) {
        return `Rs. ${num.toLocaleString()}`;
      }
    }
    return `Rs. 0`;
  };

  // Date Picker Constants
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    fetchEmployees();
    fetchEmployeeStats();
  }, []);

  useEffect(() => {
    const employeeId = searchParams.get("view");
    if (employeeId && employees.length > 0) {
      const employee = employees.find(emp => emp._id === employeeId || emp.id === employeeId);
      if (employee) {
        setSelectedEmployee(employee);
        setView("detail");
      }
    }
  }, [employees, searchParams]);

  useEffect(() => {
    if (view === "detail" && selectedEmployee?._id) {
      fetchEmployeeFinance(selectedEmployee._id, financeDateFrom, financeDateTo);
      fetchFinanceBalances();
    }
  }, [view, selectedEmployee?._id, financeDateFrom, financeDateTo]);

  // Click outside handlers for date pickers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dobPickerRef.current && !dobPickerRef.current.contains(event.target as Node)) {
        setShowDobPicker(false);
      }
      if (hireDatePickerRef.current && !hireDatePickerRef.current.contains(event.target as Node)) {
        setShowHireDatePicker(false);
      }
      if (editDobPickerRef.current && !editDobPickerRef.current.contains(event.target as Node)) {
        setShowEditDobPicker(false);
      }
      if (editHireDatePickerRef.current && !editHireDatePickerRef.current.contains(event.target as Node)) {
        setShowEditHireDatePicker(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==================== API FUNCTIONS ====================
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`${EMPLOYEES_API}/get-all`);
      
      if (response.data.success) {
        const employeesData = (response.data.data || []).map((emp: any) => ({
          ...emp,
          advancePayment: emp.advancePayment || 0,
          advanceRecoveryMode: emp.advanceRecoveryMode || "salary_deduct",
          monthlyAdvanceDeduction: emp.monthlyAdvanceDeduction || 0,
          cnicFrontImage: emp.cnicFrontImage || "",
          cnicBackImage: emp.cnicBackImage || "",
          avatar: emp.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
        }));
        setEmployees(employeesData);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      console.error("Failed to load employees:", error);
      alert(`Failed to load employees: ${error.response?.data?.message || error.message}`);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeStats = async () => {
    try {
      const response = await api.get(`${EMPLOYEES_API}/stats`);
      if (response.data.success) {
        const statsData = response.data.data || {};
        setStats({
          totalEmployees: statsData.totalEmployees || 0,
          activeDepartments: statsData.activeDepartments || 0,
          pendingInterviews: statsData.pendingInterviews || 0,
        });
      }
    } catch (error: any) {
      console.error("Failed to load stats:", error);
    }
  };

  const fetchFinanceBalances = async () => {
    try {
      const res = await api.get(`${FINANCE_API}/balances`);
      if (res.data?.success) {
        setFinanceBalances(res.data.balances || null);
      }
    } catch {
      /* ignore */
    }
  };

  const fetchEmployeeFinance = async (employeeId: string, startDate?: string, endDate?: string) => {
    setFinanceLoading(true);
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    try {
      const [histRes, linkRes] = await Promise.all([
        api.get(`${FINANCE_API}/employee-advance/${employeeId}/history`, { params }),
        api.get(`${FINANCE_API}/employee-linked/${employeeId}`, { params }),
      ]);
      if (histRes.data?.success) {
        setFinanceHistory(histRes.data.history || []);
        if (histRes.data.employee) {
          setFinanceLinked({ employee: histRes.data.employee });
          setAdvanceSettings({
            advanceRecoveryMode: histRes.data.employee.advanceRecoveryMode || "salary_deduct",
            monthlyAdvanceDeduction: histRes.data.employee.monthlyAdvanceDeduction
              ? String(histRes.data.employee.monthlyAdvanceDeduction)
              : "",
          });
        }
      }
      if (linkRes.data?.success && linkRes.data.data?.employee) {
        setFinanceLinked({ employee: linkRes.data.data.employee });
        setAdvanceSettings({
          advanceRecoveryMode: linkRes.data.data.employee.advanceRecoveryMode || "salary_deduct",
          monthlyAdvanceDeduction: linkRes.data.data.employee.monthlyAdvanceDeduction
            ? String(linkRes.data.data.employee.monthlyAdvanceDeduction)
            : "",
        });
      }
    } catch {
      setFinanceHistory([]);
      setFinanceLinked(null);
    } finally {
      setFinanceLoading(false);
    }
  };

  const refreshEmployeeAfterFinance = async (employeeId: string, advanceBalance?: number) => {
    await fetchEmployeeFinance(employeeId, financeDateFrom, financeDateTo);
    await fetchFinanceBalances();
    if (advanceBalance !== undefined) {
      setSelectedEmployee((prev) =>
        prev ? { ...prev, advancePayment: advanceBalance } : prev
      );
      setEmployees((prev) =>
        prev.map((emp) =>
          emp._id === employeeId ? { ...emp, advancePayment: advanceBalance } : emp
        )
      );
    } else {
      await fetchEmployees();
    }
  };

  const getBalanceForMethod = (method: string) => {
    if (!financeBalances) return 0;
    if (method === "bank") return financeBalances.bank;
    return financeBalances[method as keyof FinanceBalances] ?? 0;
  };

  const parseEmployeeSalary = (salary: string | number) => {
    if (typeof salary === "number") return salary;
    return parseFloat(String(salary).replace(/[^0-9.-]+/g, "")) || 0;
  };

  const calcSalaryDeduction = () => {
    const gross = parseFloat(financeForm.grossSalary) || parseEmployeeSalary(selectedEmployee?.salary || 0);
    const outstanding = selectedEmployee?.advancePayment || 0;
    if (!financeForm.deductFromSalary) return 0;
    if (financeForm.advanceToDeduct) {
      return Math.min(parseFloat(financeForm.advanceToDeduct) || 0, outstanding, gross);
    }
    const monthly = parseFloat(advanceSettings.monthlyAdvanceDeduction) || 0;
    const mode = advanceSettings.advanceRecoveryMode;
    if (mode === "self_pay") return 0;
    const toDeduct = monthly > 0 ? monthly : outstanding;
    return Math.min(toDeduct, outstanding, gross);
  };

  const handleSaveAdvanceSettings = async () => {
    if (!selectedEmployee?._id) return;
    setSavingAdvanceSettings(true);
    try {
      const res = await api.patch(`${FINANCE_API}/employee-advance-settings`, {
        employeeId: selectedEmployee._id,
        advanceRecoveryMode: advanceSettings.advanceRecoveryMode,
        monthlyAdvanceDeduction: advanceSettings.monthlyAdvanceDeduction || 0,
      });
      if (res.data?.success) {
        alert(res.data.message || "Settings saved");
        if (res.data.employee) {
          setFinanceLinked({ employee: res.data.employee });
        }
        await fetchEmployees();
      } else {
        alert(res.data?.message || "Save failed");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Settings save failed");
    } finally {
      setSavingAdvanceSettings(false);
    }
  };

  const setFinanceMonthPreset = (preset: "this_month" | "last_month" | "all") => {
    const now = new Date();
    if (preset === "all") {
      setFinanceDateFrom("");
      setFinanceDateTo("");
      return;
    }
    if (preset === "this_month") {
      setFinanceDateFrom(monthStartYmd());
      setFinanceDateTo(monthEndYmd());
      return;
    }
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    setFinanceDateFrom(
      `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`
    );
    setFinanceDateTo(
      `${lastEnd.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(lastEnd.getDate()).padStart(2, "0")}`
    );
  };

  const handleFinanceSubmit = async () => {
    if (!selectedEmployee?._id || !financeAction) return;

    setFinanceLoading(true);
    try {
      let endpoint = "";
      let payload: Record<string, unknown> = {
        employeeId: selectedEmployee._id,
        method: financeForm.method,
        description: financeForm.description,
        reference: financeForm.reference,
      };

      if (financeAction === "advance") {
        const amt = parseFloat(financeForm.amount);
        if (!amt || amt <= 0) {
          alert("Valid advance amount enter karen");
          return;
        }
        endpoint = `${FINANCE_API}/employee-advance`;
        payload.amount = amt;
      } else if (financeAction === "repayment") {
        const amt = parseFloat(financeForm.amount);
        if (!amt || amt <= 0) {
          alert("Valid repayment amount enter karen");
          return;
        }
        endpoint = `${FINANCE_API}/employee-repayment`;
        payload.amount = amt;
      } else if (financeAction === "salary") {
        endpoint = `${FINANCE_API}/employee-salary`;
        payload.grossSalary = financeForm.grossSalary || parseEmployeeSalary(selectedEmployee.salary);
        payload.deductFromSalary = financeForm.deductFromSalary;
        if (financeForm.deductFromSalary && financeForm.advanceToDeduct) {
          payload.advanceToDeduct = parseFloat(financeForm.advanceToDeduct);
        }
        if (financeForm.periodLabel) {
          payload.periodLabel = financeForm.periodLabel;
        }
      }

      const res = await api.post(endpoint, payload);
      if (res.data?.success) {
        alert(res.data.message || "Transaction saved");
        setFinanceAction(null);
        setFinanceForm({
          method: "drawer",
          amount: "",
          description: "",
          reference: "",
          grossSalary: "",
          advanceToDeduct: "",
          periodLabel: "",
          deductFromSalary: advanceSettings.advanceRecoveryMode === "salary_deduct",
        });
        await refreshEmployeeAfterFinance(
          selectedEmployee._id,
          res.data.employee?.advanceBalance
        );
      } else {
        alert(res.data?.message || "Transaction failed");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Finance transaction failed");
    } finally {
      setFinanceLoading(false);
    }
  };

  const handleDeleteFinanceEntry = async (transactionId: string) => {
    if (!window.confirm("Ye entry delete karen? Account balance adjust ho jayega.")) return;
    setFinanceLoading(true);
    try {
      const res = await api.delete(`${FINANCE_API}/party-advance/${transactionId}`);
      if (res.data?.success && selectedEmployee?._id) {
        alert(res.data.message || "Entry deleted");
        await refreshEmployeeAfterFinance(selectedEmployee._id);
      } else {
        alert(res.data?.message || "Delete failed");
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Delete failed");
    } finally {
      setFinanceLoading(false);
    }
  };

  const getFinanceTypeLabel = (type: string) => {
    if (type === "advance") return "Advance Given";
    if (type === "repayment") return "Khud Wapas (Self Pay)";
    if (type === "salary_payment") return "Salary Paid";
    return type;
  };

  const createEmployee = async (formDataToSend: FormData) => {
    try {
      console.log("Sending employee data...");
      
      const response = await api.post(`${EMPLOYEES_API}/create-employee`, formDataToSend);
      
      console.log("Create employee response:", response.data);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to create employee');
      }
    } catch (error: any) {
      console.error("API Create error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config,
      });
      throw error;
    }
  };

  const updateEmployee = async (id: string, employeeData: any, files: {
    avatar?: File;
    cnicFront?: File;
    cnicBack?: File;
  }) => {
    try {
      setIsSubmitting(true);
      
      if (!id || id === "undefined" || id === "") {
        throw new Error("Invalid employee ID");
      }
      
      const formDataToSend = new FormData();
      
      Object.keys(employeeData).forEach(key => {
        if (key !== '_id' && key !== 'advancePayment') {
          const value = employeeData[key];
          if (value !== undefined && value !== null && value !== '') {
            formDataToSend.append(key, String(value));
          }
        }
      });

      if (files.avatar) {
        formDataToSend.append("avatar", files.avatar);
      }
      if (files.cnicFront) {
        formDataToSend.append("cnicFrontImage", files.cnicFront);
      }
      if (files.cnicBack) {
        formDataToSend.append("cnicBackImage", files.cnicBack);
      }

      const response = await api.put(`${EMPLOYEES_API}/${id}`, formDataToSend);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to update employee');
      }
    } catch (error: any) {
      console.error("Update error details:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      if (!id || id === "undefined") {
        throw new Error("Invalid employee ID");
      }
      
      const response = await api.delete(`${EMPLOYEES_API}/${id}`);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to delete employee');
      }
    } catch (error: any) {
      console.error("Delete error details:", error);
      throw error;
    }
  };

  // ==================== DATE PICKER FUNCTIONS ====================
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

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

  // Add Form Date Handling
  const handleDobDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDobDate(date);
    setShowDobPicker(false);
    
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setFormData(prev => ({ ...prev, dob: dateStr }));
  };

  const handleHireDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedHireDate(date);
    setShowHireDatePicker(false);
    
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setFormData(prev => ({ ...prev, hireDate: dateStr }));
  };

  const handleTodayDob = () => {
    const today = new Date();
    setSelectedDobDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowDobPicker(false);
    
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setFormData(prev => ({ ...prev, dob: dateStr }));
  };

  const handleTodayHireDate = () => {
    const today = new Date();
    setSelectedHireDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowHireDatePicker(false);
    
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setFormData(prev => ({ ...prev, hireDate: dateStr }));
  };

  // Edit Form Date Handling
  const handleEditDobDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedEditDobDate(date);
    setShowEditDobPicker(false);
    
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setEditFormData(prev => ({ ...prev, dob: dateStr }));
  };

  const handleEditHireDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedEditHireDate(date);
    setShowEditHireDatePicker(false);
    
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setEditFormData(prev => ({ ...prev, hireDate: dateStr }));
  };

  const handleEditTodayDob = () => {
    const today = new Date();
    setSelectedEditDobDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowEditDobPicker(false);
    
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setEditFormData(prev => ({ ...prev, dob: dateStr }));
  };

  const handleEditTodayHireDate = () => {
    const today = new Date();
    setSelectedEditHireDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowEditHireDatePicker(false);
    
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;
    
    setEditFormData(prev => ({ ...prev, hireDate: dateStr }));
  };

  // Initialize dates when modals open
  useEffect(() => {
    if (isAddModalOpen) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const todayStr = `${dd}/${mm}/${yyyy}`;
      
      if (!formData.dob) {
        setFormData(prev => ({ ...prev, dob: todayStr }));
        setSelectedDobDate(now);
      }
      
      if (!formData.hireDate) {
        setFormData(prev => ({ ...prev, hireDate: todayStr }));
        setSelectedHireDate(now);
      }
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (isEditModalOpen && editFormData.dob) {
      const [dd, mm, yyyy] = editFormData.dob.split('/').map(Number);
      if (dd && mm && yyyy) {
        const parsed = new Date(yyyy, mm - 1, dd);
        if (!isNaN(parsed.getTime())) {
          setSelectedEditDobDate(parsed);
        }
      }
    }
    
    if (isEditModalOpen && editFormData.hireDate) {
      const [dd, mm, yyyy] = editFormData.hireDate.split('/').map(Number);
      if (dd && mm && yyyy) {
        const parsed = new Date(yyyy, mm - 1, dd);
        if (!isNaN(parsed.getTime())) {
          setSelectedEditHireDate(parsed);
        }
      }
    }
  }, [isEditModalOpen, editFormData.dob, editFormData.hireDate]);

  // ==================== EVENT HANDLERS ====================
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditPhotoPreview(reader.result as string);
      } else {
        setPhotoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCnicFrontUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditCnicFrontPreview(reader.result as string);
      } else {
        setCnicFrontPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCnicBackUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditCnicBackPreview(reader.result as string);
      } else {
        setCnicBackPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  const getFullImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "";
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  // ==================== EMPLOYEE OPERATIONS ====================
  const handleSaveEmployee = async () => {
    console.log("Saving employee data...");
    
    // Validate required fields
    const requiredFields = ['employeeId', 'name', 'email', 'phone', 'salary'];
    const missingFields = requiredFields.filter(field => {
      const value = formData[field as keyof typeof formData];
      return !value || (typeof value === 'string' && value.trim() === '');
    });
    
    if (missingFields.length > 0) {
      alert(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate salary
    const salaryValue = parseFloat(formData.salary.replace(/[^0-9.-]+/g, ""));
    if (isNaN(salaryValue) || salaryValue <= 0) {
      alert("Please enter a valid salary amount");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create FormData for submission
      const formDataToSend = new FormData();
      
      // Append all form data
      Object.keys(formData).forEach(key => {
        if (key === 'advancePayment') return;
        const value = formData[key as keyof typeof formData];
        if (value !== undefined && value !== null && value !== '') {
          formDataToSend.append(key, String(value));
        }
      });
      
      // Append files
      if (fileInputRef.current?.files?.[0]) {
        formDataToSend.append("avatar", fileInputRef.current.files[0]);
      }
      if (cnicFrontInputRef.current?.files?.[0]) {
        formDataToSend.append("cnicFrontImage", cnicFrontInputRef.current.files[0]);
      }
      if (cnicBackInputRef.current?.files?.[0]) {
        formDataToSend.append("cnicBackImage", cnicBackInputRef.current.files[0]);
      }
      
      // Log what we're sending
      console.log("FormData contents:");
      for (let pair of formDataToSend.entries()) {
        console.log(pair[0], pair[1]);
      }
      
      const response = await createEmployee(formDataToSend);
      
      if (response.success) {
        const newEmployee = {
          ...response.data,
          id: response.data._id,
          advancePayment: response.data.advancePayment || 0,
          cnicFrontImage: response.data.cnicFrontImage || "",
          cnicBackImage: response.data.cnicBackImage || "",
          avatar: response.data.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
        };
        
        setEmployees(prev => [...prev, newEmployee]);
        setIsAddModalOpen(false);
        resetForm();
        await fetchEmployeeStats();
        alert("✅ Employee created successfully!");
      }
    } catch (error: any) {
      console.error("Create error details:", error);
      
      let errorMessage = "Failed to create employee";
      if (error.response) {
        if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.status === 400) {
          errorMessage = "Bad request. Please check all fields.";
        } else if (error.response.status === 409) {
          errorMessage = "Employee ID, Email or CNIC already exists.";
        } else {
          errorMessage = `Server error: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = "No response from server. Please check if backend is running.";
      } else {
        errorMessage = error.message || "Failed to create employee";
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async () => {
    const mongoId = editFormData._id;
    
    if (!mongoId || mongoId === "undefined" || mongoId === "") {
      alert("Invalid employee ID. Cannot update.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const files = {
        avatar: editFileInputRef.current?.files?.[0],
        cnicFront: editCnicFrontInputRef.current?.files?.[0],
        cnicBack: editCnicBackInputRef.current?.files?.[0],
      };
      
      const response = await updateEmployee(mongoId, editFormData, files);
      
      if (response.success) {
        const updatedEmployee = {
          ...response.data,
          id: response.data._id,
          advancePayment: response.data.advancePayment || 0,
          cnicFrontImage: response.data.cnicFrontImage || "",
          cnicBackImage: response.data.cnicBackImage || "",
        };
        
        setEmployees(prev => 
          prev.map(emp => emp._id === mongoId ? updatedEmployee : emp)
        );
        
        if (selectedEmployee && selectedEmployee._id === mongoId) {
          setSelectedEmployee(updatedEmployee);
        }
        
        setIsEditModalOpen(false);
        resetEditForm();
        alert("✅ Employee updated successfully!");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.response?.data?.message || "Failed to update employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (employee: EmployeeType) => {
    if (!employee || !employee._id) {
      alert("Invalid employee");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${employee.name}?`)) {
      return;
    }

    try {
      const response = await deleteEmployee(employee._id);
      
      if (response.success) {
        setEmployees(prev => prev.filter(emp => emp._id !== employee._id));
        
        if (selectedEmployee && selectedEmployee._id === employee._id) {
          handleBackToList();
        }
        
        await fetchEmployeeStats();
        alert("✅ Employee deleted successfully!");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(error.response?.data?.message || "Failed to delete employee. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      cnic: "",
      dob: "",
      emergencyContact: "",
      title: "",
      department: "",
      reportingManager: "",
      hireDate: "",
      startTime: "09:00",
      endTime: "17:00",
      responsibilities: "",
      salary: "",
      advancePayment: "0",
    });
    setPhotoPreview(null);
    setCnicFrontPreview(null);
    setCnicBackPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cnicFrontInputRef.current) cnicFrontInputRef.current.value = "";
    if (cnicBackInputRef.current) cnicBackInputRef.current.value = "";
  };

  const resetEditForm = () => {
    setEditFormData({
      _id: "",
      employeeId: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      cnic: "",
      dob: "",
      emergencyContact: "",
      title: "",
      department: "",
      reportingManager: "",
      hireDate: "",
      startTime: "09:00",
      endTime: "17:00",
      responsibilities: "",
      salary: "",
      advancePayment: "0",
    });
    setEditPhotoPreview(null);
    setEditCnicFrontPreview(null);
    setEditCnicBackPreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
    if (editCnicFrontInputRef.current) editCnicFrontInputRef.current.value = "";
    if (editCnicBackInputRef.current) editCnicBackInputRef.current.value = "";
  };

  const handleViewProfile = (employee: EmployeeType) => {
    setSelectedEmployee(employee);
    setView("detail");
    setSearchParams({ view: employee._id });
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedEmployee(null);
    setSearchParams({});
  };

  const handleEditClick = (employee: EmployeeType) => {
    if (!employee) {
      alert("Error: Employee data not found");
      return;
    }
    
    const mongoId = employee._id || employee.id;
    
    if (!mongoId) {
      alert("Error: Employee ID not found. Cannot edit.");
      return;
    }
    
    setSelectedEmployee(employee);
    
    let salaryValue = "";
    if (employee.salary) {
      if (typeof employee.salary === 'string') {
        salaryValue = employee.salary.replace(/Rs\.\s?|,/g, '');
      } else if (typeof employee.salary === 'number') {
        salaryValue = employee.salary.toString();
      }
    }
    
    let advancePaymentValue = "";
    if (employee.advancePayment !== undefined) {
      if (typeof employee.advancePayment === 'number') {
        advancePaymentValue = employee.advancePayment.toString();
      } else if (typeof employee.advancePayment === 'string') {
        advancePaymentValue = employee.advancePayment.replace(/Rs\.\s?|,/g, '');
      }
    }
    
    const formattedData = {
      _id: mongoId,
      employeeId: employee.employeeId || "",
      name: employee.name || "",
      address: employee.address || "",
      phone: employee.phone || "",
      email: employee.email || "",
      cnic: employee.cnic || "",
      dob: employee.dob || "",
      emergencyContact: employee.emergencyContact || "",
      title: employee.title || "",
      department: employee.department || "",
      reportingManager: employee.reportingManager || "",
      hireDate: employee.hireDate || "",
      startTime: formatTimeForInput(employee.startTime || "09:00"),
      endTime: formatTimeForInput(employee.endTime || "17:00"),
      responsibilities: employee.responsibilities || "",
      salary: salaryValue,
      advancePayment: advancePaymentValue || "0",
    };
    
    setEditFormData(formattedData);
    setEditPhotoPreview(employee.avatar || null);
    setEditCnicFrontPreview(employee.cnicFrontImage || null);
    setEditCnicBackPreview(employee.cnicBackImage || null);
    setIsEditModalOpen(true);
  };

  // ==================== HELPER FUNCTIONS ====================
  const formatTimeForInput = (timeString: string) => {
    if (!timeString) return "09:00";
    
    if (timeString.includes("AM") || timeString.includes("PM")) {
      const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    
    if (timeString.match(/^\d{2}:\d{2}$/)) {
      return timeString;
    }
    
    return "09:00";
  };

  const formatAdvancePayment = (advancePayment: number) => {
    return `Rs. ${advancePayment.toLocaleString()}`;
  };

  const formatSchedule = (employee: EmployeeType) => {
    if (employee.startTime && employee.endTime) {
      return `${formatTimeForDisplay(employee.startTime)} - ${formatTimeForDisplay(employee.endTime)}`;
    }
    return employee.schedule || "09:00 AM - 05:00 PM";
  };

  // ==================== RENDER ====================
  if (view === "detail" && selectedEmployee) {
    return (
      <div className="h-full w-full bg-background">
        <div className="h-full w-full px-6 py-4">
          <div className="text-muted-foreground text-sm mb-4">Employee / Detail</div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToList}
                className="text-foreground hover:text-muted-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={getFullImageUrl(selectedEmployee.avatar)}
                alt={selectedEmployee.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-primary"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                }}
              />
              <div>
                <h1 className="text-xl font-semibold text-foreground">{selectedEmployee.name}</h1>
                <p className="text-muted-foreground text-sm">Employee ID: {selectedEmployee.employeeId}</p>
                <p className="text-muted-foreground text-sm">{selectedEmployee.title} - {selectedEmployee.department}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleEditClick(selectedEmployee)}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-foreground hover:bg-secondary transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handlePrint(selectedEmployee)}
                disabled={isPrinting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                onClick={() => handleDeleteEmployee(selectedEmployee)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-secondary rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6 border-b border-border pb-3">
                Personal Details
              </h2>
              <div className="space-y-4">
                {[
                  { icon: User, label: "Name", value: selectedEmployee.name },
                  { icon: Phone, label: "Phone No.", value: selectedEmployee.phone },
                  { icon: Mail, label: "Email", value: selectedEmployee.email },
                  { icon: CreditCard, label: "CNIC No.", value: selectedEmployee.cnic || "N/A" },
                  { icon: MapPin, label: "Address", value: selectedEmployee.address || "N/A" },
                  { icon: Calendar, label: "DOB", value: selectedEmployee.dob || "N/A" },
                  { icon: AlertCircle, label: "Emergency Contact", value: selectedEmployee.emergencyContact || "N/A" },
                  { icon: Wallet, label: "Outstanding Advance", value: formatAdvancePayment(selectedEmployee.advancePayment || 0) },
                ].map((item, index) => (
                  <div key={`personal-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-md font-semibold text-foreground mb-4">CNIC Images</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    {selectedEmployee && selectedEmployee.cnicFrontImage && 
                     selectedEmployee.cnicFrontImage !== "" && 
                     !selectedEmployee.cnicFrontImage.includes("data:image/svg+xml") ? (
                      <div className="relative">
                        <img 
                          src={getFullImageUrl(selectedEmployee.cnicFrontImage)} 
                          alt="CNIC Front" 
                          className="w-full h-40 object-contain rounded-lg border border-border bg-gray-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='10' fill='%23999'%3ECNIC Front%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <a 
                          href={getFullImageUrl(selectedEmployee.cnicFrontImage)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                          title="View full image"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-gray-50">
                        <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No CNIC Front Image</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload in edit mode</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    {selectedEmployee && selectedEmployee.cnicBackImage && 
                     selectedEmployee.cnicBackImage !== "" && 
                     !selectedEmployee.cnicBackImage.includes("data:image/svg+xml") ? (
                      <div className="relative">
                        <img 
                          src={getFullImageUrl(selectedEmployee.cnicBackImage)} 
                          alt="CNIC Back" 
                          className="w-full h-40 object-contain rounded-lg border border-border bg-gray-50"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='10' fill='%23999'%3ECNIC Back%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <a 
                          href={getFullImageUrl(selectedEmployee.cnicBackImage)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                          title="View full image"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-gray-50">
                        <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No CNIC Back Image</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload in edit mode</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6 border-b border-border pb-3">
                Employment Details
              </h2>
              <div className="space-y-4">
                {[
                  { icon: Briefcase, label: "Job Title", value: selectedEmployee.title || "N/A" },
                  { icon: User, label: "Reporting Manager", value: selectedEmployee.reportingManager || "N/A" },
                  { icon: Calendar, label: "Hire Date", value: selectedEmployee.hireDate || "N/A" },
                  { icon: Clock, label: "Work Schedule", value: formatSchedule(selectedEmployee) },
                  { icon: Building2, label: "Department", value: selectedEmployee.department || "N/A" },
                  { icon: DollarSign, label: "Salary", value: formatSalary(selectedEmployee.salary) },
                  { icon: Briefcase, label: "Job Responsibilities", value: selectedEmployee.responsibilities || "N/A" },
                ].map((item, index) => (
                  <div key={`employment-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Finance & Salary Section */}
          <div className="mt-6 bg-secondary rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-primary" />
                  Finance & Salary
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Advance khud wapas ya salary se cut — account se linked (Easypaisa/JazzCash/Bank)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setFinanceAction("advance");
                    setFinanceForm((p) => ({ ...p, amount: "", description: "" }));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Give Advance
                </button>
                <button
                  onClick={() => {
                    setFinanceAction("repayment");
                    setFinanceForm((p) => ({ ...p, amount: "", description: "" }));
                  }}
                  disabled={(selectedEmployee.advancePayment || 0) <= 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Khud Wapas Pay
                </button>
                <button
                  onClick={() => {
                    const sal = financeLinked?.employee?.salary || parseEmployeeSalary(selectedEmployee.salary);
                    const deductDefault = advanceSettings.advanceRecoveryMode === "salary_deduct";
                    const monthly = advanceSettings.monthlyAdvanceDeduction || "";
                    setFinanceAction("salary");
                    setFinanceForm((p) => ({
                      ...p,
                      grossSalary: String(sal),
                      advanceToDeduct: monthly,
                      deductFromSalary: deductDefault,
                      periodLabel: new Date().toLocaleString("en-PK", { month: "long", year: "numeric" }),
                    }));
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm"
                >
                  <DollarSign className="w-4 h-4" />
                  Pay Salary
                </button>
              </div>
            </div>

            {/* Advance recovery preference */}
            <div className="mb-6 p-4 bg-card rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-3">Advance Recovery Setting</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Employee advance kaise wapas aayega — khud pay kare ya har month salary se cut ho
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    advanceSettings.advanceRecoveryMode === "self_pay"
                      ? "border-green-500 bg-green-500/5"
                      : "border-border hover:border-green-500/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="recoveryMode"
                    checked={advanceSettings.advanceRecoveryMode === "self_pay"}
                    onChange={() =>
                      setAdvanceSettings((p) => ({ ...p, advanceRecoveryMode: "self_pay" }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-foreground">Khud Wapas Dena (Self Pay)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Salary se cut nahi hoga — employee jab chahe account select karke khud pay karega
                    </p>
                  </div>
                </label>
                <label
                  className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                    advanceSettings.advanceRecoveryMode === "salary_deduct"
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-border hover:border-orange-500/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="recoveryMode"
                    checked={advanceSettings.advanceRecoveryMode === "salary_deduct"}
                    onChange={() =>
                      setAdvanceSettings((p) => ({ ...p, advanceRecoveryMode: "salary_deduct" }))
                    }
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-foreground">Salary Se Katwana (Monthly)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Har month salary se fixed amount auto cut hogi jab Pay Salary karen
                    </p>
                  </div>
                </label>
              </div>
              {advanceSettings.advanceRecoveryMode === "salary_deduct" && (
                <div className="max-w-xs">
                  <label className="block text-sm text-muted-foreground mb-2">
                    Monthly kitna katwana hai? (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advanceSettings.monthlyAdvanceDeduction}
                    onChange={(e) =>
                      setAdvanceSettings((p) => ({ ...p, monthlyAdvanceDeduction: e.target.value }))
                    }
                    placeholder={`e.g. 5000 (max outstanding: Rs. ${(selectedEmployee.advancePayment || 0).toLocaleString()})`}
                    className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                  />
                </div>
              )}
              <button
                onClick={handleSaveAdvanceSettings}
                disabled={savingAdvanceSettings}
                className="mt-4 px-5 py-2 bg-secondary border border-border rounded-lg hover:bg-muted text-sm disabled:opacity-50"
              >
                {savingAdvanceSettings ? "Saving..." : "Save Recovery Setting"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Monthly Salary", value: formatSalary(selectedEmployee.salary) },
                { label: "Outstanding Advance", value: formatAdvancePayment(selectedEmployee.advancePayment || 0), highlight: true },
                {
                  label: "Net Salary (planned deduct)",
                  value: `Rs. ${(financeLinked?.employee?.netSalaryAfterAdvance ??
                    Math.max(0, parseEmployeeSalary(selectedEmployee.salary) - calcSalaryDeduction())
                  ).toLocaleString()}`,
                },
                {
                  label: "Selected Account Balance",
                  value: financeBalances
                    ? `Rs. ${getBalanceForMethod(financeForm.method).toLocaleString()}`
                    : "—",
                },
              ].map((item, i) => (
                <div key={i} className="bg-card rounded-lg p-4 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className={`text-lg font-bold ${item.highlight ? "text-orange-600" : "text-foreground"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {financeAction && (
              <div className="mb-6 p-4 bg-card rounded-lg border border-primary/30">
                <h3 className="font-semibold text-foreground mb-4 capitalize">
                  {financeAction === "advance" && "Give Advance to Employee"}
                  {financeAction === "repayment" && "Employee Khud Advance Wapas De Raha Hai"}
                  {financeAction === "salary" && "Pay Salary"}
                </h3>
                {financeAction === "repayment" && (
                  <p className="text-sm text-green-600 mb-4">
                    Employee ne jo paisa diya wo selected account (Easypaisa/JazzCash/Bank) mein deposit ho jayega — salary se kuch cut nahi hoga
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Payment Account *</label>
                    <select
                      value={financeForm.method}
                      onChange={(e) => setFinanceForm((p) => ({ ...p, method: e.target.value }))}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label} (Rs. {getBalanceForMethod(m.value).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {financeAction !== "salary" ? (
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">
                        {financeAction === "repayment" ? "Wapas ki raqam (PKR) *" : "Amount (PKR) *"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={financeForm.amount}
                        onChange={(e) => setFinanceForm((p) => ({ ...p, amount: e.target.value }))}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                        placeholder={financeAction === "repayment" ? "Employee ne kitna diya" : "Enter amount"}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Gross Salary (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          value={financeForm.grossSalary}
                          onChange={(e) => setFinanceForm((p) => ({ ...p, grossSalary: e.target.value }))}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-2">Salary Period</label>
                        <input
                          type="text"
                          value={financeForm.periodLabel}
                          onChange={(e) => setFinanceForm((p) => ({ ...p, periodLabel: e.target.value }))}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                          placeholder="e.g. June 2026"
                        />
                      </div>
                    </>
                  )}

                  {financeAction === "salary" && (
                    <div className="md:col-span-3 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={financeForm.deductFromSalary}
                          onChange={(e) =>
                            setFinanceForm((p) => ({ ...p, deductFromSalary: e.target.checked }))
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-foreground">
                          Is month salary se advance cut karen
                          {advanceSettings.advanceRecoveryMode === "salary_deduct" &&
                            advanceSettings.monthlyAdvanceDeduction &&
                            ` (default: Rs. ${parseFloat(advanceSettings.monthlyAdvanceDeduction).toLocaleString()}/month)`}
                        </span>
                      </label>
                      {financeForm.deductFromSalary && (
                        <div className="max-w-sm">
                          <label className="block text-sm text-muted-foreground mb-2">
                            Is month kitna cut karna hai? (khali = monthly setting use hogi)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={financeForm.advanceToDeduct}
                            onChange={(e) => setFinanceForm((p) => ({ ...p, advanceToDeduct: e.target.value }))}
                            placeholder={
                              advanceSettings.monthlyAdvanceDeduction
                                ? `Default: Rs. ${parseFloat(advanceSettings.monthlyAdvanceDeduction).toLocaleString()}`
                                : `Max Rs. ${(selectedEmployee.advancePayment || 0).toLocaleString()}`
                            }
                            className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="md:col-span-3">
                    <label className="block text-sm text-muted-foreground mb-2">Description (optional)</label>
                    <input
                      type="text"
                      value={financeForm.description}
                      onChange={(e) => setFinanceForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground"
                    />
                  </div>

                  {financeAction === "salary" && (
                    <div className="md:col-span-3 p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                      {(() => {
                        const gross = parseFloat(financeForm.grossSalary) || parseEmployeeSalary(selectedEmployee.salary);
                        const deduct = calcSalaryDeduction();
                        const net = Math.max(0, gross - deduct);
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <span>Gross: <strong>Rs. {gross.toLocaleString()}</strong></span>
                            <span className="text-orange-600">
                              Advance cut: <strong>Rs. {deduct.toLocaleString()}</strong>
                              {!financeForm.deductFromSalary && " (salary se cut nahi)"}
                            </span>
                            <span className="text-green-600">Net pay from account: <strong>Rs. {net.toLocaleString()}</strong></span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleFinanceSubmit}
                    disabled={financeLoading}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {financeLoading ? "Processing..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setFinanceAction(null)}
                    className="px-6 py-2 bg-card border border-border rounded-lg hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Finance History
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFinanceMonthPreset("this_month")}
                    className="px-3 py-1.5 text-xs rounded-lg bg-card border border-border hover:bg-secondary"
                  >
                    Is Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceMonthPreset("last_month")}
                    className="px-3 py-1.5 text-xs rounded-lg bg-card border border-border hover:bg-secondary"
                  >
                    Pichla Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinanceMonthPreset("all")}
                    className="px-3 py-1.5 text-xs rounded-lg bg-card border border-border hover:bg-secondary"
                  >
                    Sab Records
                  </button>
                  <input
                    type="date"
                    value={financeDateFrom}
                    onChange={(e) => setFinanceDateFrom(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-input border border-border rounded-lg"
                  />
                  <span className="text-xs text-muted-foreground">se</span>
                  <input
                    type="date"
                    value={financeDateTo}
                    onChange={(e) => setFinanceDateTo(e.target.value)}
                    className="px-2 py-1.5 text-xs bg-input border border-border rounded-lg"
                  />
                </div>
              </div>
              {(financeDateFrom || financeDateTo) && (
                <p className="text-xs text-muted-foreground mb-2">
                  Filter: {financeDateFrom || "…"} — {financeDateTo || "…"}
                  {financeHistory.length > 0 && ` (${financeHistory.length} records)`}
                </p>
              )}
              {financeLoading && financeHistory.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </div>
              ) : financeHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                  Is date range mein koi record nahi — filter change karen ya naya transaction add karen
                </p>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Type</th>
                        <th className="text-left p-3">Account</th>
                        <th className="text-left p-3">Detail</th>
                        <th className="text-right p-3">Amount</th>
                        <th className="text-right p-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeHistory.map((row, i) => (
                        <tr key={row._id || i} className="border-t border-border">
                          <td className="p-3">{new Date(row.date).toLocaleDateString("en-PK")}</td>
                          <td className="p-3">{getFinanceTypeLabel(row.type)}</td>
                          <td className="p-3 capitalize">{row.method || "—"}</td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[180px] truncate">
                            {row.type === "salary_payment"
                              ? `Gross ${row.grossSalary?.toLocaleString()} | Adjust ${row.advanceDeducted?.toLocaleString()} | Net ${row.netPaid?.toLocaleString()}`
                              : row.description || "—"}
                          </td>
                          <td className="p-3 text-right font-medium">
                            Rs. {(row.type === "salary_payment" ? row.netPaid ?? row.amount : row.amount)?.toLocaleString()}
                          </td>
                          <td className="p-3 text-right">
                            {row.canDelete && row.transactionId ? (
                              <button
                                onClick={() => handleDeleteFinanceEntry(row.transactionId!)}
                                className="p-1 hover:bg-destructive/10 rounded"
                                title="Delete entry"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background">
      <div className="h-full w-full px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Employees</h1>
              <p className="text-sm text-muted-foreground">Total: {stats.totalEmployees} employees</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors">
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Employees", value: stats.totalEmployees },
            { label: "Active Departments", value: stats.activeDepartments },
            { label: "Pending Interviews", value: stats.pendingInterviews },
          ].map((stat, index) => (
            <div
              key={`stat-${index}`}
              className="bg-card rounded-xl p-5"
            >
              <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, department, title, or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading employees...</span>
          </div>
        ) : (
          <>
            {/* Employee Table */}
            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-secondary border-b border-border">
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Department & Role
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Salary
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Advance
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((employee) => (
                      <tr key={employee._id} className="hover:bg-secondary/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={getFullImageUrl(employee.avatar)}
                                alt={employee.name}
                                className="w-10 h-10 rounded-full object-cover border border-primary"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                                }}
                              />
                              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                employee.isActive ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{employee.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-foreground">{employee.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate max-w-[180px]">
                                {employee.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{employee.department}</p>
                            <p className="text-xs text-muted-foreground">{employee.title}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatSchedule(employee)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatSalary(employee.salary)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatAdvancePayment(employee.advancePayment || 0)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewProfile(employee)}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handlePrint(employee)}
                              disabled={isPrinting}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Print employee details"
                            >
                              <Printer className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleEditClick(employee)}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors"
                              title="Edit employee"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee)}
                              className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                              title="Delete employee"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                            <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-secondary border-t border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredEmployees.length} of {employees.length} employees
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

            {/* No Results */}
            {!isLoading && filteredEmployees.length === 0 && employees.length > 0 && (
              <div className="text-center py-12 bg-card rounded-xl border border-border mt-6">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No employees found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Clear search
                </button>
              </div>
            )}

            {!isLoading && employees.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-10 h-10 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No employees found</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Employee
                </button>
              </div>
            )}
          </>
        )}

        {/* Rest of your modals remain the same */}
        {/* Add Employee Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <div className="text-muted-foreground text-sm mb-1">Employees / Add Employee</div>
              <DialogTitle className="text-xl font-bold text-foreground">Add New Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Enter the details for Employee
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              {/* Photo Upload Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upload Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Photo */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Profile Photo</p>
                    <div 
                      onClick={() => triggerFileInput(fileInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {photoPreview ? (
                        <img 
                          src={photoPreview} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <User className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, false)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Front */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    <div 
                      onClick={() => triggerFileInput(cnicFrontInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {cnicFrontPreview ? (
                        <img 
                          src={cnicFrontPreview} 
                          alt="CNIC Front Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={cnicFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicFrontUpload(e, false)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Back */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    <div 
                      onClick={() => triggerFileInput(cnicBackInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {cnicBackPreview ? (
                        <img 
                          src={cnicBackPreview} 
                          alt="CNIC Back Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={cnicBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicBackUpload(e, false)}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'name', label: 'Employee Name', type: 'text', placeholder: 'e.g John Doe' },
                    { name: 'address', label: 'Address', type: 'text', placeholder: 'e.g Lahore' },
                    { name: 'phone', label: 'Phone No.', type: 'text', placeholder: 'e.g 03001234567' },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'e.g john@example.com' },
                    { name: 'cnic', label: 'CNIC No.', type: 'text', placeholder: 'e.g 17301-242111-3' },
                    { name: 'emergencyContact', label: 'Emergency Contact', type: 'text', placeholder: 'e.g 83662626' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name as keyof typeof formData] || ''}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                      />
                    </div>
                  ))}
                  
                  {/* Date of Birth with Custom Picker */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Date of Birth</label>
                    <div className="relative" ref={dobPickerRef}>
                      <div 
                        className="relative cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowDobPicker(prev => !prev);
                          setShowHireDatePicker(false);
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          name="dob"
                          value={formData.dob}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>

                      {showDobPicker && (
                        <div 
                          className="absolute z-[999] mt-1 w-72 bg-background border border-border rounded-lg shadow-2xl"
                          style={{ top: '100%', left: 0 }}
                        >
                          <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between mb-3">
                              <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                              </button>
                              <div className="text-sm font-semibold text-foreground">
                                {monthNames[currentMonth]} {currentYear}
                              </div>
                              <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              onClick={handleTodayDob}
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
                                const isSelected = selectedDobDate && 
                                                  selectedDobDate.getDate() === day &&
                                                  selectedDobDate.getMonth() === currentMonth &&
                                                  selectedDobDate.getFullYear() === currentYear;

                                return (
                                  <button
                                    key={day}
                                    onClick={() => handleDobDateSelect(day)}
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
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'employeeId', label: 'Employee ID', type: 'text', placeholder: 'e.g EMP202' },
                    { 
                      name: 'title', 
                      label: 'Job Title', 
                      type: 'text',
                      placeholder: 'e.g Senior Developer'
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'text',
                      placeholder: 'e.g IT Department'
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'salary', label: 'Salary*', type: 'number', placeholder: 'e.g 40000', min: "0", step: "1" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name as keyof typeof formData] || ''}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.step}
                        required={field.name === 'salary'}
                      />
                    </div>
                  ))}
                  
                  {/* Hiring Date with Custom Picker */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Hiring Date</label>
                    <div className="relative" ref={hireDatePickerRef}>
                      <div 
                        className="relative cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowHireDatePicker(prev => !prev);
                          setShowDobPicker(false);
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          name="hireDate"
                          value={formData.hireDate}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>

                      {showHireDatePicker && (
                        <div 
                          className="absolute z-[999] mt-1 w-72 bg-background border border-border rounded-lg shadow-2xl"
                          style={{ top: '100%', left: 0 }}
                        >
                          <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between mb-3">
                              <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                              </button>
                              <div className="text-sm font-semibold text-foreground">
                                {monthNames[currentMonth]} {currentYear}
                              </div>
                              <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              onClick={handleTodayHireDate}
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
                                const isSelected = selectedHireDate && 
                                                  selectedHireDate.getDate() === day &&
                                                  selectedHireDate.getMonth() === currentMonth &&
                                                  selectedHireDate.getFullYear() === currentYear;

                                return (
                                  <button
                                    key={day}
                                    onClick={() => handleHireDateSelect(day)}
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
                      )}
                    </div>
                  </div>
                  
                  {/* Time Fields */}
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">End Time</label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Job Responsibilities</label>
                    <input
                      type="text"
                      name="responsibilities"
                      value={formData.responsibilities}
                      onChange={handleInputChange}
                      placeholder="e.g Designing"
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-success rounded-lg text-success-foreground hover:bg-success/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Employee Modal - Remains exactly the same as your original */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            resetEditForm();
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <div className="text-muted-foreground text-sm mb-1">Employees / Edit Employee</div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Edit Employee - {editFormData.employeeId || "Loading..."}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Update the details for Employee
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              {/* Photo Upload Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upload Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Photo */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Profile Photo</p>
                    <div 
                      onClick={() => triggerFileInput(editFileInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editPhotoPreview ? (
                        <img 
                          src={editPhotoPreview} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <User className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, true)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Front */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    <div 
                      onClick={() => triggerFileInput(editCnicFrontInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editCnicFrontPreview ? (
                        <img 
                          src={editCnicFrontPreview} 
                          alt="CNIC Front Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editCnicFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicFrontUpload(e, true)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Back */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    <div 
                      onClick={() => triggerFileInput(editCnicBackInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editCnicBackPreview ? (
                        <img 
                          src={editCnicBackPreview} 
                          alt="CNIC Back Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editCnicBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicBackUpload(e, true)}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'name', label: 'Employee Name', type: 'text', placeholder: 'e.g John Doe' },
                    { name: 'address', label: 'Address', type: 'text', placeholder: 'e.g Lahore' },
                    { name: 'phone', label: 'Phone No.', type: 'text', placeholder: 'e.g 03001234567' },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'e.g john@example.com' },
                    { name: 'cnic', label: 'CNIC No.', type: 'text', placeholder: 'e.g 17301-242111-3' },
                    { name: 'emergencyContact', label: 'Emergency Contact', type: 'text', placeholder: 'e.g 83662626' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={editFormData[field.name as keyof typeof editFormData] || ''}
                        onChange={handleEditInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                      />
                    </div>
                  ))}
                  
                  {/* Date of Birth with Custom Picker */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Date of Birth</label>
                    <div className="relative" ref={editDobPickerRef}>
                      <div 
                        className="relative cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowEditDobPicker(prev => !prev);
                          setShowEditHireDatePicker(false);
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          name="dob"
                          value={editFormData.dob}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>

                      {showEditDobPicker && (
                        <div 
                          className="absolute z-[999] mt-1 w-72 bg-background border border-border rounded-lg shadow-2xl"
                          style={{ top: '100%', left: 0 }}
                        >
                          <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between mb-3">
                              <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                              </button>
                              <div className="text-sm font-semibold text-foreground">
                                {monthNames[currentMonth]} {currentYear}
                              </div>
                              <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              onClick={handleEditTodayDob}
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
                                const isSelected = selectedEditDobDate && 
                                                  selectedEditDobDate.getDate() === day &&
                                                  selectedEditDobDate.getMonth() === currentMonth &&
                                                  selectedEditDobDate.getFullYear() === currentYear;

                                return (
                                  <button
                                    key={day}
                                    onClick={() => handleEditDobDateSelect(day)}
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
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Employee ID</label>
                    <input
                      type="text"
                      name="employeeId"
                      value={editFormData.employeeId}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground cursor-not-allowed opacity-70"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground mt-1">Employee ID cannot be changed</p>
                  </div>
                  
                  {[
                    { 
                      name: 'title', 
                      label: 'Job Title', 
                      type: 'text',
                      placeholder: 'e.g Senior Developer'
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'text',
                      placeholder: 'e.g IT Department'
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'salary', label: 'Salary', type: 'number', placeholder: 'e.g 40000', min: "0", step: "1" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={editFormData[field.name as keyof typeof editFormData] || ''}
                        onChange={handleEditInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.step}
                      />
                    </div>
                  ))}
                  
                  {/* Hiring Date with Custom Picker */}
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Hiring Date</label>
                    <div className="relative" ref={editHireDatePickerRef}>
                      <div 
                        className="relative cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowEditHireDatePicker(prev => !prev);
                          setShowEditDobPicker(false);
                        }}
                      >
                        <input
                          type="text"
                          readOnly
                          name="hireDate"
                          value={editFormData.hireDate}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>

                      {showEditHireDatePicker && (
                        <div 
                          className="absolute z-[999] mt-1 w-72 bg-background border border-border rounded-lg shadow-2xl"
                          style={{ top: '100%', left: 0 }}
                        >
                          <div className="p-4 border-b border-border">
                            <div className="flex items-center justify-between mb-3">
                              <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                              </button>
                              <div className="text-sm font-semibold text-foreground">
                                {monthNames[currentMonth]} {currentYear}
                              </div>
                              <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded">
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              </button>
                            </div>
                            <button
                              onClick={handleEditTodayHireDate}
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
                                const isSelected = selectedEditHireDate && 
                                                  selectedEditHireDate.getDate() === day &&
                                                  selectedEditHireDate.getMonth() === currentMonth &&
                                                  selectedEditHireDate.getFullYear() === currentYear;

                                return (
                                  <button
                                    key={day}
                                    onClick={() => handleEditHireDateSelect(day)}
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
                      )}
                    </div>
                  </div>
                  
                  {/* Time Fields */}
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        value={editFormData.startTime}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">End Time</label>
                      <input
                        type="time"
                        name="endTime"
                        value={editFormData.endTime}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Job Responsibilities</label>
                    <input
                      type="text"
                      name="responsibilities"
                      value={editFormData.responsibilities}
                      onChange={handleEditInputChange}
                      placeholder="e.g Designing"
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetEditForm();
                  }}
                  className="px-6 py-3 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEmployee}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-success rounded-lg text-success-foreground hover:bg-success/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" />
                      Update
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Employee;