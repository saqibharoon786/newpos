import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Wallet, Smartphone, Building, Edit, Trash2, Plus, Download, Search, X, Printer, BanknoteIcon, DollarSign, Clock, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from "sonner";
import axios from 'axios';

// ==================== API CONFIGURATION ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const createAPI = () => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  // instance.interceptors.request.use(      
  //   (config) => {
  //     if (config.url && !config.url.startsWith('/api/')) {    
  //       config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url} ;
  //     }
      
  //     return config;
  //   },
  //   (error) => {
  //     return Promise.reject(error);
  //   }
  // );

  return instance;
};

const API = createAPI();

interface Transaction {
  _id: string;
  id: string;
  date: string;
  type: 'deposit' | 'withdraw';
  method: string;
  fromTo: string;
  amount: number;
  fee: number;
  net: number;
  status: string;
  description: string;
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Balances {
  drawer: number;
  easypaisa: number;
  jazzcash: number;
  bank: number;
}

interface FinanceStats {
  totalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  depositCount: number;
  withdrawalCount: number;
  trend: number;
  transactionCount: number;
  formattedTotalBalance: string;
  formattedTotalDeposits: string;
  formattedTotalWithdrawals: string;
}

export default function FinanceModule() {
  // State for balances
  const [balances, setBalances] = useState<Balances>({
    drawer: 0,
    easypaisa: 0,
    jazzcash: 0,
    bank: 0,
  });

  // State for transaction history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState({
    transactions: false,
    balances: false,
    deposit: false,
    withdraw: false,
    export: false,
    initial: true
  });

  // State for form inputs
  const [depositData, setDepositData] = useState({
    method: 'drawer',
    amount: '',
    description: '',
    reference: ''
  });

  const [withdrawData, setWithdrawData] = useState({
    method: 'drawer',
    amount: '',
    description: '',
    reference: ''
  });

  // State for editing
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });

  // ==================== HELPER FUNCTIONS ====================
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getMethodLabel = (method: string | undefined | null) => {
    if (!method) return 'Unknown';
    
    const labels: Record<string, string> = {
      drawer: 'Cash Drawer',
      easypaisa: 'Easypaisa',
      jazzcash: 'JazzCash',
      bank: 'Bank Account',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      online: 'Online Payment',
    };
    return labels[method.toLowerCase()] || method;
  };

  const getMethodIcon = (method: string, className = "h-4 w-4") => {
    if (!method) return <Wallet className={className} />;
    
    const m = method.toLowerCase().replace(' ', '');
    switch (m) {
      case 'drawer':
      case 'cashdrawer':
      case 'cash':
        return <Wallet className={className} />;
      case 'easypaisa':
      case 'jazzcash':
        return <Smartphone className={className} />;
      case 'bank':
      case 'bankaccount':
      case 'bank_transfer':
      case 'cheque':
      case 'online':
        return <Building className={className} />;
      default:
        return <Wallet className={className} />;
    }
  };

  // Format date to show: Date MonthName Year
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Try to parse if it's in a different format
        const parts = dateString.split(/[/\s-:]/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const year = parseInt(parts[2]);
          const testDate = new Date(year, month, day);
          if (!isNaN(testDate.getTime())) {
            return formatDateProper(testDate);
          }
        }
        return 'Invalid Date';
      }
      
      return formatDateProper(date);
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  const formatDateProper = (date: Date): string => {
    const day = date.getDate();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  // Format time to show: HH:MM AM/PM
  const formatTime = (dateString: string | undefined): string => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      hours = hours % 12;
      hours = hours ? hours : 12; // Convert 0 to 12
      
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      
      return `${hours}:${minutesStr} ${ampm}`;
    } catch (error) {
      console.error('Error formatting time:', dateString, error);
      return '';
    }
  };

  const filterTransactions = useCallback(() => {
    const filtered = transactions.filter(transaction => {
      const matchesSearch =
        transaction.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.fromTo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.amount.toString().includes(searchQuery) ||
        transaction.method?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = filterType === 'all' || transaction.type === filterType;

      return matchesSearch && matchesType;
    });
    
    setFilteredTransactions(filtered);
  }, [transactions, searchQuery, filterType]);

  // Calculate total balance from balances
  const totalBalance = Object.values(balances).reduce((sum, balance) => sum + balance, 0);

  // Calculate stats from transactions
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdraw')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const depositCount = transactions.filter(t => t.type === 'deposit').length;
  const withdrawalCount = transactions.filter(t => t.type === 'withdraw').length;

  // Calculate trend
  const calculateTrend = () => {
    if (transactions.length === 0) return 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = transactions.filter(t => {
      try {
        const transactionDate = new Date(t.date);
        return transactionDate >= thirtyDaysAgo;
      } catch {
        return false;
      }
    });
    
    const recentDeposits = recentTransactions.filter(t => t.type === 'deposit').length;
    const recentWithdrawals = recentTransactions.filter(t => t.type === 'withdraw').length;
    
    if (recentDeposits === 0 && recentWithdrawals === 0) return 0;
    
    return ((recentDeposits - recentWithdrawals) / (recentDeposits + recentWithdrawals)) * 100;
  };

  const trend = calculateTrend();

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, searchQuery, filterType]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

  }, [selectedMonth]);

  // ==================== API FUNCTIONS ====================
  const fetchInitialData = async () => {
    try {
      setLoading(prev => ({ ...prev, initial: true }));
      await Promise.all([fetchBalances(), fetchTransactions()]);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);
      toast.error('Failed to load finance data');
    } finally {
      setLoading(prev => ({ ...prev, initial: false }));
    }
  };

  const fetchTransactions = async (page = 1) => {
    setLoading(prev => ({ ...prev, transactions: true }));
    try {
      const params: any = {
        page,
        limit: pagination.limit
      };

      if (searchQuery) params.search = searchQuery;
      if (filterType !== 'all') params.type = filterType;

      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999).toISOString();
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const response = await API.get('/finance/transactions', { params });
      
      if (response.data.success) {
        const transactionsData = (response.data.transactions || []).map((transaction: any) => ({
          ...transaction,
          id: transaction._id || transaction.id,
          fromTo: getMethodLabel(transaction.method),
          // Ensure date is properly formatted
          date: formatDate(transaction.date || transaction.createdAt)
        }));
        
        setTransactions(transactionsData);
        
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        console.error('API response error:', response.data);
        toast.error(response.data.message || 'Failed to fetch transactions');
      }
    } catch (error: any) {
      console.error('Get transactions error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error fetching transactions';
      toast.error(errorMsg);
    } finally {
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  };

  const fetchBalances = async () => {
    setLoading(prev => ({ ...prev, balances: true }));
    try {
      const response = await API.get('/finance/balances');
      
      if (response.data.success) {
        const balancesData = response.data.balances || {
          drawer: 0,
          easypaisa: 0,
          jazzcash: 0,
          bank: 0,
        };
        setBalances(balancesData);
      } else {
        console.error('API response error:', response.data);
        toast.error(response.data.message || 'Failed to fetch balances');
      }
    } catch (error: any) {
      console.error('Get balances error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error fetching balances';
      toast.error(errorMsg);
    } finally {
      setLoading(prev => ({ ...prev, balances: false }));
    }
  };

  const createDeposit = async (data: any) => {
    try {
      setLoading(prev => ({ ...prev, deposit: true }));
      console.log('Sending deposit data:', data);
      
      const response = await API.post('/finance/deposit', {
        method: data.method,
        amount: parseFloat(data.amount),
        description: data.description || 'Deposit',
        reference: data.reference
      });
      
      console.log('Deposit response:', response.data);
      
      if (response.data.success) {
        toast.success(`Deposited ${formatCurrency(data.amount)} successfully`);
        
        // Update balances
        if (response.data.balances) {
          setBalances(response.data.balances);
        }
        
        // Add transaction to list
        if (response.data.transaction) {
          const newTransaction = {
            ...response.data.transaction,
            id: response.data.transaction._id || response.data.transaction.id,
            fromTo: getMethodLabel(response.data.transaction.method),
            date: formatDate(response.data.transaction.date || response.data.transaction.createdAt)
          };
          setTransactions(prev => [newTransaction, ...prev]);
        }
        
        // Reset form
        setDepositData({
          method: 'drawer',
          amount: '',
          description: '',
          reference: ''
        });
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Deposit failed');
      }
    } catch (error: any) {
      console.error('Create deposit error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Error creating deposit';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = 'Bad request. Please check your input.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, deposit: false }));
    }
  };

  const createWithdrawal = async (data: any) => {
    try {
      setLoading(prev => ({ ...prev, withdraw: true }));
      console.log('Sending withdrawal data:', data);
      
      const response = await API.post('/finance/withdraw', {
        method: data.method,
        amount: parseFloat(data.amount),
        description: data.description || 'Withdrawal',
        reference: data.reference
      });
      
      console.log('Withdrawal response:', response.data);
      
      if (response.data.success) {
        toast.success(`Withdrew ${formatCurrency(data.amount)} successfully`);
        
        // Update balances
        if (response.data.balances) {
          setBalances(response.data.balances);
        }
        
        // Add transaction to list
        if (response.data.transaction) {
          const newTransaction = {
            ...response.data.transaction,
            id: response.data.transaction._id || response.data.transaction.id,
            fromTo: getMethodLabel(response.data.transaction.method),
            date: formatDate(response.data.transaction.date || response.data.transaction.createdAt)
          };
          setTransactions(prev => [newTransaction, ...prev]);
        }
        
        // Reset form
        setWithdrawData({
          method: 'drawer',
          amount: '',
          description: '',
          reference: ''
        });
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Withdrawal failed');
      }
    } catch (error: any) {
      console.error('Create withdrawal error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = 'Error creating withdrawal';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Insufficient balance or invalid input.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, withdraw: false }));
    }
  };

  const updateTransaction = async (id: string, data: any) => {
    try {
      console.log('Updating transaction:', id, data);
      
      const response = await API.put(`/finance/transactions/${id}`, {
        description: data.description,
        amount: parseFloat(data.amount)
      });
      
      console.log('Update response:', response.data);
      
      if (response.data.success) {
        toast.success("Transaction updated successfully");
        
        // Update transaction in list
        if (response.data.transaction) {
          const updatedTransaction = {
            ...response.data.transaction,
            id: response.data.transaction._id || response.data.transaction.id,
            fromTo: getMethodLabel(response.data.transaction.method),
            date: formatDate(response.data.transaction.date || response.data.transaction.createdAt)
          };
          
          setTransactions(prev => prev.map(t =>
            t.id === id ? updatedTransaction : t
          ));
        }
        
        // Update balances if changed
        if (response.data.balances) {
          setBalances(response.data.balances);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Update failed');
      }
    } catch (error: any) {
      console.error('Update transaction error:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      console.log('Deleting transaction:', id);
      
      const response = await API.delete(`/finance/transactions/${id}`);
      
      console.log('Delete response:', response.data);
      
      if (response.data.success) {
        toast.success("Transaction deleted successfully");
        
        // Remove transaction from list
        setTransactions(prev => prev.filter(t => t.id !== id));
        
        // Update balances
        if (response.data.balances) {
          setBalances(response.data.balances);
        }
        
        return response.data;
      } else {
        throw new Error(response.data.message || 'Delete failed');
      }
    } catch (error: any) {
      console.error('Delete transaction error:', error);
      console.error('Error details:', error.response?.data);
      throw error;
    }
  };

  const exportTransactions = async () => {
    try {
      setLoading(prev => ({ ...prev, export: true }));
      const response = await API.get('/finance/export', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Transactions exported successfully");
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.response?.data?.message || 'Error exporting transactions');
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  // ==================== EVENT HANDLERS ====================
  const handleDeposit = async () => {
    const amount = parseFloat(depositData.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await createDeposit({
        method: depositData.method,
        amount: amount,
        description: depositData.description || 'Deposit',
        reference: depositData.reference
      });
    } catch (error: any) {
      toast.error(error.message || 'Error creating deposit');
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawData.amount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await createWithdrawal({
        method: withdrawData.method,
        amount: amount,
        description: withdrawData.description || 'Withdrawal',
        reference: withdrawData.reference
      });
    } catch (error: any) {
      toast.error(error.message || 'Error creating withdrawal');
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
  };

  const handleUpdateTransaction = async () => {
    if (!editTransaction) return;

    try {
      await updateTransaction(editTransaction.id, {
        description: editTransaction.description,
        amount: editTransaction.amount
      });
      setEditTransaction(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error updating transaction');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await deleteTransaction(id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error deleting transaction');
    }
  };

  const handleSearch = useCallback(() => {
    fetchTransactions(1);
  }, [searchQuery, filterType, selectedMonth]);

  const handlePrintReceipt = (transaction: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print receipt");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transaction Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f8fafc; }
          .receipt { max-width: 300px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 5px; color: #1e293b; }
          .subtitle { font-size: 12px; color: #64748b; }
          .info { margin: 15px 0; }
          .label { font-weight: 600; color: #64748b; font-size: 12px; }
          .value { font-size: 14px; color: #1e293b; margin-top: 4px; }
          .total { font-size: 18px; font-weight: bold; margin-top: 20px; padding-top: 10px; border-top: 2px dashed #e2e8f0; color: #10b981; }
          .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="title">FINANCE RECEIPT</div>
            <div class="subtitle">Transaction: ${transaction.type.toUpperCase()}</div>
          </div>
          <div class="info">
            <div class="label">Date:</div>
            <div class="value">${transaction.date}</div>
          </div>
          <div class="info">
            <div class="label">Method:</div>
            <div class="value">${transaction.fromTo}</div>
          </div>
          <div class="info">
            <div class="label">Description:</div>
            <div class="value">${transaction.description || 'N/A'}</div>
          </div>
          <div class="info">
            <div class="label">Amount:</div>
            <div class="value">${formatCurrency(transaction.amount)}</div>
          </div>
          <div class="total">
            Net Amount: ${formatCurrency(transaction.net)}
          </div>
          <div class="footer">
            Thank you for your transaction<br>
            Generated: ${new Date().toLocaleString()}
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.pages) return;
    fetchTransactions(newPage);
  };

  // ==================== RENDER ====================
  if (loading.initial) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Finance Module...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background min-w-0">
      {/* Header Section */}
      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-5 bg-card border-b border-border">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 flex-shrink-0">
                <BanknoteIcon className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Finance Management</h1>
                <p className="text-sm text-muted-foreground">Total Balance: <span className="text-primary font-semibold">{formatCurrency(totalBalance)}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={exportTransactions}
                disabled={transactions.length === 0 || loading.export}
              >
                {loading.export ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 py-4 sm:py-6 overflow-x-hidden">
        <div className="max-w-screen-2xl mx-auto space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { 
                label: "Total Balance", 
                value: formatCurrency(totalBalance), 
                icon: DollarSign, 
                trend: trend > 0 ? `+${Math.abs(trend).toFixed(0)}%` : `${trend.toFixed(0)}%`, 
                up: trend >= 0 
              },
              { 
                label: "Total Deposits", 
                value: formatCurrency(totalDeposits), 
                icon: TrendingUp, 
                trend: `${depositCount} txn`, 
                up: true 
              },
              { 
                label: "Total Withdrawals", 
                value: formatCurrency(totalWithdrawals), 
                icon: TrendingDown, 
                trend: `${withdrawalCount} txn`, 
                up: false 
              },
              { 
                label: "Active Methods", 
                value: Object.entries(balances).filter(([_, amount]) => amount > 0).length.toString(), 
                icon: Clock, 
                trend: "Total 4", 
                up: true 
              },
            ].map((stat, index) => (
              <Card key={index} className="bg-card border-border hover:border-primary/30 transition-all duration-300">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      <div className={`flex items-center gap-1 mt-2 text-xs ${stat.up ? 'text-success' : 'text-destructive'}`}>
                        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {stat.trend}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Balance Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(balances).map(([method, amount]) => (
              <Card key={method} className="bg-card border-border hover:border-primary/40 transition-all duration-300 group">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      {getMethodIcon(method, "w-5 h-5 text-primary")}
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{getMethodLabel(method)}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(amount)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search and Actions */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by method, description, or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-12 pr-10 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
              {searchQuery && (
                <X
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
                  onClick={() => {
                    setSearchQuery('');
                    handleSearch();
                  }}
                />
              )}
            </div>
            <div className="w-auto">
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-card border-border text-foreground w-full sm:w-[160px]"
                disabled={loading.transactions}
              />
            </div>
            <Select 
              value={filterType} 
              onValueChange={(value) => {
                setFilterType(value);
                fetchTransactions(1);
              }}
              disabled={loading.transactions}
            >
              <SelectTrigger className="w-40 bg-card border-border">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdraw">Withdrawals</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleSearch}
              disabled={loading.transactions}
              className="border-border"
            >
              {loading.transactions ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Transaction Forms */}
            <div className="lg:col-span-1 space-y-4">
              {/* Deposit Card */}
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="bg-success/10 border-b border-success/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground text-lg">Deposit Funds</CardTitle>
                      <CardDescription className="text-muted-foreground text-xs">Add money to account</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Deposit To</Label>
                    <Select
                      value={depositData.method}
                      onValueChange={(value) => setDepositData({ ...depositData, method: value })}
                      disabled={loading.deposit}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="drawer">Cash Drawer</SelectItem>
                        <SelectItem value="easypaisa">Easypaisa</SelectItem>
                        <SelectItem value="jazzcash">JazzCash</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Amount (PKR)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={depositData.amount}
                      onChange={(e) => setDepositData({ ...depositData, amount: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.deposit}
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Description</Label>
                    <Input
                      placeholder="Optional description"
                      value={depositData.description}
                      onChange={(e) => setDepositData({ ...depositData, description: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.deposit}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Reference (Bank ID / Cheque No)</Label>
                    <Input
                      placeholder="Optional reference"
                      value={depositData.reference}
                      onChange={(e) => setDepositData({ ...depositData, reference: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.deposit}
                    />
                  </div>

                  <Button
                    onClick={handleDeposit}
                    className="w-full bg-success hover:bg-success/90 text-success-foreground font-semibold"
                    disabled={!depositData.amount || parseFloat(depositData.amount) <= 0 || loading.deposit}
                  >
                    {loading.deposit ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Deposit Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Withdraw Card */}
              <Card className="bg-card border-border overflow-hidden">
                <CardHeader className="bg-warning/10 border-b border-warning/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground text-lg">Withdraw Funds</CardTitle>
                      <CardDescription className="text-muted-foreground text-xs">Get money from account</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Withdraw From</Label>
                    <Select
                      value={withdrawData.method}
                      onValueChange={(value) => setWithdrawData({ ...withdrawData, method: value })}
                      disabled={loading.withdraw}
                    >
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="drawer">Cash Drawer</SelectItem>
                        <SelectItem value="easypaisa">Easypaisa</SelectItem>
                        <SelectItem value="jazzcash">JazzCash</SelectItem>
                        <SelectItem value="bank">Bank Account</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Amount (PKR)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawData.amount}
                      onChange={(e) => setWithdrawData({ ...withdrawData, amount: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.withdraw}
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Description</Label>
                    <Input
                      placeholder="Optional description"
                      value={withdrawData.description}
                      onChange={(e) => setWithdrawData({ ...withdrawData, description: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.withdraw}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground text-sm">Reference (Bank ID / Cheque No)</Label>
                    <Input
                      placeholder="Optional reference"
                      value={withdrawData.reference}
                      onChange={(e) => setWithdrawData({ ...withdrawData, reference: e.target.value })}
                      className="bg-secondary border-border text-foreground"
                      disabled={loading.withdraw}
                    />
                  </div>

                  {withdrawData.amount && parseFloat(withdrawData.amount) > 0 && (
                    <div className="space-y-2 rounded-xl p-4 bg-secondary/50 border border-border">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-semibold text-foreground">{formatCurrency(parseFloat(withdrawData.amount))}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Fee:</span>
                        <span className="text-muted-foreground">Rs. 0</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-sm font-medium text-foreground">You'll Receive:</span>
                        <span className="font-bold text-primary">{formatCurrency(parseFloat(withdrawData.amount))}</span>
                      </div>
                    </div>
                  )}

                  <Alert className="bg-primary/10 border-primary/30">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-primary text-xs">
                      No withdrawal fees. Full amount received.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleWithdraw}
                    className="w-full bg-warning hover:bg-warning/90 text-warning-foreground font-semibold"
                    disabled={!withdrawData.amount || parseFloat(withdrawData.amount) <= 0 || loading.withdraw}
                  >
                    {loading.withdraw ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Withdraw Now
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Transaction History */}
            <div className="lg:col-span-2">
              <Card className="bg-card border-border h-full">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-foreground text-lg">Transaction History</CardTitle>
                    <Badge variant="outline" className="text-muted-foreground border-border">
                      {loading.transactions ? 'Loading...' : `${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'record' : 'records'}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    {loading.transactions ? (
                      <div className="text-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading transactions...</p>
                      </div>
                    ) : transactions.length > 0 ? (
                      <>
                        <table className="w-full">
                          <thead>
                            <tr className="bg-secondary/50 border-b border-border">
                              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                              <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredTransactions.map((transaction) => (
                              <tr key={transaction.id} className="hover:bg-secondary/30 transition-colors">
                                <td className="py-4 px-4">
                                  <div className="text-sm font-medium text-foreground">
                                    {transaction.date}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatTime(transaction.createdAt)}
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <Badge className={`${transaction.type === 'deposit' ? 'bg-success/20 text-success border-success/30' : 'bg-destructive/20 text-destructive border-destructive/30'} border`}>
                                    {transaction.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                                  </Badge>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                                      {getMethodIcon(transaction.method, "w-4 h-4 text-primary")}
                                    </div>
                                    <span className="text-sm text-foreground">{transaction.fromTo || getMethodLabel(transaction.method)}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className={`font-bold ${transaction.type === 'deposit' ? 'text-success' : 'text-destructive'}`}>
                                    {transaction.type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                  </div>
                                  {transaction.description && (
                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                      {transaction.description}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handlePrintReceipt(transaction)}
                                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                      title="Print receipt"
                                      disabled={loading.transactions}
                                    >
                                      <Printer className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                    </button>
                                    <button
                                      onClick={() => handleEdit(transaction)}
                                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                                      title="Edit"
                                      disabled={loading.transactions}
                                    >
                                      <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteTransaction(transaction.id)}
                                      className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                                      title="Delete"
                                      disabled={loading.transactions}
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                          <div className="bg-secondary/30 border-t border-border px-4 py-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground">
                                Showing {filteredTransactions.length} of {pagination.total} transaction{pagination.total !== 1 ? 's' : ''}
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handlePageChange(pagination.page - 1)}
                                  disabled={pagination.page === 1 || loading.transactions}
                                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Previous
                                </button>
                                <span className="px-3 py-1.5 text-sm text-foreground bg-primary/20 rounded-lg">
                                  {pagination.page} / {pagination.pages}
                                </span>
                                <button
                                  onClick={() => handlePageChange(pagination.page + 1)}
                                  disabled={pagination.page === pagination.pages || loading.transactions}
                                  className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
                          <BanknoteIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground mb-2">No transactions yet</p>
                        <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
                          Make your first deposit or withdrawal to see transaction history here
                        </p>
                      </div>
                    )}

                    {!loading.transactions && transactions.length > 0 && filteredTransactions.length === 0 && searchQuery && (
                      <div className="text-center py-12">
                        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground mb-2">No transactions found for "{searchQuery}"</p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            handleSearch();
                          }}
                          className="text-sm text-primary hover:underline"
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      <Dialog open={!!editTransaction} onOpenChange={(open) => !open && setEditTransaction(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Edit Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {editTransaction && (
              <>
                <div className="space-y-2">
                  <Label className="text-foreground">Description</Label>
                  <Input
                    value={editTransaction.description || ''}
                    onChange={(e) => setEditTransaction(prev => prev ? { ...prev, description: e.target.value } : null)}
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Amount (PKR)</Label>
                  <Input
                    type="number"
                    value={editTransaction.amount || ''}
                    onChange={(e) => setEditTransaction(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)}
                    className="bg-secondary border-border text-foreground"
                    min="0"
                    step="1"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleUpdateTransaction}
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Update
                  </Button>
                  <Button
                    onClick={() => setEditTransaction(null)}
                    variant="outline"
                    className="flex-1 border-border text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}