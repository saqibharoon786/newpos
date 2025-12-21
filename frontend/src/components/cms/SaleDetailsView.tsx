import { useState, useEffect } from "react";
import { Pencil, Printer, Trash2, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, User, CreditCard, ArrowLeft, Loader2, FileText, Mail, Phone, MapPin, Briefcase, Tag, Percent, DollarSign, Package, Building, Truck, Settings, AlertCircle, Car } from "lucide-react";
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
  
  // Vehicle Details (might be stored in separate fields or as nested object)
  vehicleName?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  driverName?: string;
  vehicleColor?: string;
  deliveryDate?: string;
  vehicleImage?: string;
  
  // Some APIs might store vehicle info in a nested object
  vehicleDetails?: {
    vehicleName?: string;
    vehicleType?: string;
    vehicleNumber?: string;
    driverName?: string;
    vehicleColor?: string;
    deliveryDate?: string;
    vehicleImage?: string;
  };
  
  // Purchase reference (if sale is linked to a purchase)
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
  const [relatedPurchase, setRelatedPurchase] = useState<any>(null);
  const [loadingPurchase, setLoadingPurchase] = useState(false);

  // Fetch sale details by ID
  useEffect(() => {
    if (saleId) {
      fetchSaleDetails();
    }
  }, [saleId]);

  // Debug: Log what we're trying to fetch
  useEffect(() => {
    console.log('Fetching sale details for ID:', saleId);
    console.log('API URL:', `${SALES_API_URL}/${saleId}`);
    console.log('API Base URL:', API_BASE_URL);
  }, [saleId]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      setImageError(false);
      
      console.log('Making API request to:', `${SALES_API_URL}/${saleId}`);
      
      const response = await api.get(`${SALES_API_URL}/${saleId}`);
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        const saleData = response.data.data;
        console.log('Sale data received:', saleData);
        
        // Log ALL properties of the sale object to see what's available
        console.log('All sale properties:');
        Object.keys(saleData).forEach(key => {
          console.log(`${key}:`, saleData[key]);
        });
        
        // Log vehicle-related properties specifically
        console.log('Vehicle-related properties:');
        const vehicleKeys = [
          'vehicleName', 'vehicleType', 'vehicleNumber', 'driverName', 
          'vehicleColor', 'deliveryDate', 'vehicleImage', 'vehicleDetails'
        ];
        vehicleKeys.forEach(key => {
          console.log(`${key}:`, saleData[key]);
        });
        
        setSale(saleData);
        
        // Check if we have vehicle data in the sale
        const hasVehicleInSale = vehicleKeys.some(key => saleData[key]);
        console.log('Has vehicle data in sale:', hasVehicleInSale);
        
      } else {
        throw new Error(response.data.message || 'Failed to fetch sale details');
      }
    } catch (error: any) {
      console.error('Error fetching sale details:', error);
      console.error('Error response:', error.response);
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

  const fetchRelatedPurchase = async (purchaseId: string) => {
    try {
      setLoadingPurchase(true);
      console.log('Fetching related purchase:', purchaseId);
      
      const response = await api.get(`${PURCHASE_API_URL}/${purchaseId}`);
      
      if (response.data.success) {
        console.log('Related purchase data:', response.data.data);
        setRelatedPurchase(response.data.data);
        
        // Log purchase vehicle data
        const purchase = response.data.data;
        console.log('Purchase vehicle data:', {
          vehicleName: purchase.vehicleName,
          vehicleNumber: purchase.vehicleNumber,
          driverName: purchase.driverName,
          vehicleColor: purchase.vehicleColor
        });
      }
    } catch (error) {
      console.error('Error fetching related purchase:', error);
    } finally {
      setLoadingPurchase(false);
    }
  };

  // Helper function to get image URL
  const getImageUrl = (imagePath: string | undefined): string | null => {
    if (!imagePath) return null;
    
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

  // Get all vehicle data from sale (including nested vehicleDetails)
  const getVehicleDataFromSale = () => {
    if (!sale) return null;
    
    // Check if vehicle data is in nested vehicleDetails object
    if (sale.vehicleDetails && typeof sale.vehicleDetails === 'object') {
      console.log('Found vehicle data in vehicleDetails object:', sale.vehicleDetails);
      return {
        source: 'sale-vehicleDetails',
        vehicleName: sale.vehicleDetails.vehicleName,
        vehicleType: sale.vehicleDetails.vehicleType,
        vehicleNumber: sale.vehicleDetails.vehicleNumber,
        driverName: sale.vehicleDetails.driverName,
        vehicleColor: sale.vehicleDetails.vehicleColor,
        deliveryDate: sale.vehicleDetails.deliveryDate,
        vehicleImage: sale.vehicleDetails.vehicleImage ? getImageUrl(sale.vehicleDetails.vehicleImage) : null
      };
    }
    
    // Check if vehicle data is in direct properties
    const directVehicleData = {
      vehicleName: sale.vehicleName,
      vehicleType: sale.vehicleType,
      vehicleNumber: sale.vehicleNumber,
      driverName: sale.driverName,
      vehicleColor: sale.vehicleColor,
      deliveryDate: sale.deliveryDate,
      vehicleImage: sale.vehicleImage ? getImageUrl(sale.vehicleImage) : null
    };
    
    const hasDirectData = Object.values(directVehicleData).some(val => val);
    if (hasDirectData) {
      console.log('Found vehicle data in direct properties:', directVehicleData);
      return {
        source: 'sale-direct',
        ...directVehicleData
      };
    }
    
    return null;
  };

  // Check if we have any vehicle data from any source
  const getVehicleData = () => {
    if (!sale) return null;
    
    // First, check if sale has vehicle data
    const saleVehicleData = getVehicleDataFromSale();
    if (saleVehicleData) {
      return saleVehicleData;
    }
    
    // If no sale vehicle data, check related purchase
    if (relatedPurchase) {
      console.log('Using vehicle data from related purchase:', {
        vehicleName: relatedPurchase.vehicleName,
        vehicleNumber: relatedPurchase.vehicleNumber,
        driverName: relatedPurchase.driverName
      });
      
      return {
        source: 'purchase',
        vehicleName: relatedPurchase.vehicleName,
        vehicleType: relatedPurchase.vehicleType,
        vehicleNumber: relatedPurchase.vehicleNumber,
        driverName: relatedPurchase.driverName,
        vehicleColor: relatedPurchase.vehicleColor,
        deliveryDate: relatedPurchase.deliveryDate,
        vehicleImage: relatedPurchase.vehicleImage ? getImageUrl(relatedPurchase.vehicleImage) : null
      };
    }
    
    return null;
  };

  // Check if we have any vehicle data
  const hasVehicleData = () => {
    const vehicleData = getVehicleData();
    return vehicleData !== null;
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
  const vehicleData = getVehicleData();
  const imageUrl = vehicleData?.vehicleImage;

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
  const vehicleExists = hasVehicleData();

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sale Record Details</h1>
          <p className="text-sm text-muted-foreground">Complete details for sale invoice #{sale.invoiceNo}</p>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">
              Invoice: {sale.invoiceNo}
            </span>
            <span className="text-xs bg-green-500/10 text-green-600 px-3 py-1 rounded-full">
              Sale Date: {formatDate(sale.purchaseDate)}
            </span>
            <span className={`text-xs px-3 py-1 rounded-full ${profit.amount >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              Profit: {profit.amount >= 0 ? '+' : ''}{formatCurrency(profit.amount.toString())}
            </span>
            {vehicleExists && (
              <span className="text-xs bg-blue-500/10 text-blue-600 px-3 py-1 rounded-full flex items-center gap-1">
                <Car className="w-3 h-3" />
                Vehicle: {vehicleData?.vehicleNumber || vehicleData?.vehicleName || 'Assigned'}
              </span>
            )}
            {sale.purchaseId && (
              <span className="text-xs bg-purple-500/10 text-purple-600 px-3 py-1 rounded-full">
                Linked to Purchase
              </span>
            )}
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
            Print Invoice
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
              <span className="text-sm text-foreground">{sale.weight || '0'} {sale.unit || 'kg'}</span>
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
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${profit.amount >= 0 ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                    {profit.amount >= 0 ? '↑' : '↓'}
                  </div>
                  <span className="text-sm">Profit/Loss</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${profit.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
      </div>

      {/* Vehicle Details - Only show if vehicle data exists */}
      {vehicleExists ? (
        <div className="bg-cms-card rounded-xl p-5 border border-border mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Vehicle Details
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-1 rounded">
                {vehicleData?.source === 'purchase' ? 'From Linked Purchase' : 
                 vehicleData?.source === 'sale-vehicleDetails' ? 'From Sale (Nested)' : 
                 'From Sale (Direct)'}
              </span>
              {vehicleData?.source === 'purchase' && sale.purchaseId && (
                <span className="text-xs bg-purple-500/10 text-purple-600 px-2 py-1 rounded">
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
                  onError={(e) => {
                    console.error('Image failed to load:', imageUrl);
                    setImageError(true);
                  }}
                />
              </div>
              {imageError && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-600">
                    Could not load vehicle image. Check if the file exists in the uploads directory.
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
              <div className="mt-2 text-xs text-yellow-500">
                <p>Vehicle data sources checked:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>Direct sale properties (vehicleName, vehicleNumber, etc.)</li>
                  <li>Nested vehicleDetails object</li>
                  <li>Linked purchase (ID: {sale.purchaseId || 'none'})</li>
                </ul>
              </div>
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

      {/* Debug Panel - Always visible for now to help debug */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Debug Information</h4>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">Sale ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{saleId}</code></p>
          <p className="text-xs text-gray-600">Purchase ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{sale.purchaseId || 'null'}</code></p>
          <p className="text-xs text-gray-600">Invoice No: <code className="bg-gray-100 px-1 py-0.5 rounded">{sale.invoiceNo || 'null'}</code></p>
          <p className="text-xs text-gray-600">Material: <code className="bg-gray-100 px-1 py-0.5 rounded">{sale.materialName || 'null'}</code></p>
          <p className="text-xs text-gray-600">Vehicle Exists: <code className="bg-gray-100 px-1 py-0.5 rounded">{vehicleExists ? 'true' : 'false'}</code></p>
          <p className="text-xs text-gray-600">Vehicle Data Source: <code className="bg-gray-100 px-1 py-0.5 rounded">{vehicleData?.source || 'none'}</code></p>
          <p className="text-xs text-gray-600">Vehicle Name: <code className="bg-gray-100 px-1 py-0.5 rounded">{vehicleData?.vehicleName || 'null'}</code></p>
          <p className="text-xs text-gray-600">Vehicle Number: <code className="bg-gray-100 px-1 py-0.5 rounded">{vehicleData?.vehicleNumber || 'null'}</code></p>
          <p className="text-xs text-gray-600">Driver Name: <code className="bg-gray-100 px-1 py-0.5 rounded">{vehicleData?.driverName || 'null'}</code></p>
          <p className="text-xs text-gray-600">API Base URL: <code className="bg-gray-100 px-1 py-0.5 rounded">{API_BASE_URL}</code></p>
          <p className="text-xs text-gray-600">Sales API: <code className="bg-gray-100 px-1 py-0.5 rounded">{SALES_API_URL}</code></p>
          <p className="text-xs text-gray-600">Purchase API: <code className="bg-gray-100 px-1 py-0.5 rounded">{PURCHASE_API_URL}</code></p>
          <button
            onClick={() => {
              console.log('=== FULL SALE DATA ===');
              console.log(sale);
              console.log('=== VEHICLE DATA ===');
              console.log(vehicleData);
              console.log('=== RELATED PURCHASE ===');
              console.log(relatedPurchase);
              console.log('=== API CONFIGURATION ===');
              console.log('API Base URL:', API_BASE_URL);
              console.log('Sales API URL:', SALES_API_URL);
              console.log('Purchase API URL:', PURCHASE_API_URL);
            }}
            className="text-xs text-blue-500 hover:text-blue-600 underline"
          >
            Log all data to console
          </button>
          <button
            onClick={fetchSaleDetails}
            className="text-xs text-green-500 hover:text-green-600 underline ml-4"
          >
            Refresh Data
          </button>
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
            
            /* Invoice specific styles */
            .invoice-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .invoice-title {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .invoice-subtitle {
              font-size: 14px;
              color: #666;
              margin-bottom: 20px;
            }
            .invoice-details {
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .invoice-total {
              font-size: 18px;
              font-weight: bold;
              text-align: right;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #000;
            }
          }
        `}
      </style>
    </div>
  );
}