import { useState, useEffect } from "react";
import { Pencil, Printer, Trash2, IndianRupee, Building2, FileText, Calendar, Package, Settings, Box, Cpu, CheckCircle, AlignLeft, Building, User, ArrowLeft, Loader2 } from "lucide-react";

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

const API_BASE_URL = "http://localhost:5000/api/assets";

interface AssetDetailsViewProps {
  onBack: () => void;
  assetId: string; // Only assetId is needed
}

export function AssetDetailsView({ onBack, assetId }: AssetDetailsViewProps) {
  const [asset, setAsset] = useState<AssetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch asset details from API
  const fetchAssetDetails = async () => {
    if (!assetId) {
      console.error("❌ No asset ID provided");
      setError("No asset ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log("🔍 Fetching asset ID:", assetId);
      console.log("🔗 API URL:", `${API_BASE_URL}/${assetId}`);
      
      const response = await fetch(`${API_BASE_URL}/${assetId}`);
      
      console.log("📊 Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error Response:", errorText);
        throw new Error(`HTTP ${response.status}: Failed to fetch asset`);
      }
      
      const result = await response.json();
      console.log("✅ API Response:", result);
      
      if (result.success) {
        setAsset(result.data);
        console.log("📦 Asset data loaded successfully");
      } else {
        console.error("❌ API returned error:", result.error);
        throw new Error(result.error || "Failed to fetch asset details");
      }
    } catch (error: any) {
      console.error("❌ Error fetching asset details:", error);
      setError(error.message || "Failed to load asset details");
      setAsset(null);
    } finally {
      setLoading(false);
      console.log("⏳ Loading state set to false");
    }
  };

  useEffect(() => {
    console.log("🎯 AssetDetailsView mounted with assetId:", assetId);
    
    if (assetId) {
      fetchAssetDetails();
    } else {
      console.error("🚫 No assetId provided!");
      setLoading(false);
      setError("No asset ID provided");
    }
    
    // Test API endpoint
    console.log("🧪 Testing API endpoint...");
    fetch(`${API_BASE_URL}/get-all`)
      .then(res => res.json())
      .then(data => {
        console.log("✅ GET /get-all response:", data.success ? "Success" : "Failed");
        if (data.data && data.data.length > 0) {
          console.log("📊 Sample asset IDs:", data.data.slice(0, 3).map((a: any) => a._id));
        }
      })
      .catch(err => console.error("❌ GET /get-all error:", err));
  }, [assetId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Format date and time
  const formatDateTime = (dateString: string, timeString?: string) => {
    try {
      const date = new Date(dateString);
      const dateFormatted = date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      
      if (timeString) {
        return `${dateFormatted} ${timeString}`;
      }
      
      const timeFormatted = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      return `${dateFormatted} ${timeFormatted}`;
    } catch (error) {
      return dateString;
    }
  };

  // Quick test button
  const testApiManually = () => {
    console.log("🧪 Manual API test for assetId:", assetId);
    if (assetId) {
      fetch(`${API_BASE_URL}/${assetId}`)
        .then(res => {
          console.log("Manual test - Status:", res.status);
          console.log("Manual test - Headers:", Object.fromEntries(res.headers.entries()));
          return res.json();
        })
        .then(data => {
          console.log("Manual test - Data:", data);
          if (data.success) {
            setAsset(data.data);
          }
        })
        .catch(err => console.error("Manual test - Error:", err));
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Assets
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <span className="text-lg font-medium text-foreground mb-2">Loading asset details...</span>
          <p className="text-sm text-muted-foreground mb-4">
            Fetching data for asset ID: {assetId?.substring(0, 12)}...
          </p>
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <p>API Endpoint: {API_BASE_URL}/{assetId}</p>
            <p>Check browser console (F12) for debugging info</p>
          </div>
          <button
            onClick={testApiManually}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm"
          >
            Test API Manually
          </button>
        </div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Assets
          </button>
        </div>
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 inline-block max-w-lg">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Could Not Load Asset</h2>
            <p className="text-red-700 mb-4">
              {error || "The asset could not be loaded."}
            </p>
            <p className="text-sm text-red-600 mb-2">Asset ID: {assetId}</p>
            <div className="space-y-2 text-sm text-red-600 text-left mb-6">
              <p>Possible issues:</p>
              <ul className="list-disc pl-5">
                <li>Backend server not running</li>
                <li>Incorrect asset ID</li>
                <li>Network connection issue</li>
                <li>API endpoint not found</li>
              </ul>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              >
                Back to Assets List
              </button>
              <button
                onClick={fetchAssetDetails}
                className="px-4 py-2 bg-secondary text-foreground rounded hover:bg-secondary/90 border"
              >
                Try Again
              </button>
              <button
                onClick={testApiManually}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Debug API
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Back to Assets
        </button>
        <span className="text-muted-foreground">/</span>
        <p className="text-sm text-muted-foreground">Assets/ Details</p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assets Details</h1>
          <p className="text-sm text-muted-foreground">Full details for {asset.assetName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <button className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Details Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Price Details */}
        <div className="bg-cms-card rounded-xl p-5">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Price Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <IndianRupee className="w-4 h-4" />
                <span className="text-sm">Purchase Price</span>
              </div>
              <span className="text-sm text-foreground">
                {asset.purchasePrice ? `Rs. ${asset.purchasePrice.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Purchase From</span>
              </div>
              <span className="text-sm text-foreground">{asset.purchaseFrom || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Invoice No.</span>
              </div>
              <span className="text-sm text-foreground">{asset.invoiceNo || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Date & Time</span>
              </div>
              <span className="text-sm text-foreground">
                {formatDateTime(asset.purchaseDate, asset.purchaseTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Asset Details */}
        <div className="bg-cms-card rounded-xl p-5">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Asset Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Package className="w-4 h-4" />
                <span className="text-sm">Asset Name</span>
              </div>
              <span className="text-sm text-foreground">{asset.assetName}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Category</span>
              </div>
              <span className="text-sm text-foreground">{asset.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Box className="w-4 h-4" />
                <span className="text-sm">Quantity</span>
              </div>
              <span className="text-sm text-foreground">{asset.quantity}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Cpu className="w-4 h-4" />
                <span className="text-sm">Model</span>
              </div>
              <span className="text-sm text-foreground">{asset.sizeModel || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Condition</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                asset.condition === 'New' ? 'bg-green-100 text-green-800' :
                asset.condition === 'Good' ? 'bg-blue-100 text-blue-800' :
                asset.condition === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {asset.condition}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlignLeft className="w-4 h-4" />
                <span className="text-sm">Description</span>
              </div>
              <span className="text-sm text-foreground">{asset.description || 'No description'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Details */}
      <div className="bg-cms-card rounded-xl p-5 max-w-md">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Assigned Details</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Building className="w-4 h-4" />
              <span className="text-sm">Department</span>
            </div>
            <span className="text-sm text-foreground">{asset.department}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="text-sm">Assigned To</span>
            </div>
            <span className="text-sm text-foreground">{asset.assignedTo}</span>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-cms-card rounded-xl p-5 mt-4 max-w-md">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Additional Information</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Status</span>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              (asset.status || 'Active') === 'Active' ? 'bg-green-100 text-green-800' :
              (asset.status || 'Active') === 'Inactive' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {asset.status || 'Active'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Created At</span>
            </div>
            <span className="text-sm text-foreground">{formatDate(asset.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Last Updated</span>
            </div>
            <span className="text-sm text-foreground">{formatDate(asset.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}