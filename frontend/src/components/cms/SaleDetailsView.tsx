import { useState, useEffect } from "react";
import { Pencil, Printer, Trash2, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, User, CreditCard, ArrowLeft, Loader2, FileText, Mail, Phone, MapPin, Briefcase, Tag, Percent, DollarSign, Package, Building, Truck, Settings, AlertCircle, Car, Image as ImageIcon, Download, Eye } from "lucide-react";
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
const PURCHASE_API_URL = `${API_BASE_URL}/api/purchases`;

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
  receiptImage?: string;
  
  // Vehicle Details
  vehicleName?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  vehicleColor?: string;
  deliveryDate?: string;
  vehicleImage?: string;
  
  vehicleDetails?: {
    vehicleName?: string;
    vehicleType?: string;
    vehicleNumber?: string;
    driverName?: string;
    vehicleColor?: string;
    deliveryDate?: string;
    vehicleImage?: string;
  };
  
  purchaseId?: string;
  purchaseReference?: string;
  
  createdAt: string;
  updatedAt: string;
}

interface SaleDetailsViewProps {
  saleId: string;
  onBack: () => void;
}

export function SaleDetailsView({ saleId, onBack }: SaleDetailsViewProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [receiptImageError, setReceiptImageError] = useState(false);
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // Fetch sale details by ID
  useEffect(() => {
    if (saleId) {
      fetchSaleDetails();
    }
  }, [saleId]);

  // Update receipt URL when sale data changes
  useEffect(() => {
    if (sale?.receiptImage) {
      const url = getReceiptUrl(sale.receiptImage);
      console.log("Generated receipt URL:", url);
      setReceiptUrl(url);
    } else {
      setReceiptUrl(null);
    }
  }, [sale]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      setImageError(false);
      setReceiptImageError(false);
      setVehicleData(null);
      setReceiptUrl(null);
      
      console.log("Fetching sale details for ID:", saleId);
      const response = await api.get(`${SALES_API_URL}/${saleId}`);
      
      if (response.data.success) {
        const saleData = response.data.data;
        console.log("Sale data received:", saleData);
        console.log("Receipt image path:", saleData.receiptImage);
        setSale(saleData);
        
        // Try to find vehicle data for this sale
        await findVehicleData(saleData);
        
      } else {
        throw new Error(response.data.message || 'Failed to fetch sale details');
      }
    } catch (error: any) {
      console.error('Error fetching sale details:', error);
      setError(error.response?.data?.message || error.message || 'Failed to load sale details');
      toast({
        title: "Error",
        description: "Failed to load sale details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to find vehicle data for the sale
  const findVehicleData = async (saleData: Sale) => {
    try {
      setLoadingVehicle(true);
      
      // Method 1: Check if sale has direct vehicle data
      if (saleData.vehicleName || saleData.vehicleNumber || saleData.driverName) {
        setVehicleData({
          source: 'sale',
          vehicleName: saleData.vehicleName,
          vehicleType: saleData.vehicleType,
          vehicleNumber: saleData.vehicleNumber,
          driverName: saleData.driverName,
          vehicleColor: saleData.vehicleColor,
          deliveryDate: saleData.deliveryDate,
          vehicleImage: saleData.vehicleImage
        });
        return;
      }
      
      // Method 2: Check if sale has nested vehicleDetails
      if (saleData.vehicleDetails && typeof saleData.vehicleDetails === 'object') {
        setVehicleData({
          source: 'sale-vehicleDetails',
          ...saleData.vehicleDetails
        });
        return;
      }
      
      // Method 3: Check if sale has purchaseId to get vehicle from purchase
      if (saleData.purchaseId) {
        try {
          const purchaseResponse = await api.get(`${PURCHASE_API_URL}/${saleData.purchaseId}`);
          if (purchaseResponse.data.success) {
            const purchase = purchaseResponse.data.data;
            setVehicleData({
              source: 'purchase',
              vehicleName: purchase.vehicleName,
              vehicleType: purchase.vehicleType,
              vehicleNumber: purchase.vehicleNumber,
              driverName: purchase.driverName,
              vehicleColor: purchase.vehicleColor,
              deliveryDate: purchase.deliveryDate,
              vehicleImage: purchase.vehicleImage
            });
            return;
          }
        } catch (purchaseError) {
          console.error('Error fetching purchase:', purchaseError);
        }
      }
      
      // Method 4: Search purchases by material name to find matching vehicle
      try {
        const purchasesResponse = await api.get(`${PURCHASE_API_URL}/get-all`);
        if (purchasesResponse.data.success) {
          const purchases = purchasesResponse.data.data || [];
          const matchingPurchase = purchases.find((p: any) => 
            p.materialName === saleData.materialName
          );
          
          if (matchingPurchase) {
            setVehicleData({
              source: 'material-match',
              vehicleName: matchingPurchase.vehicleName,
              vehicleType: matchingPurchase.vehicleType,
              vehicleNumber: matchingPurchase.vehicleNumber,
              driverName: matchingPurchase.driverName,
              vehicleColor: matchingPurchase.vehicleColor,
              deliveryDate: matchingPurchase.deliveryDate,
              vehicleImage: matchingPurchase.vehicleImage
            });
            return;
          }
        }
      } catch (searchError) {
        console.error('Error searching purchases:', searchError);
      }
      
      // No vehicle data found
      setVehicleData(null);
      
    } catch (error) {
      console.error('Error finding vehicle data:', error);
      setVehicleData(null);
    } finally {
      setLoadingVehicle(false);
    }
  };

  // SIMPLE & RELIABLE: Get receipt URL
  const getReceiptUrl = (receiptImage: string): string => {
    if (!receiptImage) return '';
    
    // console.log("Processing receipt image path:", receiptImage);
    
    // If it's already a full URL, return it
    if (receiptImage.startsWith('http://') || receiptImage.startsWith('https://')) {
      return receiptImage;
    }
    
    // If it starts with /, use it as-is
    if (receiptImage.startsWith('/')) {
      return `${API_BASE_URL}${receiptImage}`;
    }
    
    // Otherwise, assume it's relative to API base URL
    return `${API_BASE_URL}/${receiptImage}`;
  };

  // Helper function to get image URL
  const getImageUrl = (imagePath: string | undefined): string | null => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    if (imagePath.startsWith('/')) {
      return `${API_BASE_URL}${imagePath}`;
    }
    
    return `${API_BASE_URL}/${imagePath}`;
  };

  const handleEdit = () => {
    toast({
      title: "Edit",
      description: "Edit functionality will be implemented soon.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this sale? This action cannot be undone.')) {
      try {
        setDeleting(true);
        await api.delete(`${SALES_API_URL}/${saleId}`);
        
        toast({
          title: "Success",
          description: "Sale deleted successfully!",
        });
        
        onBack();
      } catch (error: any) {
        console.error('Error deleting sale:', error);
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to delete sale",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptUrl) return;

    const link = document.createElement('a');
    link.href = receiptUrl;
    link.download = `receipt_${sale?.invoiceNo || sale?._id}_${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Downloading",
      description: "Receipt download started",
    });
  };

  const handleViewReceipt = () => {
    setShowReceiptModal(true);
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
    if (!colorCode) return 'N/A';
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

  // Calculate profit
  const calculateProfit = () => {
    if (!sale) return { amount: 0, percentage: 0 };
    
    const sellingPrice = parseFloat(sale.sellingPrice) || 0;
    const actualPrice = parseFloat(sale.actualPrice) || 0;
    const productionCost = parseFloat(sale.productionCost) || 0;
    const totalCost = actualPrice + productionCost;
    
    if (totalCost === 0) return { amount: 0, percentage: 0 };
    
    const profitAmount = sellingPrice - totalCost;
    const profitPercentage = (profitAmount / totalCost) * 100;
    
    return {
      amount: profitAmount,
      percentage: profitPercentage
    };
  };

  // Get the image URL
  const imageUrl = vehicleData?.vehicleImage ? getImageUrl(vehicleData.vehicleImage) : null;
  const hasVehicleData = vehicleData !== null;
  const isReceiptPDF = receiptUrl?.toLowerCase().endsWith('.pdf');

  if (loading) {
    return (
      <div className="flex-1 p-6 overflow-auto animate-fade-in flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading sale details...</p>
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
            onClick={fetchSaleDetails}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!sale) {
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
          <h3 className="text-lg font-semibold text-yellow-600 mb-2">Sale Not Found</h3>
          <p className="text-yellow-500">The sale you are looking for does not exist or has been deleted.</p>
        </div>
      </div>
    );
  }

  const profit = calculateProfit();

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Receipt Image Modal */}
      {showReceiptModal && receiptUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-cms-card rounded-xl max-w-4xl max-h-[90vh] overflow-auto relative">
            <div className="sticky top-0 bg-cms-table-header px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-foreground">
                Receipt - Invoice #{sale.invoiceNo}
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="p-2 hover:bg-cms-card-hover rounded-lg transition-colors"
              >
                <span className="text-xl text-foreground">×</span>
              </button>
            </div>
            <div className="p-6">
              {isReceiptPDF ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-10 h-10 text-red-600" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">PDF Receipt</p>
                  <p className="text-sm text-muted-foreground mb-6">Click below to download the PDF receipt</p>
                  <button
                    onClick={handleDownloadReceipt}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF Receipt
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={receiptUrl}
                    alt={`Receipt for Invoice #${sale.invoiceNo}`}
                    className="w-full h-auto max-h-[70vh] object-contain rounded-lg border border-border"
                    onError={(e) => {
                      console.error('Image loading error:', e);
                      console.error('Failed URL:', receiptUrl);
                      setReceiptImageError(true);
                      
                      // Try alternative URL if .PNG extension
                      if (sale.receiptImage?.toUpperCase().endsWith('.PNG')) {
                        const altUrl = receiptUrl.toLowerCase();
                        console.log('Trying lowercase URL:', altUrl);
                        setTimeout(() => {
                          e.currentTarget.src = altUrl + '?t=' + Date.now();
                        }, 500);
                      }
                    }}
                  />
                  {receiptImageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-cms-card">
                      <div className="text-center p-6">
                        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-foreground">Failed to load receipt image</p>
                        <p className="text-sm text-muted-foreground mb-3">
                          URL: {receiptUrl.length > 60 ? receiptUrl.substring(0, 60) + '...' : receiptUrl}
                        </p>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              setReceiptImageError(false);
                              // Force reload by adding timestamp
                              const img = document.querySelector('img[alt*="Receipt for Invoice"]') as HTMLImageElement;
                              if (img) {
                                img.src = receiptUrl + '?t=' + Date.now();
                              }
                            }}
                            className="px-4 py-2 bg-cms-card-hover hover:bg-cms-card border border-border rounded-lg text-sm"
                          >
                            Try Again
                          </button>
                          <button
                            onClick={() => window.open(receiptUrl, '_blank')}
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
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium"
              >
                Close
              </button>
              {!isReceiptPDF && receiptUrl && (
                <button
                  onClick={handleDownloadReceipt}
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
          Back to Sales List
        </button>
      </div>

      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground mb-6">Point of Sale / Details</p>

      {/* Header with Receipt Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sale Record Details</h1>
          <p className="text-sm text-muted-foreground">Complete details for sale invoice #{sale.invoiceNo}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs bg-primary/10 text-foreground px-3 py-1 rounded-full border border-border">
              Invoice: {sale.invoiceNo}
            </span>
            <span className="text-xs bg-cms-sidebar text-foreground px-3 py-1 rounded-full border border-border">
              Sale Date: {formatDate(sale.purchaseDate)}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full border border-border ${profit.amount >= 0 ? 'bg-green-500/10 text-foreground' : 'bg-red-500/10 text-foreground'}`}>
              Profit: {profit.amount >= 0 ? '+' : ''}{formatCurrency(profit.amount.toString())}
            </span>
            {hasVehicleData && (
              <span className="text-xs bg-cms-sidebar text-foreground px-3 py-1 rounded-full border border-border flex items-center gap-1">
                <Car className="w-3 h-3" />
                Vehicle: {vehicleData?.vehicleNumber || vehicleData?.vehicleName || 'Assigned'}
              </span>
            )}
            {sale.purchaseId && (
              <span className="text-xs bg-cms-sidebar text-foreground px-3 py-1 rounded-full border border-border">
                Linked to Purchase
              </span>
            )}
            {sale.receiptImage && (
              <span className="text-xs bg-blue-500/10 text-foreground px-3 py-1 rounded-full border border-border">
                Receipt: Available
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {receiptUrl && (
            <>
              <button
                onClick={handleViewReceipt}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4" />
                View Receipt
              </button>
              <button
                onClick={handleDownloadReceipt}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Receipt
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
            Print Invoice
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

      {/* Main Content Grid - Now 3 columns for receipt */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Product & Sale Details */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Product & Sale Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Package className="w-4 h-4" />
                <span className="text-sm">Material Name</span>
              </div>
              <span className="text-sm text-foreground">{sale.materialName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Scale className="w-4 h-4" />
                <span className="text-sm">Weight</span>
              </div>
              <span className="text-sm text-foreground">{sale.weight || '0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Circle className="w-4 h-4" />
                <span className="text-sm">Units</span>
              </div>
              <span className="text-sm text-foreground">{sale.unit || '0'} units</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Palette className="w-4 h-4" />
                <span className="text-sm">Color</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full border border-border"
                  style={{ backgroundColor: sale.materialColor || '#FFFFFF' }}
                />
                <span className="text-sm text-foreground">{getColorName(sale.materialColor)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="text-sm">Supplier</span>
              </div>
              <span className="text-sm text-foreground">{sale.supplierName || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Building className="w-4 h-4" />
                <span className="text-sm">Branch</span>
              </div>
              <span className="text-sm text-foreground">{sale.branch || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="text-sm">Invoice Number</span>
              </div>
              <span className="text-sm text-foreground font-mono">{sale.invoiceNo || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Sale Date & Time</span>
              </div>
              <span className="text-sm text-foreground">{formatDate(sale.purchaseDate)}</span>
            </div>
            {sale.purchaseId && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Circle className="w-4 h-4" />
                  <span className="text-sm">Linked Purchase ID</span>
                </div>
                <span className="text-sm text-foreground font-mono">{sale.purchaseId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Details */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Pricing Details</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <IndianRupee className="w-4 h-4" />
                <span className="text-sm">Actual Price</span>
              </div>
              <span className="text-sm text-foreground">{formatCurrency(sale.actualPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span className="text-sm">Production Cost</span>
              </div>
              <span className="text-sm text-foreground">{formatCurrency(sale.productionCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Selling Price</span>
              </div>
              <span className="text-sm text-foreground">{formatCurrency(sale.sellingPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Percent className="w-4 h-4" />
                <span className="text-sm">Discount</span>
              </div>
              <span className="text-sm text-foreground">{sale.discount || '0'}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Final Amount</span>
              </div>
              <span className="text-sm text-foreground font-semibold">{formatCurrency(sale.finalAmount || sale.sellingPrice)}</span>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-foreground">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${profit.amount >= 0 ? 'bg-green-500/20 text-foreground' : 'bg-red-500/20 text-foreground'}`}>
                    {profit.amount >= 0 ? '↑' : '↓'}
                  </div>
                  <span className="text-sm">Profit/Loss</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${profit.amount >= 0 ? 'text-foreground' : 'text-foreground'}`}>
                    {profit.amount >= 0 ? '+' : ''}{formatCurrency(profit.amount.toString())}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profit.percentage >= 0 ? '+' : ''}{profit.percentage.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Receipt Image Section */}
        <div className="bg-cms-card rounded-xl p-5 border border-border">
          <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Receipt Image</h3>
          
          {receiptUrl ? (
            <div className="space-y-4">
              <div className="relative bg-cms-input-bg rounded-lg border-2 border-dashed border-border p-4">
                {isReceiptPDF ? (
                  <div className="flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">PDF Receipt</p>
                    <p className="text-xs text-muted-foreground mt-1">Click to download PDF document</p>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={receiptUrl}
                      alt={`Receipt for Invoice #${sale.invoiceNo}`}
                      className="w-full h-48 object-contain rounded-md border border-border"
                      onError={(e) => {
                        console.error('Receipt image loading failed:', e);
                        setReceiptImageError(true);
                      }}
                    />
                    {receiptImageError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-cms-input-bg rounded-md">
                        <div className="text-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Failed to load receipt</p>
                          <button
                            onClick={() => {
                              setReceiptImageError(false);
                              const img = document.querySelector('img[alt*="Receipt for Invoice"]') as HTMLImageElement;
                              if (img) {
                                img.src = receiptUrl + '?t=' + Date.now();
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
                  <span className="text-sm text-muted-foreground">Invoice:</span>
                  <span className="text-sm font-medium text-foreground">{sale.invoiceNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">File Path:</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={sale.receiptImage || ''}>
                    {sale.receiptImage ? sale.receiptImage.split('/').pop() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Uploaded:</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(sale.createdAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleViewReceipt}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={handleDownloadReceipt}
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
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h4 className="text-base font-medium text-foreground mb-2">No Receipt Uploaded</h4>
              <p className="text-sm text-muted-foreground">
                No receipt image was uploaded for this sale.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Details - Only show if vehicle data exists */}
      {hasVehicleData ? (
        <div className="bg-cms-card rounded-xl p-5 border border-border mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Vehicle Details
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-cms-sidebar text-foreground px-2 py-1 rounded border border-border">
                {vehicleData?.source === 'purchase' ? 'From Linked Purchase' : 
                 vehicleData?.source === 'sale-vehicleDetails' ? 'From Sale (Nested)' : 
                 vehicleData?.source === 'material-match' ? 'From Material Match' :
                 'From Sale (Direct)'}
              </span>
              {vehicleData?.source === 'purchase' && sale.purchaseId && (
                <span className="text-xs bg-cms-sidebar text-foreground px-2 py-1 rounded border border-border">
                  Purchase ID: {sale.purchaseId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {vehicleData?.vehicleName && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Truck className="w-4 h-4" />
                    <span className="text-sm">Vehicle Name</span>
                  </div>
                  <span className="text-sm text-foreground">{vehicleData.vehicleName}</span>
                </div>
              )}
              {vehicleData?.vehicleType && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Vehicle Type</span>
                  </div>
                  <span className="text-sm text-foreground">{vehicleData.vehicleType}</span>
                </div>
              )}
              {vehicleData?.vehicleNumber && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm">Vehicle Number</span>
                  </div>
                  <span className="text-sm text-foreground font-mono">{vehicleData.vehicleNumber}</span>
                </div>
              )}
              {vehicleData?.vehicleColor && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Palette className="w-4 h-4" />
                    <span className="text-sm">Vehicle Color</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full border border-border"
                      style={{ backgroundColor: vehicleData.vehicleColor || '#FFFFFF' }}
                    />
                    <span className="text-sm text-foreground">{getColorName(vehicleData.vehicleColor)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {vehicleData?.driverName && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Driver Name</span>
                  </div>
                  <span className="text-sm text-foreground">{vehicleData.driverName}</span>
                </div>
              )}
              {vehicleData?.deliveryDate && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Delivery Date & Time</span>
                  </div>
                  <span className="text-sm text-foreground">{formatDate(vehicleData.deliveryDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Image Section */}
          {imageUrl ? (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">Vehicle Image</h4>
              <div className="rounded-xl overflow-hidden border border-border max-w-md">
                <img 
                  src={imageUrl}
                  alt={`${vehicleData?.vehicleName || 'Vehicle'}`} 
                  className="w-full h-48 object-cover"
                  onError={() => {
                    setImageError(true);
                  }}
                />
              </div>
              {imageError && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-600">
                    Could not load vehicle image.
                  </p>
                </div>
              )}
            </div>
          ) : vehicleData?.vehicleName ? (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold text-foreground mb-3">Vehicle Image</h4>
              <div className="w-full max-w-md h-48 bg-cms-card-hover border border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                <Truck className="w-12 h-12 mb-2" />
                <p>No vehicle image uploaded</p>
                <p className="text-xs mt-1">{vehicleData.vehicleName}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-yellow-700 mb-1">No Vehicle Information</h4>
              <p className="text-sm text-yellow-600">
                This sale does not have vehicle details assigned. 
                {sale.purchaseId ? ' The linked purchase might not have vehicle data.' : ' You can add vehicle details when editing the sale.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buyer Details */}
      <div className="bg-cms-card rounded-xl p-5 border border-border mb-6">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Buyer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">Buyer Name</span>
              </div>
              <span className="text-sm text-foreground">{sale.buyerName || 'N/A'}</span>
            </div>
            {sale.buyerCompany && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-sm">Company</span>
                </div>
                <span className="text-sm text-foreground">{sale.buyerCompany}</span>
              </div>
            )}
            {sale.buyerCnic && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm">CNIC</span>
                </div>
                <span className="text-sm text-foreground">{sale.buyerCnic}</span>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {sale.buyerPhone && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm">Phone</span>
                </div>
                <span className="text-sm text-foreground">{sale.buyerPhone}</span>
              </div>
            )}
            {sale.buyerEmail && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Email</span>
                </div>
                <span className="text-sm text-foreground">{sale.buyerEmail}</span>
              </div>
            )}
            {sale.buyerAddress && (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5" />
                  <span className="text-sm">Address</span>
                </div>
                <span className="text-sm text-foreground text-right max-w-[200px]">{sale.buyerAddress}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-cms-card rounded-xl p-5 border border-border">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Additional Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Record Created</label>
            <p className="text-sm text-foreground mt-1">{formatDate(sale.createdAt)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Last Updated</label>
            <p className="text-sm text-foreground mt-1">{formatDate(sale.updatedAt)}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Database ID</label>
            <p className="text-sm text-foreground mt-1 font-mono">{sale._id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}