import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Eye, Trash2, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Calendar, Filter, CheckCircle, XCircle, IndianRupee, FileText, Package, User, Building, Download } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { toast } from "@/hooks/use-toast";
import axios from "axios";
import { exportAsCsv, exportAsWordTable, toYmd } from "@/lib/exportUtils";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// API endpoints
const EXPENSES_API_URL = `${API_BASE_URL}/api/expenses`;

/** YYYY-MM-DD in local calendar (toISOString shifts dates in non-UTC zones). */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRangeFromYyyyMm(yyyyMm: string): { start: string; end: string } {
  const parts = yyyyMm.split("-");
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  if (!y || !mo || mo < 1 || mo > 12) {
    const now = new Date();
    return {
      start: formatLocalYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: formatLocalYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  return {
    start: formatLocalYmd(new Date(y, mo - 1, 1)),
    end: formatLocalYmd(new Date(y, mo, 0)),
  };
}

function currentMonthInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Full year list for expense filters (native <input type="month"> often hides old years). */
function buildExpenseYearOptions(): number[] {
  const cy = new Date().getFullYear();
  const list: number[] = [];
  for (let y = cy + 15; y >= 1950; y--) list.push(y);
  return list;
}

const MONTH_PICKER_OPTIONS: { v: string; label: string }[] = [
  { v: "01", label: "January" },
  { v: "02", label: "February" },
  { v: "03", label: "March" },
  { v: "04", label: "April" },
  { v: "05", label: "May" },
  { v: "06", label: "June" },
  { v: "07", label: "July" },
  { v: "08", label: "August" },
  { v: "09", label: "September" },
  { v: "10", label: "October" },
  { v: "11", label: "November" },
  { v: "12", label: "December" },
];

function parseYyyyMm(s: string): { y: string; m: string } {
  if (s && /^\d{4}-\d{2}$/.test(s)) {
    const [ys, ms] = s.split("-");
    return { y: ys, m: ms.padStart(2, "0") };
  }
  const d = new Date();
  return { y: String(d.getFullYear()), m: String(d.getMonth() + 1).padStart(2, "0") };
}

interface ExpenseItem {
  _id: string;
  subject: string;
  description: string;
  purpose: string;
  usage: string;
  price: string;
  personResponsible: string;
  date: string;
  time: string;
  createdAt: string;
}

interface StatsData {
  summary: {
    totalExpenses: number;
    count: number;
  };
  byPurpose: Array<{
    _id: string;
    total: number;
    count: number;
  }>;
  byPerson: Array<{
    _id: string;
    total: number;
    count: number;
  }>;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Helper function to format date as "22 Jan 2026"
const formatDateWithMonthName = (dateString: string): string => {
  try {
    // First try to parse as DD/MM/YYYY format (from your existing data)
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Validate date
      if (isNaN(date.getTime())) {
        // If invalid, try ISO format
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
          dateString = isoDate.toLocaleDateString('en-GB');
          const [d, m, y] = dateString.split('/');
          return `${d} ${getMonthName(parseInt(m))} ${y}`;
        }
        return dateString; // Return original if can't parse
      }
      
      return `${day} ${getMonthName(month)} ${year}`;
    }
    
    // Try to parse as ISO date string
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `${day} ${getMonthName(month)} ${year}`;
    }
    
    return dateString; // Return original if can't parse
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
};

// Helper function to get month name
const getMonthName = (monthNumber: number): string => {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  return months[monthNumber - 1] || "";
};

// Professional Print Function - reportDateLabel = jo date/period user ne select kiya (wohi show)
const handleProfessionalPrint = (
  expenses: ExpenseItem[],
  currentPage: number,
  totalPages: number,
  totalItems: number,
  calculateTotalExpenses: () => number,
  totalAllPages: number,
  reportDateLabel: string,
  itemsPerPage: number = 10
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const pageTotal = calculateTotalExpenses();
  const averageExpense = totalItems > 0 ? totalAllPages / totalItems : 0;
  const generatedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Group by purpose for summary
  const purposeSummary: Record<string, { count: number; total: number }> = {};
  expenses.forEach(expense => {
    if (!purposeSummary[expense.purpose]) {
      purposeSummary[expense.purpose] = { count: 0, total: 0 };
    }
    purposeSummary[expense.purpose].count++;
    purposeSummary[expense.purpose].total += parseFloat(expense.price.replace(/,/g, ''));
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Expense Report - ${reportDateLabel}</title>
      <style>
        @media print {
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #333;
            background: white;
          }
          
          .print-header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
          }
          
          .company-name {
            font-size: 22pt;
            font-weight: bold;
            color: #1a365d;
            margin: 0;
            letter-spacing: 1px;
          }
          
          .report-title {
            font-size: 16pt;
            color: #2d3748;
            margin: 10px 0 5px 0;
          }
          
          .report-subtitle {
            font-size: 11pt;
            color: #718096;
            margin: 0 0 10px 0;
          }
          
          .report-meta {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            color: #4a5568;
            margin-top: 5px;
          }
          
          .summary-section {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 20px;
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 15px;
          }
          
          .summary-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px;
            text-align: center;
          }
          
          .summary-label {
            font-size: 8pt;
            color: #718096;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .summary-value {
            font-size: 14pt;
            font-weight: bold;
            color: #2d3748;
          }
          
          .summary-value.small {
            font-size: 11pt;
          }
          
          .table-container {
            margin: 20px 0;
          }
          
          .expense-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          
          .expense-table th {
            background: #2d3748;
            color: white;
            font-weight: 600;
            font-size: 9pt;
            padding: 8px 6px;
            text-align: left;
            border: 1px solid #e2e8f0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .expense-table td {
            padding: 6px;
            border: 1px solid #e2e8f0;
            font-size: 9pt;
          }
          
          .expense-table tr:nth-child(even) {
            background: #f8fafc;
          }
          
          .expense-table tr:hover {
            background: #edf2f7;
          }
          
          .amount-cell {
            font-weight: 600;
            text-align: right;
          }
          
          .purpose-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8pt;
            font-weight: 500;
          }
          
          .purpose-car { background: #bee3f8; color: #2c5282; }
          .purpose-office { background: #e9d8fd; color: #553c9a; }
          .purpose-travel { background: #c6f6d5; color: #22543d; }
          .purpose-equipment { background: #fed7d7; color: #9b2c2c; }
          .purpose-other { background: #fefcbf; color: #744210; }
          
          .usage-badge {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8pt;
            font-weight: 500;
          }
          
          .usage-personal { background: #fef3c7; color: #92400e; }
          .usage-company { background: #d1fae5; color: #065f46; }
          
          .summary-section-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
          }
          
          .purpose-breakdown {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px;
          }
          
          .breakdown-title {
            font-size: 10pt;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 4px;
          }
          
          .breakdown-item {
            display: flex;
            justify-content: space-between;
            font-size: 9pt;
            padding: 3px 0;
            border-bottom: 1px dotted #e2e8f0;
          }
          
          .breakdown-item:last-child {
            border-bottom: none;
          }
          
          .breakdown-label {
            color: #4a5568;
          }
          
          .breakdown-value {
            font-weight: 500;
            color: #2d3748;
          }
          
          .signature-section {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px;
            text-align: center;
          }
          
          .signature-line {
            margin-top: 30px;
            border-top: 1px solid #cbd5e0;
            padding-top: 10px;
            font-size: 9pt;
            color: #718096;
          }
          
          .page-footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #cbd5e0;
            font-size: 8pt;
            color: #718096;
            text-align: center;
          }
          
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #f7fafc;
            border-top: 1px solid #e2e8f0;
            padding: 8px 15mm;
            font-size: 8pt;
            color: #718096;
            display: flex;
            justify-content: space-between;
          }
          
          .page-number {
            font-weight: 500;
          }
          
          /* Hide unnecessary elements */
          .no-print, button, nav, .print-button, .back-button {
            display: none !important;
          }
          
          .print-only {
            display: block !important;
          }
          
          /* Ensure tables don't break across pages */
          .expense-table {
            page-break-inside: avoid;
          }
          
          .summary-section {
            page-break-inside: avoid;
          }
        }
        
        @media screen {
          .print-only {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        <!-- Header -->
        <div class="print-header">
          <h1 class="company-name">YOUR COMPANY NAME</h1>
          <h2 class="report-title">Daily Expense Report (Roznamcha)</h2>
          <p class="report-subtitle">Detailed listing of all recorded expenses</p>
          
          <div class="report-meta">
            <div class="meta-left">
              <strong>Report Period:</strong> ${reportDateLabel} | <strong>Generated:</strong> ${generatedOn} ${currentTime}
            </div>
            <div class="meta-right">
              <strong>Page:</strong> ${currentPage} of ${totalPages} | <strong>Records:</strong> ${totalItems}
            </div>
          </div>
        </div>
        
        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Expense (All Pages)</div>
              <div class="summary-value">Rs. ${totalAllPages.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">This Page Amount</div>
              <div class="summary-value">Rs. ${pageTotal.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Records (Page / Total)</div>
              <div class="summary-value">${expenses.length} / ${totalItems}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Report Period</div>
              <div class="summary-value small">${reportDateLabel}</div>
            </div>
          </div>
          
          <div class="summary-section-footer">
            <div class="purpose-breakdown">
              <div class="breakdown-title">Expense by Purpose</div>
              ${Object.entries(purposeSummary).map(([purpose, data]) => `
                <div class="breakdown-item">
                  <span class="breakdown-label">${purpose}:</span>
                  <span class="breakdown-value">Rs. ${data.total.toLocaleString()} (${data.count})</span>
                </div>
              `).join('')}
            </div>
            
            <div class="signature-section">
              <div class="signature-line">
                Authorized Signature
              </div>
              <div style="margin-top: 5px; font-size: 8pt; color: #718096;">
                Finance Department
              </div>
            </div>
          </div>
        </div>
        
        <!-- Expense Table -->
        <div class="table-container">
          <table class="expense-table">
            <thead>
              <tr>
                <th width="5%">#</th>
                <th width="25%">Subject & Description</th>
                <th width="12%">Purpose</th>
                <th width="10%">Usage</th>
                <th width="12%">Amount</th>
                <th width="12%">Responsible Person</th>
                <th width="12%">Date</th>
                <th width="12%">Time</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map((expense, index) => {
                const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                const formattedDate = formatDateWithMonthName(expense.date);
                const priceValue = parseFloat(expense.price.replace(/,/g, ''));
                
                // Determine purpose badge class
                const purposeClass = `purpose-${expense.purpose.toLowerCase()}`;
                
                // Determine usage badge class
                const usageClass = expense.usage === 'Personal' ? 'usage-personal' : 'usage-company';
                
                return `
                  <tr>
                    <td>${serialNumber}</td>
                    <td>
                      <strong>${expense.subject}</strong><br>
                      <span style="font-size: 8pt; color: #666;">${expense.description}</span>
                    </td>
                    <td>
                      <span class="purpose-badge ${purposeClass}">
                        ${expense.purpose}
                      </span>
                    </td>
                    <td>
                      <span class="usage-badge ${usageClass}">
                        ${expense.usage}
                      </span>
                    </td>
                    <td class="amount-cell">
                      <strong>Rs. ${priceValue.toLocaleString()}</strong>
                    </td>
                    <td>${expense.personResponsible}</td>
                    <td>${formattedDate}</td>
                    <td>${expense.time}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Page Footer -->
        <div class="page-footer">
          <p>This document is computer generated and requires no signature for validation.</p>
          <p>For any queries, please contact the Finance Department.</p>
          <p style="margin-top: 5px;"><strong>Confidential - For Internal Use Only</strong></p>
        </div>
      </div>
      
      <!-- Print Footer (Fixed at bottom) -->
      <div class="print-footer">
        <div class="footer-left">
          YOUR COMPANY NAME • Expense Report
        </div>
        <div class="footer-right">
          Generated on ${generatedOn} ${currentTime} • Page <span class="page-number">${currentPage}</span> of ${totalPages}
        </div>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 250);
};

// View Modal Component
function ExpenseViewModal({ 
  expense, 
  onClose,
  onEdit,
  onDelete,
  allExpenses
}: { 
  expense: ExpenseItem | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allExpenses: ExpenseItem[];
}) {
  if (!expense) return null;

  // Calculate statistics using the passed allExpenses
  const calculateMonthTotal = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthExpenses = allExpenses.filter(e => {
      try {
        const expenseDate = new Date(e.date);
        const expenseMonth = expenseDate.getMonth() + 1;
        const expenseYear = expenseDate.getFullYear();
        return expenseMonth === currentMonth && expenseYear === currentYear;
      } catch (error) {
        return false;
      }
    });
    const total = monthExpenses.reduce((sum, e) => sum + parseFloat(e.price.replace(/,/g, '')), 0);
    return total;
  };

  const calculateYearTotal = () => {
    const currentYear = new Date().getFullYear();
    const yearExpenses = allExpenses.filter(e => {
      try {
        const expenseDate = new Date(e.date);
        const expenseYear = expenseDate.getFullYear();
        return expenseYear === currentYear;
      } catch (error) {
        return false;
      }
    });
    const total = yearExpenses.reduce((sum, e) => sum + parseFloat(e.price.replace(/,/g, '')), 0);
    return total;
  };

  const monthTotal = calculateMonthTotal();
  const yearTotal = calculateYearTotal();

  // Format date for display in modal
  const formattedDate = formatDateWithMonthName(expense.date);

  // Handle print for single expense view
  const handleViewPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expense Details - ${expense.subject}</title>
        <style>
          @media print {
            @page {
              margin: 15mm;
              size: A4 portrait;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 10pt;
              line-height: 1.4;
              color: #333;
              background: white;
            }
            
            .print-header {
              text-align: center;
              margin-bottom: 25px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            
            .company-name {
              font-size: 20pt;
              font-weight: bold;
              color: #1a365d;
              margin: 0;
            }
            
            .report-title {
              font-size: 16pt;
              color: #2d3748;
              margin: 10px 0 5px 0;
            }
            
            .expense-id {
              font-size: 10pt;
              color: #718096;
              background: #f7fafc;
              padding: 4px 12px;
              border-radius: 12px;
              display: inline-block;
              margin: 5px 0;
            }
            
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 25px 0;
            }
            
            .details-section {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 20px;
            }
            
            .section-title {
              font-size: 12pt;
              font-weight: 600;
              color: #2d3748;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #cbd5e0;
            }
            
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px dotted #e2e8f0;
            }
            
            .detail-row:last-child {
              border-bottom: none;
              margin-bottom: 0;
              padding-bottom: 0;
            }
            
            .detail-label {
              font-size: 10pt;
              color: #4a5568;
              font-weight: 500;
            }
            
            .detail-value {
              font-size: 10pt;
              color: #2d3748;
              font-weight: 600;
              text-align: right;
              max-width: 60%;
            }
            
            .amount-highlight {
              font-size: 18pt;
              color: #2d3748;
              font-weight: bold;
              text-align: right;
            }
            
            .purpose-badge {
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 9pt;
              font-weight: 500;
            }
            
            .purpose-car { background: #bee3f8; color: #2c5282; }
            .purpose-office { background: #e9d8fd; color: #553c9a; }
            .purpose-travel { background: #c6f6d5; color: #22543d; }
            
            .usage-badge {
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 9pt;
              font-weight: 500;
            }
            
            .usage-personal { background: #fef3c7; color: #92400e; }
            .usage-company { background: #d1fae5; color: #065f46; }
            
            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-top: 25px;
            }
            
            .stat-card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 15px;
              text-align: center;
            }
            
            .stat-label {
              font-size: 9pt;
              color: #718096;
              margin-bottom: 5px;
            }
            
            .stat-value {
              font-size: 16pt;
              font-weight: bold;
              color: #2d3748;
            }
            
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #cbd5e0;
              text-align: center;
              font-size: 9pt;
              color: #718096;
            }
            
            .signature-area {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #cbd5e0;
              display: flex;
              justify-content: space-between;
            }
            
            .signature-box {
              text-align: center;
              width: 45%;
            }
            
            .signature-line {
              margin-top: 40px;
              border-top: 1px solid #666;
              padding-top: 10px;
              font-size: 9pt;
            }
            
            .print-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              background: #f7fafc;
              border-top: 1px solid #e2e8f0;
              padding: 8px 15mm;
              font-size: 8pt;
              color: #718096;
              display: flex;
              justify-content: space-between;
            }
            
            /* Hide unnecessary elements */
            .no-print, button, nav, .print-button, .back-button {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <!-- Header -->
          <div class="print-header">
            <h1 class="company-name">YOUR COMPANY NAME</h1>
            <h2 class="report-title">Expense Detail Report</h2>
            <div class="expense-id">Expense ID: ${expense._id.substring(0, 8)}...</div>
            <p style="color: #718096; margin-top: 10px;">
              Generated on ${currentDate} at ${currentTime}
            </p>
          </div>
          
          <!-- Details Grid -->
          <div class="details-grid">
            <div class="details-section">
              <div class="section-title">Expense Information</div>
              
              <div class="detail-row">
                <span class="detail-label">Subject:</span>
                <span class="detail-value">${expense.subject}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${expense.description}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Purpose:</span>
                <span class="detail-value">
                  <span class="purpose-badge purpose-${expense.purpose.toLowerCase()}">
                    ${expense.purpose}
                  </span>
                </span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Usage Type:</span>
                <span class="detail-value">
                  <span class="usage-badge usage-${expense.usage.toLowerCase()}">
                    ${expense.usage}
                  </span>
                </span>
              </div>
            </div>
            
            <div class="details-section">
              <div class="section-title">Financial Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Amount:</span>
                <span class="amount-highlight">
                  Rs. ${parseFloat(expense.price.replace(/,/g, '')).toLocaleString()}
                </span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${expense.time}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Recorded On:</span>
                <span class="detail-value">
                  ${formatDateWithMonthName(expense.createdAt)} at ${new Date(expense.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Person Details -->
          <div class="details-section" style="margin-top: 20px;">
            <div class="section-title">Responsible Person Details</div>
            
            <div class="detail-row">
              <span class="detail-label">Responsible Person:</span>
              <span class="detail-value">${expense.personResponsible}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Department:</span>
              <span class="detail-value">
                ${expense.personResponsible === 'HR' ? 'Human Resources' :
                 expense.personResponsible === 'Admin' ? 'Administration' :
                 expense.personResponsible === 'CEO' ? 'Executive' :
                 expense.personResponsible === 'Finance Dept' ? 'Finance' : 'General'}
              </span>
            </div>
          </div>
          
          <!-- Statistics -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">This Month's Total</div>
              <div class="stat-value">Rs. ${monthTotal.toLocaleString()}</div>
            </div>
            
            <div class="stat-card">
              <div class="stat-label">This Year's Total</div>
              <div class="stat-value">Rs. ${yearTotal.toLocaleString()}</div>
            </div>
          </div>
          
          <!-- Signature Area -->
          <div class="signature-area">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="margin-top: 5px; font-size: 9pt; color: #718096;">
                Prepared By
              </div>
            </div>
            
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="margin-top: 5px; font-size: 9pt; color: #718096;">
                Authorized By
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>This is a computer generated document and requires no signature for validation.</p>
            <p style="margin-top: 5px;"><strong>Confidential - For Internal Use Only</strong></p>
          </div>
        </div>
        
        <!-- Print Footer -->
        <div class="print-footer">
          <div class="footer-left">
            YOUR COMPANY NAME • Expense Detail
          </div>
          <div class="footer-right">
            Page 1 of 1 • ${currentDate} ${currentTime}
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-cms-card rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-cms-card z-10 border-b border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Expense Details</h1>
              <p className="text-sm text-muted-foreground">Complete details for the selected expense</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={onEdit}
                className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={handleViewPrint}
                className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button 
                onClick={onDelete}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
              >
                <XCircle className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Details Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Expense Details Card */}
            <div className="bg-cms-secondary rounded-xl p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4 pb-3 border-b border-border">
                Expense Information
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span className="text-sm">Subject</span>
                  </div>
                  <span className="text-sm text-foreground font-medium">{expense.subject}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">Description</span>
                  </div>
                  <span className="text-sm text-foreground font-medium">{expense.description}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Purpose</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    expense.purpose === 'Car' ? 'bg-blue-100 text-blue-800' :
                    expense.purpose === 'Office' ? 'bg-purple-100 text-purple-800' :
                    expense.purpose === 'Travel' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {expense.purpose}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Building className="w-4 h-4" />
                    <span className="text-sm">Usage Type</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    expense.usage === 'Personal' 
                      ? 'bg-yellow-100 text-yellow-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {expense.usage}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Details Card */}
            <div className="bg-cms-secondary rounded-xl p-5">
              <h3 className="text-lg font-semibold text-foreground mb-4 pb-3 border-b border-border">
                Financial Details
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <IndianRupee className="w-4 h-4" />
                    <span className="text-sm">Amount</span>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    Rs. {parseFloat(expense.price.replace(/,/g, '')).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Date</span>
                  </div>
                  <span className="text-sm text-foreground font-medium">{formattedDate}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Time</span>
                  </div>
                  <span className="text-sm text-foreground font-medium">{expense.time}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Created At</span>
                  </div>
                  <span className="text-sm text-foreground font-medium">
                    {formatDateWithMonthName(expense.createdAt)} at {new Date(expense.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Person Details Card */}
          <div className="bg-cms-secondary rounded-xl p-5 max-w-md mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 pb-3 border-b border-border">
              Responsible Person Details
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="text-sm">Responsible Person</span>
                </div>
                <span className="text-sm text-foreground font-medium">{expense.personResponsible}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span className="text-sm">Department</span>
                </div>
                <span className="text-sm text-foreground font-medium">
                  {expense.personResponsible === 'HR' ? 'Human Resources' :
                   expense.personResponsible === 'Admin' ? 'Administration' :
                   expense.personResponsible === 'CEO' ? 'Executive' :
                   expense.personResponsible === 'Finance Dept' ? 'Finance' : 'General'}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-cms-secondary rounded-xl p-5">
            <h3 className="text-lg font-semibold text-foreground mb-4 pb-3 border-b border-border">
              Expense Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cms-card rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">This Month's Total</p>
                <p className="text-lg font-bold text-foreground">
                  Rs. {monthTotal.toLocaleString()}
                </p>
              </div>
              
              <div className="bg-cms-card rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">This Year's Total</p>
                <p className="text-lg font-bold text-foreground">
                  Rs. {yearTotal.toLocaleString()}
                </p>
              </div>
              
              <div className="bg-cms-card rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Average Daily Expense</p>
                <p className="text-lg font-bold text-foreground">
                  Rs. {(yearTotal / 365).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              
              <div className="bg-cms-card rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Expenses Count</p>
                <p className="text-lg font-bold text-foreground">
                  {allExpenses.length} records
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RoznamchaView() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<ExpenseItem | null>(null);
  const [viewExpense, setViewExpense] = useState<ExpenseItem | null>(null);
  const [activeTab, setActiveTab] = useState("All");
  const [filters, setFilters] = useState({
    purpose: "",
    personResponsible: "",
    usage: ""
  });
  const [selectedMonth, setSelectedMonth] = useState(currentMonthInputValue);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  /** On "All" tab: optional month+year (both set = filter applied). */
  const [allTabYear, setAllTabYear] = useState("");
  const [allTabMonthNum, setAllTabMonthNum] = useState("");
  const allTabMonthFilter =
    allTabYear && allTabMonthNum ? `${allTabYear}-${allTabMonthNum}` : "";
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [optimisticUpdates, setOptimisticUpdates] = useState<{[key: string]: ExpenseItem}>({});

  // Pagination states
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNext: false,
    hasPrevious: false
  });

  // Fetch expenses from backend with pagination
  const fetchExpenses = async (page = 1) => {
    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("sortBy", "createdAt");
      params.append("sortOrder", "desc");

      // Add filters if they exist
      if (filters.purpose) params.append("purpose", filters.purpose);
      if (filters.personResponsible) params.append("personResponsible", filters.personResponsible);
      if (filters.usage) params.append("usage", filters.usage);

      if (searchTerm) params.append("search", searchTerm);

      let dateRangeActive = false;
      // Handle active tab filters: Daily | Weekly | Monthly | Yearly | All (+ optional month)
      if (activeTab === "Daily") {
        const targetDate = selectedDate || formatLocalYmd(new Date());
        params.append("startDate", targetDate);
        params.append("endDate", targetDate);
        dateRangeActive = true;
      } else if (activeTab === "Weekly") {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        params.append("startDate", formatLocalYmd(monday));
        params.append("endDate", formatLocalYmd(sunday));
        dateRangeActive = true;
      } else if (activeTab === "Monthly") {
        const { start, end } = monthRangeFromYyyyMm(selectedMonth || currentMonthInputValue());
        params.append("startDate", start);
        params.append("endDate", end);
        dateRangeActive = true;
      } else if (activeTab === "Yearly") {
        const targetYear = selectedYear || new Date().getFullYear().toString();
        const y = parseInt(targetYear, 10);
        params.append("startDate", formatLocalYmd(new Date(y, 0, 1)));
        params.append("endDate", formatLocalYmd(new Date(y, 11, 31)));
        dateRangeActive = true;
      } else if (activeTab === "All" && allTabMonthFilter.trim()) {
        const { start, end } = monthRangeFromYyyyMm(allTabMonthFilter.trim());
        params.append("startDate", start);
        params.append("endDate", end);
        dateRangeActive = true;
      }

      // Month / year / day filters: fetch enough rows so the full month (etc.) is visible (was capped at 10)
      params.append("limit", dateRangeActive ? "500" : "10");
      
      const response = await api.get(`${EXPENSES_API_URL}/get-all?${params.toString()}`);
      
      if (response.data.success) {
        const fetchedExpenses = response.data.data;
        
        // Merge with optimistic updates
        const mergedExpenses = fetchedExpenses.map(expense => {
          if (optimisticUpdates[expense._id]) {
            return optimisticUpdates[expense._id];
          }
          return expense;
        });
        
        setExpenses(mergedExpenses);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Failed to load expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics with same filters as list so Total Expense = sab pages ki amount ka total
  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.purpose) params.append('purpose', filters.purpose);
      if (filters.personResponsible) params.append('personResponsible', filters.personResponsible);
      if (filters.usage) params.append('usage', filters.usage);
      if (activeTab === "Daily") {
        const targetDate = selectedDate || formatLocalYmd(new Date());
        params.append("startDate", targetDate);
        params.append("endDate", targetDate);
      } else if (activeTab === "Weekly") {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        params.append("startDate", formatLocalYmd(monday));
        params.append("endDate", formatLocalYmd(sunday));
      } else if (activeTab === "Monthly") {
        const { start, end } = monthRangeFromYyyyMm(selectedMonth || currentMonthInputValue());
        params.append("startDate", start);
        params.append("endDate", end);
      } else if (activeTab === "Yearly") {
        const targetYear = selectedYear || new Date().getFullYear().toString();
        const y = parseInt(targetYear, 10);
        params.append("startDate", formatLocalYmd(new Date(y, 0, 1)));
        params.append("endDate", formatLocalYmd(new Date(y, 11, 31)));
      } else if (activeTab === "All" && allTabMonthFilter.trim()) {
        const { start, end } = monthRangeFromYyyyMm(allTabMonthFilter.trim());
        params.append("startDate", start);
        params.append("endDate", end);
      }
      const qs = params.toString();
      const url = qs ? `${EXPENSES_API_URL}/stats?${qs}` : `${EXPENSES_API_URL}/stats`;
      const response = await api.get(url);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const exportExpensesBackup = async (format: "excel" | "word") => {
    try {
      const params = new URLSearchParams();
      params.append("page", "1");
      params.append("limit", "5000");
      params.append("sortBy", "createdAt");
      params.append("sortOrder", "desc");
      if (filters.purpose) params.append("purpose", filters.purpose);
      if (filters.personResponsible) params.append("personResponsible", filters.personResponsible);
      if (filters.usage) params.append("usage", filters.usage);
      if (searchTerm) params.append("search", searchTerm);

      if (exportStartDate || exportEndDate) {
        if (exportStartDate) params.append("startDate", exportStartDate);
        if (exportEndDate) params.append("endDate", exportEndDate);
      } else if (activeTab === "Daily") {
        const targetDate = selectedDate || formatLocalYmd(new Date());
        params.append("startDate", targetDate);
        params.append("endDate", targetDate);
      } else if (activeTab === "Weekly") {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        params.append("startDate", formatLocalYmd(monday));
        params.append("endDate", formatLocalYmd(sunday));
      } else if (activeTab === "Monthly") {
        const { start, end } = monthRangeFromYyyyMm(selectedMonth || currentMonthInputValue());
        params.append("startDate", start);
        params.append("endDate", end);
      } else if (activeTab === "Yearly") {
        const targetYear = selectedYear || new Date().getFullYear().toString();
        const y = parseInt(targetYear, 10);
        params.append("startDate", formatLocalYmd(new Date(y, 0, 1)));
        params.append("endDate", formatLocalYmd(new Date(y, 11, 31)));
      } else if (activeTab === "All" && allTabMonthFilter.trim()) {
        const { start, end } = monthRangeFromYyyyMm(allTabMonthFilter.trim());
        params.append("startDate", start);
        params.append("endDate", end);
      }

      const response = await api.get(`${EXPENSES_API_URL}/get-all?${params.toString()}`);
      if (!response.data.success) throw new Error("Failed to fetch expenses for export");
      const allRows: ExpenseItem[] = response.data.data || [];
      if (allRows.length === 0) {
        toast({
          title: "No data",
          description: "No expense records found for selected filter/date range.",
          variant: "destructive",
        });
        return;
      }

      const headers = ["Date", "Time", "Subject", "Purpose", "Usage", "Price", "Responsible", "Description"];
      const rows = allRows.map((e) => ({
        "Date": formatDateWithMonthName(e.date),
        "Time": e.time || "",
        "Subject": e.subject || "",
        "Purpose": e.purpose || "",
        "Usage": e.usage || "",
        "Price": e.price || 0,
        "Responsible": e.personResponsible || "",
        "Description": e.description || "",
      }));
      const fileRange = exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : `${activeTab}_${toYmd(new Date())}`;
      if (format === "excel") {
        exportAsCsv(`Roznamcha_Backup_${fileRange}.csv`, headers, rows);
      } else {
        exportAsWordTable(`Roznamcha_Backup_${fileRange}.doc`, "Roznamcha Expense Report", headers, rows);
      }
      toast({ title: "Export complete", description: `${rows.length} expense records exported.` });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to export expenses backup.",
        variant: "destructive",
      });
    }
  };

  // Handle adding/editing expense
  const handleSaveExpense = async (expenseData: any) => {
    try {
      let response;
      
      if (editExpense) {
        // OPTIMISTIC UPDATE: Update UI immediately
        const optimisticExpense = {
          ...editExpense,
          ...expenseData
        };
        
        // Update local state immediately
        setExpenses(prev => 
          prev.map(expense => 
            expense._id === editExpense._id ? optimisticExpense : expense
          )
        );
        
        // Store optimistic update
        setOptimisticUpdates(prev => ({
          ...prev,
          [editExpense._id]: optimisticExpense
        }));
        
        // Close dialog immediately for better UX
        setDialogOpen(false);
        setEditExpense(null);
        
        toast({
          title: "Updating...",
          description: "Saving changes in background...",
        });
        
        // Make API call in background
        response = await api.put(`${EXPENSES_API_URL}/${editExpense._id}`, expenseData);
        
        if (response.data.success) {
          // Update with server data
          setExpenses(prev => 
            prev.map(expense => 
              expense._id === editExpense._id ? response.data.data : expense
            )
          );
          
          // Clear optimistic update
          setOptimisticUpdates(prev => {
            const newState = {...prev};
            delete newState[editExpense._id];
            return newState;
          });
          
          toast({
            title: "Success",
            description: "Expense updated successfully",
            action: <CheckCircle className="w-4 h-4 text-green-500" />,
          });
        }
      } else {
        // OPTIMISTIC UPDATE: Create temporary ID for new expense
        const tempId = `temp-${Date.now()}`;
        const optimisticExpense: ExpenseItem = {
          _id: tempId,
          subject: expenseData.subject,
          description: expenseData.description,
          purpose: expenseData.purpose,
          usage: expenseData.usage,
          price: expenseData.price,
          personResponsible: expenseData.personResponsible,
          date: expenseData.date,
          time: expenseData.time,
          createdAt: new Date().toISOString(),
        };
        
        // Add to local state immediately (at the top)
        setExpenses(prev => [optimisticExpense, ...prev]);
        
        // Close dialog immediately
        setDialogOpen(false);
        
        toast({
          title: "Creating...",
          description: "Adding new expense in background...",
        });
        
        // Make API call in background
        response = await api.post(`${EXPENSES_API_URL}/create-expense`, expenseData);
        
        if (response.data.success) {
          // Replace temporary expense with real one from server
          setExpenses(prev => 
            prev.map(expense => 
              expense._id === tempId ? response.data.data : expense
            )
          );
          
          toast({
            title: "Success",
            description: "Expense added successfully",
            action: <CheckCircle className="w-4 h-4 text-green-500" />,
          });
        }
      }
      
      // Update stats in background
      fetchStats();
      
    } catch (error: any) {
      console.error("Error saving expense:", error);
      
      // ROLLBACK: Revert optimistic update on error
      if (editExpense) {
        // Refetch the original data for this expense
        try {
          const originalResponse = await api.get(`${EXPENSES_API_URL}/${editExpense._id}`);
          if (originalResponse.data.success) {
            setExpenses(prev => 
              prev.map(expense => 
                expense._id === editExpense._id ? originalResponse.data.data : expense
              )
            );
          }
        } catch (fetchError) {
          // If can't fetch original, refresh all
          fetchExpenses(pagination.currentPage);
        }
        
        // Clear optimistic update
        setOptimisticUpdates(prev => {
          const newState = {...prev};
          delete newState[editExpense._id];
          return newState;
        });
      } else {
        // Remove temporary expense on error
        setExpenses(prev => prev.filter(expense => !expense._id.startsWith('temp-')));
      }
      
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save expense",
        variant: "destructive",
        action: <XCircle className="w-4 h-4 text-red-500" />,
      });
    }
  };

  // Handle delete expense
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    
    // If viewing this expense, close the modal first
    if (viewExpense && viewExpense._id === id) {
      setViewExpense(null);
    }
    
    // OPTIMISTIC UPDATE: Remove from UI immediately
    const expenseToDelete = expenses.find(expense => expense._id === id);
    setExpenses(prev => prev.filter(expense => expense._id !== id));
    
    try {
      await api.delete(`${EXPENSES_API_URL}/${id}`);
      
      toast({
        title: "Success",
        description: "Expense deleted successfully",
        action: <CheckCircle className="w-4 h-4 text-green-500" />,
      });
      
      // Update stats in background
      fetchStats();
      // Refresh current page to update pagination counts
      fetchExpenses(pagination.currentPage);
      
    } catch (error) {
      console.error("Error deleting expense:", error);
      
      // ROLLBACK: Add back the expense on error
      if (expenseToDelete) {
        setExpenses(prev => [...prev, expenseToDelete]);
      }
      
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
        action: <XCircle className="w-4 h-4 text-red-500" />,
      });
    }
  };

  // Handle edit expense
  const handleEditExpense = (expense: ExpenseItem) => {
    setEditExpense(expense);
    setDialogOpen(true);
    // Close view modal if open
    setViewExpense(null);
  };

  // Handle view expense
  const handleViewExpense = async (id: string) => {
    try {
      const response = await api.get(`${EXPENSES_API_URL}/${id}`);
      if (response.data.success) {
        setViewExpense(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching expense details:", error);
      toast({
        title: "Error",
        description: "Failed to load expense details",
        variant: "destructive",
      });
    }
  };

  // Handle dialog close
  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditExpense(null);
    }
  };

  // Handle view modal close
  const handleViewModalClose = () => {
    setViewExpense(null);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchExpenses(page);
    }
  };

  // Handle filter change
  const handleFilterChange = () => {
    // Relying on useEffect to fetch when state updates
  };

  // Handle active tab change
  const handleActiveTabChange = (tab: string) => {
    setActiveTab(tab);
    // Let useEffect handle resetting page or dependencies
  };

  // Total expense = sab pages ki amount (from stats API); fallback = current page sum
  const totalExpenseAllPages = stats?.summary?.totalExpenses ?? 0;
  // Report period label = jo date/period user ne select kiya (print aur display ke liye)
  const reportDateLabel = activeTab === "Daily"
    ? new Date(selectedDate || new Date()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : activeTab === "Weekly"
      ? (() => {
          const now = new Date();
          const day = now.getDay();
          const mondayOffset = day === 0 ? -6 : 1 - day;
          const monday = new Date(now);
          monday.setDate(now.getDate() + mondayOffset);
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          return `${monday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${sunday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
        })()
    : activeTab === "Monthly"
      ? (() => {
          const date = selectedMonth ? new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1) : new Date();
          return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        })()
    : activeTab === "Yearly"
      ? (selectedYear || new Date().getFullYear().toString())
      : activeTab === "All" && allTabMonthFilter.trim()
        ? new Date(`${monthRangeFromYyyyMm(allTabMonthFilter.trim()).start}T12:00:00`).toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })
        : "All dates";
  const calculateTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + (parseFloat(expense.price.replace(/,/g, '')) || 0), 0);
  };

  // Generate pagination range
  const getPaginationRange = () => {
    const range = [];
    const current = pagination.currentPage;
    const total = pagination.totalPages;
    const delta = 1;
    
    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }
    
    if (current - delta > 2) {
      range.unshift('...');
    }
    if (current + delta < total - 1) {
      range.push('...');
    }
    
    if (total > 0) {
      range.unshift(1);
      if (total > 1) range.push(total);
    }
    
    return range;
  };

  // Initial data fetch
  useEffect(() => {
    fetchExpenses(1);
    fetchStats();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses(1);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handle filter/tab changes - refresh list and total expense (stats)
  useEffect(() => {
    fetchExpenses(1);
    fetchStats();
  }, [filters.purpose, filters.personResponsible, filters.usage, activeTab, selectedMonth, selectedDate, selectedYear, allTabYear, allTabMonthNum]);

  return (
    <>
      <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
        {/* Header */}
        <div className="bg-cms-table-header rounded-lg px-3 sm:px-4 py-3 mb-4 sm:mb-6 flex items-center gap-3 border-l-4 border-primary">
          <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Daily Expense <span className="text-muted-foreground">(Roznamcha)</span></h1>
        </div>

        {/* Tabs and Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-1 bg-cms-card rounded-lg p-1 overflow-x-auto">
            {["All", "Daily", "Weekly", "Monthly", "Yearly"].map((tab) => (
              <button
                key={tab}
                onClick={() => handleActiveTabChange(tab)}
                className={`px-3 sm:px-6 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setEditExpense(null);
              setDialogOpen(true);
            }}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Expenses
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <select
              value={filters.purpose}
              onChange={(e) => {
                setFilters({...filters, purpose: e.target.value});
                handleFilterChange();
              }}
              className="bg-cms-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Categories</option>
              <option value="Car">Car</option>
              <option value="Office">Office</option>
              <option value="Travel">Travel</option>
              <option value="Equipment">Equipment</option>
            </select>
            <select
              value={filters.personResponsible}
              onChange={(e) => {
                setFilters({...filters, personResponsible: e.target.value});
                handleFilterChange();
              }}
              className="bg-cms-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Persons</option>
              <option value="HR">HR</option>
              <option value="Admin">Admin</option>
              <option value="CEO">CEO</option>
              <option value="Finance Dept">Finance Dept</option>
            </select>
            <select
              value={filters.usage}
              onChange={(e) => {
                setFilters({...filters, usage: e.target.value});
                handleFilterChange();
              }}
              className="bg-cms-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Usage</option>
              <option value="Personal">Personal</option>
              <option value="Company">Company</option>
            </select>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {activeTab === "Daily" && (
              <input
                type="date"
                value={selectedDate || formatLocalYmd(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10"
              />
            )}
            {activeTab === "Monthly" && (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={parseYyyyMm(selectedMonth).m}
                  onChange={(e) => {
                    const { y } = parseYyyyMm(selectedMonth);
                    setSelectedMonth(`${y}-${e.target.value}`);
                  }}
                  className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 min-w-[8.5rem]"
                  title="Month"
                >
                  {MONTH_PICKER_OPTIONS.map((mo) => (
                    <option key={mo.v} value={mo.v}>
                      {mo.label}
                    </option>
                  ))}
                </select>
                <select
                  value={parseYyyyMm(selectedMonth).y}
                  onChange={(e) => {
                    const { m } = parseYyyyMm(selectedMonth);
                    setSelectedMonth(`${e.target.value}-${m}`);
                  }}
                  className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 min-w-[5.5rem]"
                  title="Year"
                >
                  {buildExpenseYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeTab === "All" && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                  Month filter
                </span>
                <select
                  value={allTabMonthNum}
                  onChange={(e) => setAllTabMonthNum(e.target.value)}
                  className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 min-w-[7.5rem]"
                  title="Pick month (then year)"
                >
                  <option value="">Month…</option>
                  {MONTH_PICKER_OPTIONS.map((mo) => (
                    <option key={mo.v} value={mo.v}>
                      {mo.label}
                    </option>
                  ))}
                </select>
                <select
                  value={allTabYear}
                  onChange={(e) => setAllTabYear(e.target.value)}
                  className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 min-w-[5.5rem]"
                  title="Pick year"
                >
                  <option value="">Year…</option>
                  {buildExpenseYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                {allTabMonthFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAllTabYear("");
                      setAllTabMonthNum("");
                    }}
                    className="text-xs font-medium text-primary hover:underline px-1"
                  >
                    Clear month
                  </button>
                ) : null}
              </div>
            )}
            {activeTab === "Yearly" && (
              <select
                value={selectedYear || new Date().getFullYear().toString()}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 min-w-[5.5rem]"
                title="Year"
              >
                {buildExpenseYearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-48 lg:w-60 min-w-0"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards - Total Expense = sab pages ki amount ka total (filter ke mutabiq) */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Expense</p>
            <p className="text-2xl font-bold text-foreground">Rs. {totalExpenseAllPages.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">All pages (filter applied)</p>
          </div>
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Expenses Count</p>
            <p className="text-2xl font-bold text-foreground">{pagination.totalItems}</p>
            <p className="text-xs text-muted-foreground mt-1">All records</p>
          </div>
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Avg. Expense</p>
            <p className="text-2xl font-bold text-foreground">
              Rs. {(totalExpenseAllPages / Math.max(pagination.totalItems, 1)).toLocaleString(undefined, { 
                maximumFractionDigits: 0 
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">All records</p>
          </div>
        </div>

        {/* Professional Print Button */}
        <div className="flex flex-wrap justify-end gap-2 mb-4">
          <input
            type="date"
            value={exportStartDate}
            onChange={(e) => setExportStartDate(e.target.value)}
            className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            title="Backup start date"
          />
          <input
            type="date"
            value={exportEndDate}
            onChange={(e) => setExportEndDate(e.target.value)}
            className="bg-cms-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground"
            title="Backup end date"
          />
          <button
            onClick={() => exportExpensesBackup("excel")}
            className="px-4 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Excel Backup
          </button>
          <button
            onClick={() => exportExpensesBackup("word")}
            className="px-4 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Word Backup
          </button>
          <button 
            onClick={() =>
              handleProfessionalPrint(
                expenses,
                pagination.currentPage,
                pagination.totalPages,
                pagination.totalItems,
                calculateTotalExpenses,
                totalExpenseAllPages,
                reportDateLabel,
                pagination.itemsPerPage || 10
              )
            }
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Professional Report
          </button>
        </div>

        {/* Pagination Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            Showing {(pagination.currentPage - 1) * (pagination.itemsPerPage || 10) + 1} to{" "}
            {Math.min(pagination.currentPage * (pagination.itemsPerPage || 10), pagination.totalItems)} of{" "}
            {pagination.totalItems} expenses
          </div>
          <div className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages}
          </div>
        </div>

        {/* Table */}
        <div className="bg-cms-card rounded-xl overflow-hidden">
          {loading && expenses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading expenses...</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No expenses found</p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-2 px-4 py-2 bg-primary text-white rounded-md text-sm"
              >
                Add Your First Expense
              </button>
            </div>
          ) : (
            <>
              {/* Optimistic Updates Indicator */}
              {Object.keys(optimisticUpdates).length > 0 && (
                <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
                  <p className="text-xs text-yellow-800 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                    Saving changes... ({Object.keys(optimisticUpdates).length} item(s))
                  </p>
                </div>
              )}
              
              <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-cms-table-header">
                    <th className="text-center px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium text-foreground">#</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Subject</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Purpose</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Usage</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Responsible</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date & Time</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense, index) => {
                    const isOptimistic = optimisticUpdates[expense._id];
                    const isTemp = expense._id.startsWith('temp-');
                    const serialNumber =
                      (pagination.currentPage - 1) * (pagination.itemsPerPage || 10) + index + 1;
                    const formattedDate = formatDateWithMonthName(expense.date);
                    
                    return (
                      <tr
                        key={expense._id}
                        className={`border-t border-border ${
                          index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'
                        } hover:bg-cms-card-hover transition-colors ${
                          isOptimistic ? 'opacity-80 bg-yellow-50' : ''
                        } ${isTemp ? 'opacity-70 bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground font-medium text-center">
                          {serialNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{expense.subject}</p>
                            </div>
                            {isOptimistic && (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600"></div>
                            )}
                            {isTemp && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">Saving...</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{expense.purpose}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${expense.usage === 'Personal' ? 'bg-primary/20 text-primary' : 'bg-cms-success/20 text-cms-success'}`}>
                            {expense.usage}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground font-medium">
                          Rs. {expense.price}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{expense.personResponsible}</td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{formattedDate}</p>
                              <p className="text-xs text-muted-foreground">{expense.time}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditExpense(expense)}
                              disabled={isTemp || !!isOptimistic}
                              className={`p-1.5 hover:bg-secondary rounded transition-colors ${
                                isTemp || !!isOptimistic 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-blue-600 hover:text-blue-700'
                              }`}
                              title={isTemp || !!isOptimistic ? "Saving... Please wait" : "Edit"}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleViewExpense(expense._id)}
                              disabled={isTemp}
                              className={`p-1.5 hover:bg-secondary rounded transition-colors ${
                                isTemp 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-green-600 hover:text-green-700'
                              }`}
                              title={isTemp ? "Saving... Please wait" : "View Details"}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteExpense(expense._id)}
                              disabled={isTemp || !!isOptimistic}
                              className={`p-1.5 hover:bg-secondary rounded transition-colors ${
                                isTemp || !!isOptimistic 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-red-600 hover:text-red-700'
                              }`}
                              title={isTemp || !!isOptimistic ? "Saving... Please wait" : "Delete"}
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

              {/* Enhanced Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevious}
                    className={`p-1.5 rounded transition-colors ${
                      pagination.hasPrevious
                        ? 'hover:bg-secondary text-foreground'
                        : 'text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  {getPaginationRange().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                          pagination.currentPage === page
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ))}
                  
                  <button 
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNext}
                    className={`p-1.5 rounded transition-colors ${
                      pagination.hasNext
                        ? 'hover:bg-secondary text-foreground'
                        : 'text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add/Edit Expense Dialog */}
        <AddExpenseDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          onSave={handleSaveExpense}
          editData={editExpense as any}
        />
      </div>

      {/* View Expense Modal */}
      {viewExpense && (
        <ExpenseViewModal
          expense={viewExpense}
          onClose={handleViewModalClose}
          onEdit={() => {
            handleViewModalClose();
            handleEditExpense(viewExpense);
          }}
          onDelete={() => {
            handleViewModalClose();
            handleDeleteExpense(viewExpense._id);
          }}
          allExpenses={expenses}
        />
      )}
    </>
  );
}