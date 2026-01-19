import { useState, useEffect } from "react";
import { Pencil, Printer, Trash2, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, Truck, Settings, User, CreditCard, ArrowLeft, Loader2, Download, Eye, FileText, Image as ImageIcon, AlertCircle } from "lucide-react";
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

// Enhanced helper function to get correct image URL
const getImageUrl = (imagePath: string | undefined): string | null => {
  if (!imagePath || imagePath.trim() === '') {
    return null;
  }
  
  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Clean the path - remove any leading slashes
  let cleanPath = imagePath;
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }
  
  // Check common path patterns
  // Pattern 1: starts with uploads/
  if (cleanPath.startsWith('uploads/')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // Pattern 2: If path contains uploads but not at start
  if (cleanPath.includes('uploads/')) {
    return `${API_BASE_URL}/${cleanPath}`;
  }
  
  // Pattern 3: Just a filename with extension
  if (cleanPath.includes('.') && !cleanPath.includes('/')) {
    return `${API_BASE_URL}/uploads/vehicles/${cleanPath}`;
  }
  
  // Default: try to construct URL based on common vehicle image path
  return `${API_BASE_URL}/${cleanPath}`;
};

// Function to test image loading with retries
const loadImageWithRetry = (url: string, retries = 3): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Handle CORS if needed
    
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (retries > 0) {
        // Try again with a timestamp cache buster
        const retryUrl = url.includes('?') ? `${url}&retry=${retries}` : `${url}?retry=${retries}`;
        loadImageWithRetry(retryUrl, retries - 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error(`Failed to load image after ${retries} retries`));
      }
    };
    
    img.src = url;
  });
};

export function PurchaseDetailsView({ purchaseId, onBack }: PurchaseDetailsViewProps) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleImageUrl, setVehicleImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  // Fetch purchase details by ID
  useEffect(() => {
    if (purchaseId) {
      fetchPurchaseDetails();
    }
  }, [purchaseId]);

  // Update vehicle image URL when purchase data changes
  useEffect(() => {
    if (purchase?.vehicleImage) {
      const url = getImageUrl(purchase.vehicleImage);
      
      // Test if the image loads successfully
      if (url) {
        setImageLoading(true);
        loadImageWithRetry(url)
          .then(() => {
            setVehicleImageUrl(url);
            setImageError(false);
          })
          .catch(() => {
            setVehicleImageUrl(url);
            setImageError(true);
          })
          .finally(() => {
            setImageLoading(false);
          });
      } else {
        setVehicleImageUrl(null);
        setImageLoading(false);
      }
    } else {
      setVehicleImageUrl(null);
      setImageLoading(false);
    }
  }, [purchase]);

  const fetchPurchaseDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      setImageError(false);
      setVehicleImageUrl(null);
      setImageLoading(true);
      
      const response = await api.get(`${PURCHASES_API_URL}/${purchaseId}`);
      
      if (response.data.success) {
        const purchaseData = response.data.data;
        setPurchase(purchaseData);
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

  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = e.currentTarget;
    
    setImageError(true);
    setImageLoading(false);
    
    // Try alternative URL patterns
    if (purchase?.vehicleImage) {
      const originalPath = purchase.vehicleImage;
      
      // Try different URL patterns
      const altPatterns = [
        // Direct from API_BASE_URL with cleaned path
        `${API_BASE_URL}/${originalPath.startsWith('/') ? originalPath.substring(1) : originalPath}`,
        // With uploads/ prefix
        `${API_BASE_URL}/uploads/${originalPath.split('/').pop()}`,
        // With uploads/vehicles/ prefix
        `${API_BASE_URL}/uploads/vehicles/${originalPath.split('/').pop()}`,
        // Try with localhost:5000 directly
        `http://localhost:5000/${originalPath.startsWith('/') ? originalPath.substring(1) : originalPath}`,
      ];
      
      // Try each pattern
      for (const pattern of altPatterns) {
        try {
          await loadImageWithRetry(pattern, 1);
          
          // If we get here, the pattern works
          setVehicleImageUrl(pattern);
          setImageError(false);
          
          // Update the img src
          imgElement.src = pattern;
          
          toast({
            title: "Image Loaded",
            description: "Vehicle image loaded successfully.",
          });
          
          return;
        } catch (error) {
          continue;
        }
      }
    }
  };

  const handleImageLoad = () => {
    setImageError(false);
    setImageLoading(false);
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
        await api.delete(`${PURCHASES_API_URL}/${purchaseId}`);
        
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

  const handleDownloadVehicleImage = () => {
    if (!vehicleImageUrl) return;

    const link = document.createElement('a');
    link.href = vehicleImageUrl;
    link.download = `vehicle_${purchase?.vehicleNumber || purchase?._id}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Downloading",
      description: "Vehicle image download started",
    });
  };

  const handleViewVehicleImage = () => {
    setShowVehicleModal(true);
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
      '#000000': 'Black',
    };
    return colorMap[colorCode] || colorCode;
  };

  // Check if image is PDF
  const isVehicleImagePDF = vehicleImageUrl?.toLowerCase().endsWith('.pdf');

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
      {/* Vehicle Image Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-cms-card rounded-xl max-w-4xl max-h-[90vh] overflow-auto relative">
            <div className="sticky top-0 bg-cms-table-header px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">
                Vehicle Image - {purchase.vehicleName || purchase.vehicleNumber || 'Vehicle'}
              </h3>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="p-2 hover:bg-cms-card-hover rounded-lg transition-colors"
              >
                <span className="text-xl text-foreground">×</span>
              </button>
            </div>
            <div className="p-6">
              {isVehicleImagePDF ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-10 h-10 text-red-600" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">PDF Document</p>
                  <p className="text-sm text-muted-foreground mb-6">Click below to download the PDF document</p>
                  <button
                    onClick={handleDownloadVehicleImage}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF Document
                  </button>
                </div>
              ) : (
                <div className="relative">
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cms-card">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  )}
                  {vehicleImageUrl ? (
                    <img
                      src={vehicleImageUrl}
                      alt={`${purchase.vehicleName || 'Vehicle'} Image`}
                      className={`w-full h-auto max-h-[70vh] object-contain rounded-lg border border-border ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-64">
                      <p className="text-muted-foreground">No image available</p>
                    </div>
                  )}
                  {imageError && vehicleImageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cms-card">
                      <div className="text-center p-6">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-foreground font-medium mb-2">Failed to load vehicle image</p>
                        <div className="flex gap-2 mt-4 justify-center">
                          <button
                            onClick={() => {
                              setImageError(false);
                              setImageLoading(true);
                              // Force reload by adding timestamp
                              const img = document.querySelector('img[alt*="Vehicle"]') as HTMLImageElement;
                              if (img && vehicleImageUrl) {
                                img.src = vehicleImageUrl + '?t=' + Date.now();
                              }
                            }}
                            className="px-4 py-2 bg-cms-card-hover hover:bg-cms-card border border-border rounded-lg text-sm"
                          >
                            Try Again
                          </button>
                          <button
                            onClick={() => vehicleImageUrl && window.open(vehicleImageUrl, '_blank')}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                          >
                            Open in Browser
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-cms-table-header px-6 py-4 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowVehicleModal(false)}
                className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium"
              >
                Close
              </button>
              {!isVehicleImagePDF && vehicleImageUrl && (
                <button
                  onClick={handleDownloadVehicleImage}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Image
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
            <span className="text-xs bg-primary/10 text-foreground px-3 py-1 rounded-full border border-border">
              ID: {purchase._id.substring(0, 8)}...
            </span>
            <span className="text-xs bg-cms-sidebar text-foreground px-3 py-1 rounded-full border border-border">
              Purchase Date: {formatDate(purchase.purchaseDate)}
            </span>
            <span className="text-xs bg-cms-sidebar text-foreground px-3 py-1 rounded-full border border-border flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Vehicle: {purchase.vehicleNumber || purchase.vehicleName || 'N/A'}
            </span>
            {purchase.vehicleImage ? (
              <span className="text-xs bg-blue-500/10 text-foreground px-3 py-1 rounded-full border border-border">
                Vehicle Image: Available
              </span>
            ) : (
              <span className="text-xs bg-yellow-500/10 text-foreground px-3 py-1 rounded-full border border-border">
                No Vehicle Image
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {vehicleImageUrl && (
            <>
              <button
                onClick={handleViewVehicleImage}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Vehicle Image
              </button>
              <button
                onClick={handleDownloadVehicleImage}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Image
              </button>
            </>
          )}
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
            className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
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

        {/* Vehicle Image Section */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">
            Recepit Image
            {imageError && (
              <span className="ml-2 text-xs bg-red-500/10 text-red-600 px-2 py-1 rounded">
                Error Loading
              </span>
            )}
            {imageLoading && vehicleImageUrl && (
              <span className="ml-2 text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded">
                Loading...
              </span>
            )}
          </h3>
          
          {vehicleImageUrl ? (
            <div className="space-y-4">
              <div className="relative bg-cms-input-bg rounded-lg border-2 border-dashed border-border p-4">
                {isVehicleImagePDF ? (
                  <div className="flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">PDF Document</p>
                    <p className="text-xs text-muted-foreground mt-1">Click to download PDF document</p>
                  </div>
                ) : (
                  <div className="relative">
                    {imageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                    <img
                      src={vehicleImageUrl}
                      alt={`${purchase.vehicleName || 'Vehicle'} Image`}
                      className={`w-full h-48 object-contain rounded-md border border-border ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      crossOrigin="anonymous"
                    />
                    {imageError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-cms-input-bg rounded-md">
                        <div className="text-center p-4">
                          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Failed to load image</p>
                          <button
                            onClick={() => {
                              setImageError(false);
                              setImageLoading(true);
                              const img = document.querySelector('img[alt*="Vehicle"]') as HTMLImageElement;
                              if (img && vehicleImageUrl) {
                                img.src = vehicleImageUrl + '?t=' + Date.now();
                              }
                            }}
                            className="mt-2 text-xs bg-cms-card-hover hover:bg-cms-card border border-border px-3 py-1 rounded"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vehicle:</span>
                  <span className="text-sm font-medium text-foreground">{purchase.vehicleName || purchase.vehicleNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">File Path:</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={purchase.vehicleImage || ''}>
                    {purchase.vehicleImage ? purchase.vehicleImage.split('/').pop() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Uploaded:</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(purchase.createdAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleViewVehicleImage}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={handleDownloadVehicleImage}
                  className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-cms-input-bg rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="text-base font-medium text-foreground mb-2">No Vehicle Image</h4>
              <p className="text-sm text-muted-foreground">
                {purchase.vehicleImage ? 
                  'Vehicle image exists but URL could not be generated.' : 
                  'No vehicle image was uploaded for this purchase.'}
              </p>
            </div>
          )}
        </div>
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