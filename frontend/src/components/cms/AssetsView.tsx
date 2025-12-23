import { useState, useEffect } from "react";
import { Search, Plus, Printer, Pencil, Eye, Trash2, ChevronLeft, ChevronRight, Filter, Package, Loader2, Save, Calendar, Clock, ChevronDown } from "lucide-react";
import { AddAssetDialog } from "./AddAssetDialog";
import { AssetDetailsView } from "./AssetDetailsView";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

// ✅ Use environment variable for API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const ASSETS_API_URL = `${API_BASE_URL}/api/assets`;

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
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalValue: 0,
  });

  // ✅ Updated to use ASSETS_API_URL
  // Fetch all assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${ASSETS_API_URL}/get-all`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      if (result.success) {
        setData(result.data || []);
      } else {
        throw new Error(result.error || "Failed to fetch assets");
      }
    } catch (error: any) {
      console.error("Error fetching assets:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load assets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Updated to use ASSETS_API_URL
  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${ASSETS_API_URL}/stats`);
      if (!response.ok) return;
      
      const result = await response.json();
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
  }, []);

  useEffect(() => {
    if (data.length > 0) {
      fetchStats();
    }
  }, [data]);

  const handleAddAsset = async (assetData: any) => {
    try {
      setAdding(true);
      
      console.log("📤 Received asset data:", assetData);
      console.log("🔍 purchasePrice type:", typeof assetData.purchasePrice);
      console.log("🔍 purchasePrice value:", assetData.purchasePrice);

      // ✅ SIMPLIFIED FIX: Check if purchasePrice is a string before using .replace()
      let purchasePriceValue = null;
      if (assetData.purchasePrice !== null && assetData.purchasePrice !== undefined && assetData.purchasePrice !== "") {
        if (typeof assetData.purchasePrice === 'number') {
          purchasePriceValue = assetData.purchasePrice;
        } else if (typeof assetData.purchasePrice === 'string') {
          // ✅ SAFE: Only call .replace() if it's definitely a string
          const cleanedPrice = assetData.purchasePrice.replace(/,/g, '').trim();
          if (cleanedPrice && !isNaN(parseFloat(cleanedPrice))) {
            purchasePriceValue = parseFloat(cleanedPrice);
          }
        }
      }

      const formattedData = {
        assetName: assetData.assetName,
        category: assetData.category,
        quantity: parseInt(assetData.quantity) || 1,
        sizeModel: assetData.sizeModel || null,
        condition: assetData.condition,
        description: assetData.description || null,
        department: assetData.department,
        assignedTo: assetData.assignedTo || null,
        purchasePrice: purchasePriceValue,
        purchaseFrom: assetData.purchaseFrom || null,
        invoiceNo: assetData.invoiceNo || null,
        date: assetData.date || new Date().toISOString().split('T')[0],
        time: assetData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
      };

      console.log("📤 Sending formatted data:", formattedData);

      // ✅ Use ASSETS_API_URL
      const response = await fetch(`${ASSETS_API_URL}/create-assets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData)
      });

      console.log("📥 Add response status:", response.status);
      
      const responseText = await response.text();
      console.log("📥 Add response text:", responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response as JSON:", e);
        throw new Error("Invalid response from server");
      }

      if (response.ok && result.success) {
        toast({
          title: "✅ Asset Added",
          description: `${result.data.assetName} has been added successfully.`,
        });
        
        if (result.data) {
          setData(prev => [result.data, ...prev]);
        }
        
        await fetchAssets();
        setDialogOpen(false);
      } else {
        const errorMsg = result.error || result.message || "Failed to create asset";
        console.error("❌ Backend error:", result);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("❌ Error adding asset:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to add asset",
        variant: "destructive",
      });
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
      status: asset.status || "Active"
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

  // ✅ Updated to use ASSETS_API_URL
  const handleUpdateAsset = async () => {
    if (!editingAsset) return;
    
    try {
      setUpdating(true);
      
      console.log("📤 Updating asset ID:", editingAsset._id);
      console.log("📦 Update data:", editForm);
      
      const updateData = { ...editForm };
      
      // ✅ FIXED: Check type before calling .replace()
      if (updateData.purchasePrice !== undefined) {
        if (typeof updateData.purchasePrice === 'string') {
          const cleanedPrice = updateData.purchasePrice.replace(/,/g, '').trim();
          updateData.purchasePrice = cleanedPrice ? parseFloat(cleanedPrice) : null;
        } else if (typeof updateData.purchasePrice === 'number') {
          // Already a number, keep as is
          updateData.purchasePrice = updateData.purchasePrice;
        }
      }
      
      if (typeof updateData.quantity === 'string') {
        updateData.quantity = parseInt(updateData.quantity) || 1;
      }

      // ✅ Use ASSETS_API_URL
      const response = await fetch(`${ASSETS_API_URL}/${editingAsset._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      console.log("📥 Update response status:", response.status);
      
      const responseText = await response.text();
      console.log("📥 Update response text:", responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse update response as JSON:", e);
        throw new Error("Invalid response from server");
      }

      if (response.ok && result.success) {
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

  // ✅ Updated to use ASSETS_API_URL
  const handleDeleteAsset = async (id: string, assetName: string) => {
    if (!confirm(`Are you sure you want to delete "${assetName}"?`)) return;

    try {
      // ✅ Use ASSETS_API_URL
      const response = await fetch(`${ASSETS_API_URL}/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok && result.success) {
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

  if (showDetails && selectedAsset) {
    return <AssetDetailsView 
      onBack={() => setShowDetails(false)} 
      assetId={selectedAsset._id} 
    />;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
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
        <div className="flex items-center gap-3">
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
              {filteredData.map((item, index) => (
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
                  <td className="px-4 py-3 text-sm text-foreground">{formatDate(item.purchaseDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditStart(item)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewDetails(item)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
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
                    type="text" // Changed from number to text for safer handling
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