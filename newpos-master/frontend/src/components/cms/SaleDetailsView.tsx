import { useState, useEffect } from "react";
import { Printer, Circle, Scale, Palette, Building2, Award, IndianRupee, Calendar, User, CreditCard, ArrowLeft, Loader2, Mail, Phone, MapPin, Briefcase, Tag, Percent, DollarSign, Package, Building, Truck, Settings, AlertCircle, Car, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import api, { API_BASE_URL } from "@/lib/api";

const SALES_API_URL = "/api/sales";
const PURCHASE_API_URL = "/api/purchases";

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
  const [vehicleData, setVehicleData] = useState<any>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(false);
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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sale Details - ${sale?.invoiceNo || 'Invoice'}</title>
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
            
            .profit-positive {
              color: #059669;
              font-weight: bold;
            }
            
            .profit-negative {
              color: #dc2626;
              font-weight: bold;
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
            <h1>Sale Record Details</h1>
            <div class="subtitle">Complete details for sale invoice #${sale?.invoiceNo || 'N/A'}</div>
            <div class="print-badges">
              <span class="print-badge">Invoice: ${sale?.invoiceNo || 'N/A'}</span>
              <span class="print-badge">Sale Date: ${formatDate(sale?.purchaseDate || '')}</span>
              <span class="print-badge ${profit.amount >= 0 ? 'profit-positive' : 'profit-negative'}">
                Profit: ${profit.amount >= 0 ? '+' : ''}${formatCurrency(profit.amount.toString())}
              </span>
              ${hasVehicleData ? '<span class="print-badge">Vehicle: Assigned</span>' : ''}
              ${sale?.purchaseId ? '<span class="print-badge">Linked to Purchase</span>' : ''}
              ${sale?.receiptImage ? '<span class="print-badge">Receipt: Available</span>' : ''}
            </div>
          </div>
          
          <div class="print-grid">
            <!-- Product & Sale Details -->
            <div class="print-section">
              <h3>Product & Sale Details</h3>
              <div class="print-row">
                <span class="print-label">Material Name:</span>
                <span class="print-value">${sale?.materialName || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Weight:</span>
                <span class="print-value">${sale?.weight || '0'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Units:</span>
                <span class="print-value">${sale?.unit || '0'} units</span>
              </div>
              <div class="print-row">
                <span class="print-label">Color:</span>
                <span class="print-value">
                  <span class="color-dot" style="background-color: ${sale?.materialColor || '#FFFFFF'};"></span>
                  ${getColorName(sale?.materialColor || '')}
                </span>
              </div>
              <div class="print-row">
                <span class="print-label">Supplier:</span>
                <span class="print-value">${sale?.supplierName || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Branch:</span>
                <span class="print-value">${sale?.branch || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Invoice Number:</span>
                <span class="print-value">${sale?.invoiceNo || 'N/A'}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Sale Date:</span>
                <span class="print-value">${formatDate(sale?.purchaseDate || '')}</span>
              </div>
              ${sale?.purchaseId ? `
              <div class="print-row">
                <span class="print-label">Linked Purchase ID:</span>
                <span class="print-value">${sale.purchaseId}</span>
              </div>` : ''}
            </div>
            
            <!-- Pricing Details -->
            <div class="print-section">
              <h3>Pricing Details</h3>
              <div class="print-row">
                <span class="print-label">Selling Price:</span>
                <span class="print-value">${formatCurrency(sale?.sellingPrice || '0')}</span>
              </div>
              <div class="print-row">
                <span class="print-label">Discount:</span>
                <span class="print-value">${sale?.discount || '0'}%</span>
              </div>
              <div class="print-row">
                <span class="print-label">Final Amount:</span>
                <span class="print-value">${formatCurrency(sale?.finalAmount || sale?.sellingPrice || '0')}</span>
              </div>
              <div class="print-row" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <span class="print-label">Profit/Loss:</span>
                <span class="print-value ${profit.amount >= 0 ? 'profit-positive' : 'profit-negative'}">
                  ${profit.amount >= 0 ? '+' : ''}${formatCurrency(profit.amount.toString())}
                  <span style="display: block; font-size: 9px; color: #666;">
                    (${profit.percentage >= 0 ? '+' : ''}${profit.percentage.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>
            
            <!-- Receipt Image -->
            <div class="print-section">
              <h3>Receipt Image</h3>
              ${receiptUrl && !receiptUrl.toLowerCase().endsWith('.pdf') ? 
                `<div class="print-image-container">
                  <img src="${receiptUrl}" alt="Receipt" class="print-image" onerror="this.style.display='none';this.parentElement.innerHTML='<p>Image not available</p>';" />
                </div>` : 
                `<div class="print-image-container">
                  <p>${sale?.receiptImage ? 'Image not available for printing' : 'No receipt was uploaded'}</p>
                </div>`
              }
              <div style="margin-top: 10px;">
                <div class="print-row">
                  <span class="print-label">Invoice:</span>
                  <span class="print-value">${sale?.invoiceNo || 'N/A'}</span>
                </div>
                <div class="print-row">
                  <span class="print-label">File:</span>
                  <span class="print-value">${sale?.receiptImage ? sale.receiptImage.split('/').pop() : 'N/A'}</span>
                </div>
                <div class="print-row">
                  <span class="print-label">Uploaded:</span>
                  <span class="print-value">${formatDate(sale?.createdAt || '')}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Vehicle Details -->
          ${hasVehicleData ? `
          <div class="print-section" style="margin-top: 15px;">
            <h3>Vehicle Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                ${vehicleData?.vehicleName ? `
                <div class="print-row">
                  <span class="print-label">Vehicle Name:</span>
                  <span class="print-value">${vehicleData.vehicleName}</span>
                </div>` : ''}
                ${vehicleData?.vehicleType ? `
                <div class="print-row">
                  <span class="print-label">Vehicle Type:</span>
                  <span class="print-value">${vehicleData.vehicleType}</span>
                </div>` : ''}
                ${vehicleData?.vehicleNumber ? `
                <div class="print-row">
                  <span class="print-label">Vehicle Number:</span>
                  <span class="print-value">${vehicleData.vehicleNumber}</span>
                </div>` : ''}
                ${vehicleData?.vehicleColor ? `
                <div class="print-row">
                  <span class="print-label">Vehicle Color:</span>
                  <span class="print-value">
                    <span class="color-dot" style="background-color: ${vehicleData.vehicleColor || '#FFFFFF'};"></span>
                    ${getColorName(vehicleData.vehicleColor)}
                  </span>
                </div>` : ''}
              </div>
              <div>
                ${vehicleData?.driverName ? `
                <div class="print-row">
                  <span class="print-label">Driver Name:</span>
                  <span class="print-value">${vehicleData.driverName}</span>
                </div>` : ''}
                ${vehicleData?.deliveryDate ? `
                <div class="print-row">
                  <span class="print-label">Delivery Date:</span>
                  <span class="print-value">${formatDate(vehicleData.deliveryDate)}</span>
                </div>` : ''}
              </div>
            </div>
            <div class="print-row" style="margin-top: 5px;">
              <span class="print-label">Source:</span>
              <span class="print-value">
                ${vehicleData?.source === 'purchase' ? 'From Linked Purchase' : 
                 vehicleData?.source === 'sale-vehicleDetails' ? 'From Sale (Nested)' : 
                 vehicleData?.source === 'material-match' ? 'From Material Match' :
                 'From Sale (Direct)'}
              </span>
            </div>
          </div>` : ''}
          
          <!-- Customer Information -->
          <div class="print-section" style="margin-top: 15px;">
            <h3>Customer Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <div class="print-row">
                  <span class="print-label">Customer Name:</span>
                  <span class="print-value">${sale?.buyerName || 'N/A'}</span>
                </div>
                ${sale?.buyerCompany ? `
                <div class="print-row">
                  <span class="print-label">Company:</span>
                  <span class="print-value">${sale.buyerCompany}</span>
                </div>` : ''}
                ${sale?.buyerCnic ? `
                <div class="print-row">
                  <span class="print-label">CNIC:</span>
                  <span class="print-value">${sale.buyerCnic}</span>
                </div>` : ''}
              </div>
              <div>
                ${sale?.buyerPhone ? `
                <div class="print-row">
                  <span class="print-label">Phone:</span>
                  <span class="print-value">${sale.buyerPhone}</span>
                </div>` : ''}
                ${sale?.buyerEmail ? `
                <div class="print-row">
                  <span class="print-label">Email:</span>
                  <span class="print-value">${sale.buyerEmail}</span>
                </div>` : ''}
                ${sale?.buyerAddress ? `
                <div class="print-row">
                  <span class="print-label">Address:</span>
                  <span class="print-value" style="text-align: right;">${sale.buyerAddress}</span>
                </div>` : ''}
              </div>
            </div>
          </div>
          
          <!-- Additional Information -->
          <div class="print-additional">
            <h3 style="font-size: 13px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Additional Information</h3>
            <div class="print-additional-grid">
              <div>
                <div class="print-label">Record Created</div>
                <div class="print-value" style="font-size: 11px;">${formatDate(sale?.createdAt || '')}</div>
              </div>
              <div>
                <div class="print-label">Last Updated</div>
                <div class="print-value" style="font-size: 11px;">${formatDate(sale?.updatedAt || '')}</div>
              </div>
              <div>
                <div class="print-label">Database ID</div>
                <div class="print-value" style="font-size: 10px; font-family: monospace;">${sale?._id}</div>
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
      if (isNaN(numAmount)) return 'Rs. 0';
      return `Rs. ${numAmount.toLocaleString('en-PK')}`;
    } catch (error) {
      return `Rs. ${amount}`;
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
  const profit = calculateProfit();

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

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Back Button */}
      <div className="mb-6 no-print">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors back-button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sales List
        </button>
      </div>

      {/* Breadcrumb */}
      <p className="text-sm text-muted-foreground mb-6 no-print">Point of Sale / Details</p>

      {/* Header */}
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
        <div className="flex items-center gap-3 no-print">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors print-button"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
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
                {receiptUrl.toLowerCase().endsWith('.pdf') ? (
                  <div className="flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground">PDF Receipt</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF file cannot be previewed</p>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={receiptUrl}
                      alt={`Receipt for Invoice #${sale.invoiceNo}`}
                      className="w-full h-48 object-contain rounded-md border border-border"
                      onError={(e) => {
                        console.error('Receipt image loading failed:', e);
                      }}
                    />
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
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-cms-input-bg rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
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

      {/* Customer Details */}
      <div className="bg-cms-card rounded-xl p-5 border border-border mb-6">
        <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Customer Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-sm">Customer Name</span>
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