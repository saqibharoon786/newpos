import { useState, useEffect } from "react";
import { Printer, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, Truck, Settings, User, CreditCard, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

// Configure axios using environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Update the purchases endpoint
const PURCHASES_API_URL = `${API_BASE_URL}/purchases`;

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
  const [imageError, setImageError] = useState(false);
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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Details - ${purchase?.materialName || 'Record'}</title>
        <style>
          @media print {
            @page {
              margin: 10mm;
              size: A4 portrait;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
              background: white;
            }
            
            .print-container {
              max-width: 100%;
              padding: 5mm;
            }
            
            .print-header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            
            .print-header h1 {
              margin: 0 0 5px 0;
              font-size: 18px;
              color: #000;
            }
            
            .print-header .subtitle {
              font-size: 12px;
              color: #666;
              margin-bottom: 10px;
            }
            
            .print-badges {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              justify-content: center;
              margin-bottom: 15px;
            }
            
            .print-badge {
              background: #f0f0f0;
              padding: 4px 10px;
              border-radius: 12px;
              font-size: 9px;
              border: 1px solid #ccc;
            }
            
            .print-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 12px;
              margin-bottom: 20px;
            }
            
            .print-section {
              background: white;
              border: 1px solid #ccc;
              border-radius: 4px;
              padding: 12px;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            
            .print-section h3 {
              font-size: 13px;
              margin: 0 0 10px 0;
              padding-bottom: 6px;
              border-bottom: 1px solid #ddd;
              color: #000;
            }
            
            .print-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 6px;
              page-break-inside: avoid;
            }
            
            .print-label {
              color: #666;
              font-size: 10px;
            }
            
            .print-value {
              font-weight: 500;
              font-size: 11px;
              color: #000;
              text-align: right;
            }
            
            .print-image-container {
              border: 1px solid #ccc;
              border-radius: 4px;
              padding: 8px;
              background: #f9f9f9;
              text-align: center;
            }
            
            .print-image {
              max-width: 100%;
              max-height: 120px;
              object-fit: contain;
            }
            
            .print-additional {
              margin-top: 20px;
              border-top: 1px solid #ccc;
              padding-top: 15px;
            }
            
            .print-additional-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
            }
            
            .print-footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #ccc;
              text-align: center;
              font-size: 9px;
              color: #666;
            }
            
            .color-dot {
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              border: 1px solid #ccc;
              margin-right: 4px;
              vertical-align: middle;
            }
            
            /* Compact styles for printing */
            .compact {
              margin: 0;
              padding: 0;
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
          <div class="print-header">
            <h1>Purchase Record Details</h1>
            <div class="subtitle">Full details for the selected purchase transaction</div>
            <div class="print-badges">
              <span class="print-badge">ID: ${purchase?._id.substring(0, 8)}...</span>
              <span class="print-badge">Purchase Date: ${formatDate(purchase?.purchaseDate || '')}</span>
              <span class="print-badge">Vehicle: ${purchase?.vehicleNumber || purchase?.vehicleName || 'N/A'}</span>
              ${purchase?.vehicleImage ? '<span class="print-badge">Vehicle Image: Available</span>' : ''}
            </div>
          </div>
          
          <div class="print-grid">
            <!-- Product Details -->
            <div class="print-section">
              <h3>Product Details</h3>
              <div class="print-row">
                <span class="print-label">Material Name:</span>
                <span class="print-value">${purchase?.materialName || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Weight:</span>
                <span class="print-value">${purchase?.weight || '0'} kg</span>
              </div>
              <div class="print-row">
                <span class="print-label">Color:</span>
                <span class="print-value">
                  <span class="color-dot" style="background-color: ${purchase?.materialColor};"></span>
                  ${getColorName(purchase?.materialColor || '') || 'N/A'}
                </span>
              </div>
              <div class="print-row">
                <span class="print-label">Vendor:</span>
                <span class="print-value">${purchase?.vendor || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Quality:</span>
                <span class="print-value">${purchase?.quality || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Price:</span>
                <span class="print-value">${formatCurrency(purchase?.price || '0')}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Purchase Date:</span>
              <span class="print-value">${formatDate(purchase?.purchaseDate || '')}</span>dsvarf  t~fr
              </div>
              <div class="print-row">
                <span class="print-label">Receipt No:</span>
                <span class="print-value">${purchase?.receiptNo || 'N/A'}</span>
              </div>
            </div>
            
            <!-- Vehicle Details -->
            <div class="print-section">
              <h3>Vehicle Details</h3>
              <div class="print-row">
                <span class="print-label">Vehicle Name:</span>
                <span class="print-value">${purchase?.vehicleName || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Vehicle Type:</span>
                <span class="print-value">${purchase?.vehicleType || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Vehicle Color:</span>
                <span class="print-value">
                  <span class="color-dot" style="background-color: ${purchase?.vehicleColor};"></span>
                  ${getColorName(purchase?.vehicleColor || '') || 'N/A'}
                </span>
              </div>
              <div class="print-row">
                <span class="print-label">Driver Name:</span>
                <span class="print-value">${purchase?.driverName || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Vehicle Number:</span>
                <span class="print-value">${purchase?.vehicleNumber || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Delivery Date:</span>
                <span class="print-value">${formatDate(purchase?.deliveryDate || '')}</span>
              </div>
            </div>
            
            <!-- Vehicle Image -->
            <div class="print-section">
              <h3>Vehicle Image</h3>
              ${vehicleImageUrl && !vehicleImageUrl.toLowerCase().endsWith('.pdf') ? 
                `<div class="print-image-container">
                  <img src="${vehicleImageUrl}" alt="Vehicle Image" class="print-image" onerror="this.style.display='none';this.parentElement.innerHTML='<p>Image not available</p>';" />
                </div>` : 
                `<div class="print-image-container">
                  <p>${purchase?.vehicleImage ? 'Image not available for printing' : 'No vehicle image was uploaded'}</p>
                </div>`
              }
              <div style="margin-top: 10px;">
                <div class="print-row">
                  <span class="print-label">Vehicle:</span>
                  <span class="print-value">${purchase?.vehicleName || purchase?.vehicleNumber || 'N/A'}</span>
                </div>
                <div class="print-row">
                  <span class="print-label">File:</span>
                  <span class="print-value">${purchase?.vehicleImage ? purchase.vehicleImage.split('/').pop() : 'N/A'}</span>
                </div>
                <div class="print-row">
                  <span class="print-label">Uploaded:</span>
                  <span class="print-value">${formatDate(purchase?.createdAt || '')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Additional Information -->
          <div class="print-additional">
            <h3 style="font-size: 13px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Additional Information</h3>
            <div class="print-additional-grid">
              <div>
                <div class="print-label">Record Created</div>
                <div class="print-value" style="font-size: 11px;">${formatDate(purchase?.createdAt || '')}</div>
              </div>
              <div>
                <div class="print-label">Last Updated</div>
                <div class="print-value" style="font-size: 11px;">${formatDate(purchase?.updatedAt || '')}</div>
              </div>
              <div>
                <div class="print-label">Database ID</div>
                <div class="print-value" style="font-size: 10px; font-family: monospace;">${purchase?._id}</div>
              </div>
            </div>
          </div>
          
          <div class="print-footer">
            Printed on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
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
      {/* Back Button */}
      <div className="mb-6 no-print">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Purchase List
        </button>
      </div>

      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground mb-6 no-print">Point of Purchase / Details</p>

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
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors print-button"
          >
            <Printer className="w-4 h-4" />
            Print
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
            Vehicle Image
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
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">PDF Document</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF file cannot be previewed</p>
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
                          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Failed to load image</p>
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
    </div>
  );
}