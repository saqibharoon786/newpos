import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Eye, Trash2, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Calendar, Filter, CheckCircle, XCircle, IndianRupee, FileText, Package, User, Building } from "lucide-react";
import { AddExpenseDialog } from "./AddExpenseDialog";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";

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

// View Modal Component - AssetDetailsView ki tarah design
function ExpenseViewModal({ 
  expense, 
  onClose,
  onEdit,
  onDelete,
  allExpenses // Pass expenses as prop
}: { 
  expense: ExpenseItem | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  allExpenses: ExpenseItem[]; // Add this prop
}) {
  if (!expense) return null;

  // Calculate statistics using the passed allExpenses
  const calculateMonthTotal = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const monthExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      const expenseMonth = expenseDate.getMonth() + 1;
      const expenseYear = expenseDate.getFullYear();
      return expenseMonth === currentMonth && expenseYear === currentYear;
    });
    const total = monthExpenses.reduce((sum, e) => sum + parseFloat(e.price.replace(/,/g, '')), 0);
    return total;
  };

  const calculateYearTotal = () => {
    const currentYear = new Date().getFullYear();
    const yearExpenses = allExpenses.filter(e => {
      const expenseDate = new Date(e.date);
      const expenseYear = expenseDate.getFullYear();
      return expenseYear === currentYear;
    });
    const total = yearExpenses.reduce((sum, e) => sum + parseFloat(e.price.replace(/,/g, '')), 0);
    return total;
  };

  const monthTotal = calculateMonthTotal();
  const yearTotal = calculateYearTotal();

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
                onClick={() => window.print()}
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

        {/* Modal Content - AssetDetailsView ki tarah design */}
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
                  <span className="text-sm text-foreground font-medium">{expense.date}</span>
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
                    {new Date(expense.createdAt).toLocaleDateString()} at {new Date(expense.createdAt).toLocaleTimeString()}
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
  const [activeTab, setActiveTab] = useState("Daily");
  const [filters, setFilters] = useState({
    period: "1 Dec",
    category: "All Categories",
    purpose: "",
    personResponsible: "",
    usage: ""
  });
  const [optimisticUpdates, setOptimisticUpdates] = useState<{[key: string]: ExpenseItem}>({});

  // Fetch expenses from backend
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses/get-all`);
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

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/expenses/stats`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Handle adding/editing expense with OPTIMISTIC UPDATES
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
        response = await axios.put(`${API_BASE_URL}/expenses/${editExpense._id}`, expenseData);
        
        if (response.data.success) {
          // Update with server data (in case server modified something)
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
        response = await axios.post(`${API_BASE_URL}/expenses/create-expense`, expenseData);
        
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
          const originalResponse = await axios.get(`${API_BASE_URL}/expenses/${editExpense._id}`);
          if (originalResponse.data.success) {
            setExpenses(prev => 
              prev.map(expense => 
                expense._id === editExpense._id ? originalResponse.data.data : expense
              )
            );
          }
        } catch (fetchError) {
          // If can't fetch original, refresh all
          fetchExpenses();
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

  // Handle delete expense with OPTIMISTIC UPDATES
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
      await axios.delete(`${API_BASE_URL}/expenses/${id}`);
      
      toast({
        title: "Success",
        description: "Expense deleted successfully",
        action: <CheckCircle className="w-4 h-4 text-green-500" />,
      });
      
      // Update stats in background
      fetchStats();
      
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
      const response = await axios.get(`${API_BASE_URL}/expenses/${id}`);
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

  // Calculate statistics from local data (always up-to-date)
  const calculateTodayExpense = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    return expenses
      .filter(expense => expense.date === today)
      .reduce((total, expense) => total + (parseFloat(expense.price.replace(/,/g, '')) || 0), 0);
  };

  const calculateYesterdayExpense = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    
    return expenses
      .filter(expense => expense.date === yesterdayStr)
      .reduce((total, expense) => total + (parseFloat(expense.price.replace(/,/g, '')) || 0), 0);
  };

  const calculateTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + (parseFloat(expense.price.replace(/,/g, '')) || 0), 0);
  };

  const calculateAvgDailyExpense = () => {
    const total = calculateTotalExpenses();
    const uniqueDays = new Set(expenses.map(e => e.date)).size;
    return uniqueDays > 0 ? total / uniqueDays : 0;
  };

  // Initial data fetch
  useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, []);

  const filteredExpenses = expenses.filter(expense => {
    const searchMatch = searchTerm === "" ||
      expense.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.personResponsible.toLowerCase().includes(searchTerm.toLowerCase());
    
    const purposeMatch = !filters.purpose || expense.purpose === filters.purpose;
    const personMatch = !filters.personResponsible || expense.personResponsible === filters.personResponsible;
    const usageMatch = !filters.usage || expense.usage === filters.usage;
    
    return searchMatch && purposeMatch && personMatch && usageMatch;
  });

  const todayExpense = calculateTodayExpense();
  const yesterdayExpense = calculateYesterdayExpense();
  const avgDailyExpense = calculateAvgDailyExpense();

  return (
    <>
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        {/* Header */}
        <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
          <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Daily Expense <span className="text-muted-foreground">(Roznamcha)</span></h1>
        </div>

        {/* Tabs and Actions Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-cms-card rounded-lg p-1">
            {["Daily", "Weekly", "Monthly"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button className="bg-cms-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Period: {filters.period}
              <ChevronDown className="w-4 h-4" />
            </button>
            <select
              value={filters.purpose}
              onChange={(e) => setFilters({...filters, purpose: e.target.value})}
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
              onChange={(e) => setFilters({...filters, personResponsible: e.target.value})}
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
              onChange={(e) => setFilters({...filters, usage: e.target.value})}
              className="bg-cms-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Usage</option>
              <option value="Personal">Personal</option>
              <option value="Company">Company</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for expense, subject, person"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-80"
            />
          </div>
        </div>

        {/* Stats Cards - Updated INSTANTLY */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Today's Expense</p>
            <p className="text-2xl font-bold text-foreground">Rs. {todayExpense.toLocaleString()}</p>
          </div>
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Yesterday's Expense</p>
            <p className="text-2xl font-bold text-foreground">Rs. {yesterdayExpense.toLocaleString()}</p>
          </div>
          <div className="bg-cms-card rounded-xl p-4">
            <p className="text-sm text-muted-foreground mb-1">Avg. Daily Expense</p>
            <p className="text-2xl font-bold text-foreground">Rs. {avgDailyExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* Print Button */}
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>

        {/* Table - Updates INSTANTLY */}
        <div className="bg-cms-card rounded-xl overflow-hidden">
          {loading && expenses.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading expenses...</p>
            </div>
          ) : filteredExpenses.length === 0 ? (
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
              
              <table className="w-full">
                <thead>
                  <tr className="bg-cms-table-header">
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
                  {filteredExpenses.map((expense, index) => {
                    const isOptimistic = optimisticUpdates[expense._id];
                    const isTemp = expense._id.startsWith('temp-');
                    
                    return (
                      <tr
                        key={expense._id}
                        className={`border-t border-border ${
                          index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'
                        } hover:bg-cms-card-hover transition-colors ${
                          isOptimistic ? 'opacity-80 bg-yellow-50' : ''
                        } ${isTemp ? 'opacity-70 bg-blue-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{expense.subject}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                {expense.description}
                              </p>
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
                          <div>
                            <p>{expense.date}</p>
                            <p className="text-xs text-muted-foreground">{expense.time}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditExpense(expense)}
                              disabled={isTemp || isOptimistic}
                              className={`p-1.5 hover:bg-secondary rounded transition-colors ${
                                isTemp || isOptimistic 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-blue-600 hover:text-blue-700'
                              }`}
                              title={isTemp || isOptimistic ? "Saving... Please wait" : "Edit"}
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
                              disabled={isTemp || isOptimistic}
                              className={`p-1.5 hover:bg-secondary rounded transition-colors ${
                                isTemp || isOptimistic 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-red-600 hover:text-red-700'
                              }`}
                              title={isTemp || isOptimistic ? "Saving... Please wait" : "Delete"}
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

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
                <button className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 bg-primary text-primary-foreground rounded-md text-sm font-medium">1</button>
                <button className="w-8 h-8 hover:bg-secondary text-muted-foreground rounded-md text-sm font-medium transition-colors">2</button>
                <button className="w-8 h-8 hover:bg-secondary text-muted-foreground rounded-md text-sm font-medium transition-colors">3</button>
                <span className="text-muted-foreground px-2">.....</span>
                <button className="w-8 h-8 hover:bg-secondary text-muted-foreground rounded-md text-sm font-medium transition-colors">10</button>
                <button className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Expense Dialog */}
        <AddExpenseDialog
          open={dialogOpen}
          onOpenChange={handleDialogClose}
          onSave={handleSaveExpense}
          editData={editExpense}
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
          allExpenses={expenses} // Pass expenses as prop
        />
      )}
    </>
  );
}