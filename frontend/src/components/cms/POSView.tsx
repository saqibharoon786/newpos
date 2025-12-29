import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2 } from "lucide-react";
import { AddSaleDialog } from "./AddSaleDialog";
import { SaleDetailsView } from "./SaleDetailsView";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance with environment variable as base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Define endpoints using environment variable
const SALES_API_URL = `${API_BASE_URL}/api/sales`;
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;

interface Sale {
  _id: string;
  materialName: string;
  supplierName: string;
  invoiceNo: string;
  weight: string;
  unit: string;
  purchaseDate: string;
  branch: string;
  materialColor: string;
  actualPrice: string;
  productionCost: string;
  sellingPrice: string;
  discount: string;
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerCnic: string;
  buyerCompany: string;
  finalAmount: string;
  
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
}

export function POSView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

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
      } else {
        throw new Error(salesResponse.data.message || 'Failed to fetch sales');
      }
    } catch (error: any) {
      console.error('Error fetching sales:', error);
      setError(error.response?.data?.message || error.message || 'Failed to fetch sales');
      toast({
        title: "Error",
        description: "Failed to load sales. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Alternative: Fetch enriched sales data (if your backend supports it)
  const fetchEnrichedSales = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch sales with vehicle details included
      // Modify this endpoint according to your backend
      const response = await api.get(`${SALES_API_URL}/with-vehicles`);
      
      if (response.data.success) {
        setSales(response.data.data || []);
      } else {
        // Fallback to regular sales fetch
        const regularResponse = await api.get(SALES_API_URL);
        if (regularResponse.data.success) {
          setSales(regularResponse.data.data || []);
        } else {
          throw new Error(regularResponse.data.message || 'Failed to fetch sales');
        }
      }
    } catch (error: any) {
      console.error('Error fetching enriched sales:', error);
      // Fallback to regular fetch
      const regularResponse = await api.get(SALES_API_URL);
      if (regularResponse.data.success) {
        setSales(regularResponse.data.data || []);
      } else {
        setError(error.response?.data?.message || error.message || 'Failed to fetch sales');
        toast({
          title: "Error",
          description: "Failed to load sales. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSale = async () => {
    await fetchSales(); // Refresh the list
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

  // Filter sales based on search term
  const filteredSales = sales.filter(sale => {
    const searchLower = searchTerm.toLowerCase();
    return (
      sale.materialName.toLowerCase().includes(searchLower) ||
      sale.supplierName.toLowerCase().includes(searchLower) ||
      sale.invoiceNo.toLowerCase().includes(searchLower) ||
      sale.buyerName.toLowerCase().includes(searchLower) ||
      (sale.vehicleNumber && sale.vehicleNumber.toLowerCase().includes(searchLower)) ||
      (sale.buyerPhone && sale.buyerPhone.toLowerCase().includes(searchLower)) ||
      (sale.buyerEmail && sale.buyerEmail.toLowerCase().includes(searchLower))
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
  const formatCurrency = (amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return '0';
      return numAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } catch (error) {
      return amount;
    }
  };

  // Format weight with unit
  const formatWeightWithUnit = (sale: Sale) => {
    const weight = sale.weight || '0';
    const unit = sale.unit || '0';
    return `${weight} (${unit} units)`;
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
    <div className="flex-1 p-6 overflow-auto">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Point Of Sale (POS)</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-semibold text-foreground">{sales.length}</p>
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
                {sales.reduce((total, s) => total + (parseFloat(s.finalAmount || s.sellingPrice) || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <span className="text-green-500 text-lg font-bold">V</span>
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Units Sold</p>
              <p className="text-2xl font-semibold text-foreground">
                {sales.reduce((total, s) => total + (parseInt(s.unit) || 0), 0).toLocaleString()} units
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <div className="text-blue-500 text-lg font-bold">#</div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sales..."
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
            <table className="w-full">
              <thead>
                <tr className="bg-cms-table-header">
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Invoice No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Buyer</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Weight & Units</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vehicle No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((sale, index) => (
                  <tr
                    key={sale._id}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'} hover:bg-cms-card-hover transition-colors`}
                  >
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
                      <span className="text-sm font-medium text-foreground">{sale.invoiceNo || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{sale.buyerName || 'N/A'}</span>
                        {sale.buyerPhone && (
                          <span className="text-xs text-muted-foreground">{sale.buyerPhone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{sale.weight || '0'}</span>
                        <span className="text-xs text-muted-foreground">{sale.unit || '0'} units</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{formatCurrency(sale.finalAmount || sale.sellingPrice)}</span>
                        <span className="text-xs text-muted-foreground">
                          {parseFloat(sale.sellingPrice || '0').toLocaleString()} each
                        </span>
                      </div>
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
                ))}
              </tbody>
            </table>

            {/* Pagination */}
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

      {/* Add/Edit Dialog */}
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