import { useState, useEffect } from "react";
import { Pencil, Printer, Trash2, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, Truck, Settings, User, CreditCard, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

// Configure axios using environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Update the purchases endpoint
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;

interface Purchase {
  _id: string;
  materialName: string;
  vendor: string;
  price: string;
  weight: string;
  quality: string;
  purchaseDate: string;
  materialColor: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  vehicleColor: string;
  deliveryDate: string;
  receiptNo: string;
  vehicleImage: string;
  createdAt: string;
  updatedAt: string;
}

interface PurchaseDetailsViewProps {
  purchaseId: string;
  onBack: () => void;
}

// Helper function to get correct image URL using environment variable
const getImageUrl = (imagePath: string | undefined): string | null => {
  if (!imagePath) return null;
  
  console.log('Original image path:', imagePath);
  
  // If it's already a full URL
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Remove leading slash if present for consistency
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  
  // If it starts with uploads
  if (cleanPath.startsWith('uploads/')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // If it's just a filename without path
  if (!cleanPath.includes('/')) {
    return `${API_BASE_URL}/uploads/${cleanPath}`;
  }
  
  // Default case - assume it's relative to API base URL
  return `${API_BASE_URL}/${cleanPath}`;
};

export function PurchaseDetailsView({ purchaseId, onBack }: PurchaseDetailsViewProps) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fetch purchase details by ID
  useEffect(() => {
    if (purchaseId) {
      fetchPurchaseDetails();
    }
  }, [purchaseId]);

  const fetchPurchaseDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      setImageError(false);
      
      const response = await api.get(`/api/purchases/${purchaseId}`);
      
      if (response.data.success) {
        setPurchase(response.data.data);
        
        // Log the image path for debugging
        if (response.data.data?.vehicleImage) {
          console.log('Image path from API:', response.data.data.vehicleImage);
          console.log('Constructed URL:', getImageUrl(response.data.data.vehicleImage));
        }
      } else {
        throw new Error(response.data.message || 'Failed to fetch purchase details');
      }
    } catch (error: any) {
      console.error('Error fetching purchase details:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load purchase details');
      toast({
        title: "Error",
        description: "Failed to load purchase details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    // Implement edit functionality
    toast({
      title: "Edit",
      description: "Edit functionality will be implemented soon.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
      try {
        setDeleting(true);
        await api.delete(`/api/purchases/${purchaseId}`);
        
        toast({
          title: "Success",
          description: "Purchase deleted successfully!",
        });
        
        // Go back to the list
        onBack();
      } catch (error: any) {
        console.error('Error deleting purchase:', error);
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to delete purchase",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
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

  const formatCurrency = (amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return '₹0';
      return `₹${numAmount.toLocaleString('en-IN')}`;
    } catch (error) {
      return `₹${amount}`;
    }
  };

  const getColorName = (colorCode: string) => {
    const colorMap: Record<string, string> = {
      '#FFFFFF': 'White',
      '#FACC15': 'Yellow',
      '#EF4444': 'Red',
      '#2563EB': 'Blue',
      '#F97316': 'Orange',
      '#22C55E': 'Green',
    };
    return colorMap[colorCode] || colorCode;
  };

  // Get the image URL
  const imageUrl = purchase?.vehicleImage ? getImageUrl(purchase.vehicleImage) : null;

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading purchase details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Details</h3>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchPurchaseDetails}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in">
        <div className="mb-6">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-600 mb-2">Purchase Not Found</h3>
          <p className="text-yellow-500">The purchase you are looking for does not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Purchase List
        </button>
      </div>

      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground mb-6">Point of Purchase / Details</p>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchase Record Details</h1>
          <p className="text-sm text-muted-foreground">Full details for the selected purchase transaction.</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">
              ID: {purchase._id}
            </span>
            <span className="text-xs bg-green-500/10 text-green-600 px-3 py-1 rounded-full">
              Created: {formatDate(purchase.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Details Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Product Details */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Product Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Circle className="w-4 h-4" />
                <span className="text-sm">Material Name</span>
              </div>
              <span className="text-sm text-foreground">{purchase.materialName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Scale className="w-4 h-4" />
                <span className="text-sm">Weight</span>
              </div>
              <span className="text-sm text-foreground">{purchase.weight || '0'} kg</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Palette className="w-4 h-4" />
                <span className="text-sm">Color</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: purchase.materialColor }}
                />
                <span className="text-sm text-foreground">{getColorName(purchase.materialColor) || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Vendor</span>
              </div>
              <span className="text-sm text-foreground">{purchase.vendor || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Award className="w-4 h-4" />
                <span className="text-sm">Quality</span>
              </div>
              <span className="text-sm text-foreground">{purchase.quality || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <IndianRupee className="w-4 h-4" />
                <span className="text-sm">Price</span>
              </div>
              <span className="text-sm text-foreground">{formatCurrency(purchase.price)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Purchase Date & Time</span>
              </div>
              <span className="text-sm text-foreground">{formatDate(purchase.purchaseDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Receipt No.</span>
              </div>
              <span className="text-sm text-foreground">{purchase.receiptNo || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Vehicle Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Truck className="w-4 h-4" />
                <span className="text-sm">Vehicle Name</span>
              </div>
              <span className="text-sm text-foreground">{purchase.vehicleName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Settings className="w-4 h-4" />
                <span className="text-sm">Vehicle Type</span>
              </div>
              <span className="text-sm text-foreground">{purchase.vehicleType || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Palette className="w-4 h-4" />
                <span className="text-sm">Vehicle Color</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: purchase.vehicleColor }}
                />
                <span className="text-sm text-foreground">{getColorName(purchase.vehicleColor) || 'N/A'}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">Driver Name</span>
              </div>
              <span className="text-sm text-foreground">{purchase.driverName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Vehicle Number</span>
              </div>
              <span className="text-sm text-foreground">{purchase.vehicleNumber || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Delivery Date & Time</span>
              </div>
              <span className="text-sm text-foreground">{formatDate(purchase.deliveryDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Image Section */}
      <div className="bg-cms-card rounded-xl p-5 border border-border mb-6">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Vehicle Image</h3>
        
        {imageUrl ? (
          <div>
            <div className="mb-3">
              <p className="text-xs text-muted-foreground">Image URL:</p>
              <p className="text-xs font-mono bg-cms-card-hover p-2 rounded border border-border break-all">
                {imageUrl}
              </p>
            </div>
            <div className="rounded-xl overflow-hidden border border-border">
              <img 
                src={imageUrl}
                alt={`${purchase.vehicleName} vehicle`} 
                className="w-full h-64 object-cover"
                onError={(e) => {
                  console.error('Image failed to load:', imageUrl);
                  setImageError(true);
                }}
              />
            </div>
            {imageError && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-600">
                  Could not load image. Check if the file exists in the uploads directory.
                </p>
                <p className="text-xs text-yellow-500 mt-1">
                  Expected path: {purchase.vehicleImage}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-64 bg-cms-card-hover border border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
            <Truck className="w-12 h-12 mb-2" />
            <p>No vehicle image uploaded</p>
            <p className="text-xs mt-1">{purchase.vehicleName || 'Vehicle'}</p>
          </div>
        )}
      </div>

      {/* Additional Information */}
      <div className="bg-cms-card rounded-xl p-5 border border-border">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Additional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Record Created</label>
            <p className="text-sm text-foreground mt-1">{formatDate(purchase.createdAt)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Last Updated</label>
            <p className="text-sm text-foreground mt-1">{formatDate(purchase.updatedAt)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Database ID</label>
            <p className="text-sm text-foreground mt-1 font-mono">{purchase._id}</p>
          </div>
        </div>
      </div>

      {/* Debug Info (visible only in development) */}
      {process.env.NODE_ENV === 'development' && purchase.vehicleImage && (
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Debug Information</h4>
          <div className="space-y-2">
            <p className="text-xs text-gray-600">Original image path: <code className="bg-gray-100 px-1 py-0.5 rounded">{purchase.vehicleImage}</code></p>
            <p className="text-xs text-gray-600">Constructed URL: <code className="bg-gray-100 px-1 py-0.5 rounded">{imageUrl}</code></p>
            <p className="text-xs text-gray-600">API Base URL: <code className="bg-gray-100 px-1 py-0.5 rounded">{API_BASE_URL}</code></p>
            <button
              onClick={() => window.open(imageUrl || '', '_blank')}
              className="text-xs text-blue-500 hover:text-blue-600 underline"
            >
              Open image in new tab
            </button>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style media="print">
        {`
          @media print {
            button, nav, .no-print {
              display: none !important;
            }
            body {
              font-size: 12px;
            }
            .bg-cms-card {
              background: white !important;
              border: 1px solid #ddd !important;
            }
            .text-foreground {
              color: black !important;
            }
            .text-muted-foreground {
              color: #666 !important;
            }
          }
        `}
      </style>
    </div>
  );
}