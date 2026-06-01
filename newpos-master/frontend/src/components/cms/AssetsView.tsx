import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Eye, Trash2, ChevronLeft, ChevronRight, Filter, Package, Loader2, Save, Calendar, Clock, ChevronDown } from "lucide-react";
import { AddAssetDialog } from "./AddAssetDialog";
import { AssetDetailsView } from "./AssetDetailsView";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import api from "@/lib/api";
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from "@/lib/exportUtils";

const ASSETS_API = "/api/assets";

interface AssetItem {
  _id: string;
  assetName: string;
  category: string;
  condition: string;
  purchasePrice?: number;
  assignedTo: string;
  purchaseDate: string;
  purchaseTime?: string;
  sizeModel?: string;
  description?: string;
  department: string;
  purchaseFrom?: string;
  invoiceNo?: string;
  status?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

// Helper function to format date as "22 Jan 2026"
const formatDateWithMonthName = (dateString: string): string => {
  try {
    // First try to parse as ISO date string
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = getMonthName(date.getMonth() + 1);
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    }
    
    // Try to parse as DD/MM/YYYY format
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/').map(Number);
      if (day && month && year) {
        return `${day.toString().padStart(2, '0')} ${getMonthName(month)} ${year}`;
      }
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

export function AssetsView() {
  const [data, setData] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<AssetItem>>({});
  const [updating, setUpdating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [financeBalances, setFinanceBalances] = useState<{
    drawer: number;
    easypaisa: number;
    jazzcash: number;
    bank: number;
  } | null>(null);
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalValue: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await api.get(`${ASSETS_API}/get-all`);
      const result = response.data;
      if (result.success) {
        setData(result.data || []);
      } else {
        throw new Error(result.error || result.message || "Failed to fetch assets");
      }
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await api.get(`${ASSETS_API}/stats`);
      const result = response.data;
      if (result.success) {
        setStats({
          totalAssets: result.data.overview?.totalAssets || data.length,
          totalValue: result.data.overview?.totalValue || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  // Initialize data
  useEffect(() => {
    fetchAssets();
    const loadFinance = () => {
      api
        .get("/api/finance/balances")
        .then((r) => {
          if (r.data?.success && r.data.balances) {
            setFinanceBalances({
              drawer: Number(r.data.balances.drawer) || 0,
              easypaisa: Number(r.data.balances.easypaisa) || 0,
              jazzcash: Number(r.data.balances.jazzcash) || 0,
              bank: Number(r.data.balances.bank) || 0,
            });
          }
        })
        .catch(() => {});
    };
    loadFinance();
  }, []);

  const exportAssets = (format: "csv" | "excel" | "pdf") => {
    const headers = ["Name", "Category", "Price", "Department", "Purchase Date", "Invoice"];
    const rows = filteredData.map((a) => ({
      Name: a.assetName,
      Category: a.category,
      Price: a.purchasePrice ?? 0,
      Department: a.department,
      "Purchase Date": formatDateWithMonthName(a.purchaseDate),
      Invoice: a.invoiceNo || "",
    }));
    const name = `Assets_${Date.now()}`;
    if (format === "csv") exportAsCsv(`${name}.csv`, headers, rows);
    else if (format === "excel") exportAsExcelTable(`${name}.xls`, "Assets", headers, rows);
    else {
      const body = rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r]}</td>`).join("")}</tr>`).join("");
      exportAsPdf("Assets", `<table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`);
    }
    toast({ title: "Export complete" });
  };

  useEffect(() => {
    if (data.length > 0) {
      fetchStats();
    }
  }, [data]);

  // ✅ FIXED: Handle date format conversion
const handleAddAsset = async (assetData: any) => {
  try {
    setAdding(true);
    
    console.log("📤 Received data from dialog:", assetData);
    console.log("📤 Is it FormData?", assetData instanceof FormData);
    
    if (assetData instanceof FormData) {
      // Debug: Log FormData contents
      console.log("=== DEBUG: FormData Contents ===");
      let hasFile = false;
      
      for (let [key, value] of assetData.entries()) {
        console.log(`${key}:`, value instanceof File ? `File (${value.name}, ${value.type}, ${value.size} bytes)` : value);
        if (key === 'receiptImage' && value instanceof File) {
          hasFile = true;
          console.log("✅ File found in FormData!");
        }
      }
      console.log("=== END DEBUG ===");

      // Send FormData to backend
      const response = await api.post(`${ASSETS_API}/create-assets`, assetData);
      const result = response.data;

      if (result.success) {
        console.log("✅ Success! Created asset:", result.data);
        
        toast({
          title: "✅ Asset Added",
          description: `${result.data.assetName} has been added successfully.`,
        });
        
        await fetchAssets();
        api.get("/api/finance/balances").then((r) => {
          if (r.data?.success && r.data.balances) {
            setFinanceBalances({
              drawer: Number(r.data.balances.drawer) || 0,
              easypaisa: Number(r.data.balances.easypaisa) || 0,
              jazzcash: Number(r.data.balances.jazzcash) || 0,
              bank: Number(r.data.balances.bank) || 0,
            });
          }
        });
        setDialogOpen(false);
      } else {
        console.error("❌ Backend error response:", result);
        
        // ✅ FIXED: Create a proper Error object with string message
        let errorMsg = "Failed to create asset";
        if (result.error) {
          errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        } else if (result.message) {
          errorMsg = typeof result.message === 'string' ? result.message : JSON.stringify(result.message);
        } else {
          errorMsg = `Server error`;
        }
        
        const error = new Error(errorMsg);
        (error as any).response = result;
        (error as any).status = response.status;
        throw error;
      }
    } else {
      console.error("❌ Expected FormData but got:", typeof assetData);
      throw new Error("Invalid data format: Expected FormData");
    }
  } catch (error: any) {
    console.error("❌ Full error in handleAddAsset:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      originalError: error
    });
    
    // ✅ FIXED: Extract error message properly
    let errorMessage = "Failed to add asset";
    
    if (error && error.message) {
      if (typeof error.message === 'string') {
        errorMessage = error.message;
      } else {
        // If message is an object, stringify it
        try {
          errorMessage = JSON.stringify(error.message);
        } catch {
          errorMessage = "Unknown error occurred";
        }
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = "Unknown error occurred";
      }
    }
    
    toast({
      title: "❌ Error",
      description: errorMessage,
      variant: "destructive",
    });
    
    // ✅ FIXED: Re-throw a proper Error object with string message
    throw new Error(errorMessage);
  } finally {
    setAdding(false);
  }
};

  // Start editing an asset
  const handleEditStart = (asset: AssetItem) => {
    setEditingAsset(asset);
    setEditForm({
      assetName: asset.assetName,
      category: asset.category,
      condition: asset.condition,
      purchasePrice: asset.purchasePrice,
      assignedTo: asset.assignedTo,
      department: asset.department,
      quantity: asset.quantity,
      sizeModel: asset.sizeModel,
      description: asset.description,
      purchaseFrom: asset.purchaseFrom,
      invoiceNo: asset.invoiceNo,
      status: asset.status || "Active",
      purchaseDate: asset.purchaseDate,
      purchaseTime: asset.purchaseTime
    });
    setEditDialogOpen(true);
  };

  // Handle edit form input changes
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateAsset = async () => {
    if (!editingAsset) return;
    
    try {
      setUpdating(true);
      
      console.log("📤 Updating asset ID:", editingAsset._id);
      console.log("📦 Update data:", editForm);
      
      const updateData = { ...editForm };
      
      // Convert price to number if it's a string
      if (updateData.purchasePrice !== undefined) {
        if (typeof updateData.purchasePrice === 'string') {
          const cleanedPrice = updateData.purchasePrice.replace(/,/g, '').trim();
          updateData.purchasePrice = cleanedPrice ? parseFloat(cleanedPrice) : null;
        } else if (typeof updateData.purchasePrice === 'number') {
          updateData.purchasePrice = updateData.purchasePrice;
        }
      }
      
      // Convert quantity to number if it's a string
      if (typeof updateData.quantity === 'string') {
        updateData.quantity = parseInt(updateData.quantity) || 1;
      }

      // Send update request
      const response = await api.put(`${ASSETS_API}/${editingAsset._id}`, updateData);
      const result = response.data;

      if (result.success) {
        toast({
          title: "✅ Success",
          description: "Asset updated successfully",
        });
        
        setData(prev => prev.map(item => 
          item._id === editingAsset._id ? { ...item, ...result.data } : item
        ));
        
        setEditDialogOpen(false);
        setEditingAsset(null);
        setEditForm({});
      } else {
        const errorMsg = result.error || result.message || "Failed to update asset";
        console.error("❌ Update backend error:", result);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("❌ Error updating asset:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to update asset",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAsset = async (id: string, assetName: string) => {
    if (!confirm(`Are you sure you want to delete "${assetName}"?`)) return;

    try {
      const response = await api.delete(`${ASSETS_API}/${id}`);
      const result = response.data;

      if (result.success) {
        toast({
          title: "✅ Deleted",
          description: `${assetName} has been deleted.`,
        });
        
        setData(prev => prev.filter(item => item._id !== id));
        await fetchStats();
      } else {
        throw new Error(result.error || "Failed to delete asset");
      }
    } catch (error: any) {
      console.error("Error deleting asset:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete asset",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (asset: AssetItem) => {
    setSelectedAsset(asset);
    setShowDetails(true);
  };

  const filteredData = data.filter(item =>
    item.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(Math.max(1, totalPages));
  }, [filteredData.length, currentPage, totalPages]);

  if (showDetails && selectedAsset) {
    return <AssetDetailsView 
      onBack={() => setShowDetails(false)} 
      assetId={selectedAsset._id} 
    />;
  }

  // Updated formatDate function to show month names
  const formatDate = (dateString: string) => {
    return formatDateWithMonthName(dateString);
  };

  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <Package className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Company Assets</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-cms-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-foreground">{stats.totalAssets}</p>
        </div>
        <div className="bg-cms-card rounded-xl p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Assets Value</p>
          <p className="text-2xl font-bold text-foreground">
            Rs. {stats.totalValue.toLocaleString()}
          </p>
        </div>
        {financeBalances && (
          <div className="bg-cms-card rounded-xl p-4 col-span-2 border border-primary/20">
            <p className="text-sm font-medium text-foreground mb-2">Finance (linked)</p>
            <p className="text-xs text-muted-foreground mb-2">
              Naya asset add karne par purchase price Finance se withdraw hoti hai (transaction: Asset: …)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Drawer</span>
                <p className="font-semibold text-primary">Rs. {financeBalances.drawer.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Bank</span>
                <p className="font-semibold">Rs. {financeBalances.bank.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">JazzCash</span>
                <p className="font-semibold">Rs. {financeBalances.jazzcash.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">EasyPaisa</span>
                <p className="font-semibold">Rs. {financeBalances.easypaisa.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for anything"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-72"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => exportAssets("excel")} className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium">
            Excel
          </button>
          <button type="button" onClick={() => exportAssets("pdf")} className="px-3 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium">
            PDF
          </button>
          <button className="px-4 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Filter className="w-4 h-4" />
            Filter By
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            disabled={adding}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Asset
              </>
            )}
          </button>
          <button className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-cms-card rounded-xl p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-foreground">Loading assets...</span>
        </div>
      ) : (
        /* Table */
        <div className="bg-cms-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-cms-table-header">
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Asset Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Condition</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Assigned to</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, index) => (
                <tr
                  key={item._id}
                  className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'} hover:bg-cms-card-hover transition-colors`}
                >
                  <td className="px-4 py-3 text-sm text-foreground">{item.assetName}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.condition === 'New' ? 'bg-green-100 text-green-800' :
                      item.condition === 'Good' ? 'bg-blue-100 text-blue-800' :
                      item.condition === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {item.purchasePrice ? `Rs. ${item.purchasePrice.toLocaleString()}` : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{item.assignedTo}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{formatDate(item.purchaseDate)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditStart(item)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-blue-600 hover:text-blue-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewDetails(item)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-green-600 hover:text-green-700"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(item._id, item.assetName)}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors text-red-500 hover:text-red-700"
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

          {filteredData.length === 0 && !loading && (
            <div className="py-8 text-center text-muted-foreground">
              No assets found. {searchTerm ? 'Try a different search term.' : 'Add your first asset!'}
            </div>
          )}

          {/* Pagination - 10 records per page (same as Roznamcha) */}
          {filteredData.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-cms-card">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of {filteredData.length} assets
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-border hover:bg-cms-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-cms-card-hover disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Asset Dialog */}
      <AddAssetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddAsset}
      />

      {/* Edit Asset Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-background border-border max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogTitle className="sr-only">Edit Asset</DialogTitle>
          <DialogDescription className="sr-only">
            Dialog for editing existing assets
          </DialogDescription>
          
          {/* Breadcrumb Header */}
          <div className="bg-cms-sidebar px-6 py-3 border-b border-border">
            <p className="text-xs text-muted-foreground">Assets/ Edit Asset</p>
          </div>

          <div className="p-6 bg-background">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground">Edit Asset</h1>
              <p className="text-sm text-muted-foreground">Update the details for {editingAsset?.assetName}</p>
            </div>

            {/* Asset Information Section */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-primary mb-4">Asset Information</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Asset Name</label>
                  <input
                    type="text"
                    name="assetName"
                    placeholder="e.g Dell Laptop"
                    value={editForm.assetName || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Category</label>
                  <div className="relative">
                    <select
                      name="category"
                      value={editForm.category || ''}
                      onChange={handleEditFormChange}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Category</option>
                      <option value="Electronic">Electronic</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Office Equipment">Office Equipment</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    placeholder="e.g 1"
                    value={editForm.quantity || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    min="1"
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
                    value={editForm.sizeModel || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Condition</label>
                  <div className="relative">
                    <select
                      name="condition"
                      value={editForm.condition || ''}
                      onChange={handleEditFormChange}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Condition</option>
                      <option value="New">New</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
                <textarea
                  name="description"
                  placeholder="Write short detail"
                  value={editForm.description || ''}
                  onChange={handleEditFormChange}
                  rows={3}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {/* Assigned Details Section */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-primary mb-4">Assigned Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Department</label>
                  <div className="relative">
                    <select
                      name="department"
                      value={editForm.department || ''}
                      onChange={handleEditFormChange}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Department</option>
                      <option value="IT">IT</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                      <option value="Operations">Operations</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Assigned to</label>
                  <input
                    type="text"
                    name="assignedTo"
                    placeholder="Emily Clark"
                    value={editForm.assignedTo || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Details Section */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-primary mb-4">Purchase Details</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Purchase Price</label>
                  <input
                    type="text"
                    name="purchasePrice"
                    placeholder="70000"
                    value={editForm.purchasePrice || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Purchase From</label>
                  <input
                    type="text"
                    name="purchaseFrom"
                    placeholder="John Doe"
                    value={editForm.purchaseFrom || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Invoice No.</label>
                  <input
                    type="text"
                    name="invoiceNo"
                    placeholder="e.g 83662626"
                    value={editForm.invoiceNo || ''}
                    onChange={handleEditFormChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Date & Time</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      name="purchaseDate"
                      value={editForm.purchaseDate ? new Date(editForm.purchaseDate).toISOString().split('T')[0] : ''}
                      onChange={handleEditFormChange}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  <div className="relative">
                    <input
                      type="time"
                      name="purchaseTime"
                      value={editForm.purchaseTime || ''}
                      onChange={handleEditFormChange}
                      className="w-32 bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setEditDialogOpen(false)}
                disabled={updating}
                className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateAsset}
                disabled={updating}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Update Asset
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}