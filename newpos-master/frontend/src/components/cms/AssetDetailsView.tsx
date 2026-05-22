import { useState, useEffect } from "react";
import { Printer, IndianRupee, Building2, FileText, Calendar, Package, Settings, Box, Cpu, CheckCircle, AlignLeft, Building, User, ArrowLeft, Loader2, Image, Download, Eye } from "lucide-react";
import api, { API_BASE_URL } from "@/lib/api";

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
  receiptImage?: string;
  receiptImageDetails?: {
    originalName?: string;
    path?: string;
    size?: number;
    mimetype?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const UPLOAD_BASE = API_BASE_URL || "";

interface AssetDetailsViewProps {
  onBack: () => void;
  assetId: string;
}

export function AssetDetailsView({ onBack, assetId }: AssetDetailsViewProps) {
  const [asset, setAsset] = useState<AssetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // Helper function to get receipt image URL
  const getReceiptImageUrl = (filename?: string) => {
    if (!filename) {
      console.log("📸 No filename provided");
      return null;
    }
    
    console.log("📸 Raw filename from database:", filename);
    
    let cleanFilename = filename;
    
    // Case 1: If it's a full URL (shouldn't happen, but handle it)
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      console.log("📸 Already a full URL, returning as-is");
      return filename;
    }
    
    // Case 2: If it's an absolute path on filesystem
    if (filename.includes('\\')) {
      // Windows path, extract filename
      const parts = filename.split('\\');
      cleanFilename = parts[parts.length - 1];
      console.log("📸 Extracted from Windows path:", cleanFilename);
    }
    
    // Case 3: If it's a Unix path
    if (filename.includes('/')) {
      const parts = filename.split('/');
      cleanFilename = parts[parts.length - 1];
      console.log("📸 Extracted from Unix path:", cleanFilename);
    }
    
    // Remove any directory prefixes
    const prefixesToRemove = [
      'uploads/receipts/',
      'uploads\\receipts\\',
      'receipts/',
      'receipts\\',
      './uploads/receipts/',
      './uploads\\receipts\\'
    ];
    
    for (const prefix of prefixesToRemove) {
      if (cleanFilename.startsWith(prefix)) {
        cleanFilename = cleanFilename.substring(prefix.length);
        console.log(`📸 Removed prefix "${prefix}":`, cleanFilename);
      }
    }
    
    // Construct the URL
    const receiptUrl = `${UPLOAD_BASE}/uploads/general/${cleanFilename}`;
    console.log("📸 Final URL:", receiptUrl);
    
    return receiptUrl;
  };

  // Function to download receipt
  const downloadReceipt = () => {
    if (!asset?.receiptImage) return;
    
    const receiptUrl = getReceiptImageUrl(asset.receiptImage);
    if (!receiptUrl) return;
    
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = receiptUrl;
    link.download = asset.receiptImage || 'receipt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Professional Print Function - One Page
  const handleProfessionalPrint = () => {
    if (!asset) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Format date for printing
    const formatDateForPrint = (dateString: string) => {
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch (error) {
        return dateString;
      }
    };

    // Format price for printing
    const formatPrice = (price?: number) => {
      if (!price) return 'N/A';
      return `Rs. ${price.toLocaleString()}`;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Asset Details - ${asset.assetName}</title>
        <style>
          @media print {
            @page {
              margin: 10mm;
              size: A4 portrait;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              font-size: 9pt;
              line-height: 1.3;
              color: #333;
              background: white;
            }
            
            .print-header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 10px;
              border-bottom: 1.5px solid #333;
            }
            
            .report-title {
              font-size: 14pt;
              font-weight: bold;
              color: #1a365d;
              margin: 0 0 5px 0;
            }
            
            .asset-name {
              font-size: 11pt;
              color: #4a5568;
              margin: 0 0 8px 0;
            }
            
            .report-meta {
              font-size: 8pt;
              color: #718096;
              margin-bottom: 5px;
            }
            
            /* Compact grid for one page */
            .details-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin: 15px 0;
            }
            
            .details-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 12px;
              page-break-inside: avoid;
            }
            
            .section-title {
              font-size: 10pt;
              font-weight: 600;
              color: #2d3748;
              margin: 0 0 8px 0;
              padding-bottom: 5px;
              border-bottom: 1px solid #cbd5e0;
            }
            
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              font-size: 8.5pt;
            }
            
            .detail-row:last-child {
              margin-bottom: 0;
            }
            
            .detail-label {
              color: #4a5568;
              font-weight: 500;
              min-width: 120px;
            }
            
            .detail-value {
              color: #1a202c;
              font-weight: 600;
              text-align: right;
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            /* Status badges - compact */
            .status-badge {
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 7.5pt;
              font-weight: 500;
              display: inline-block;
            }
            
            .condition-new { background: #c6f6d5; color: #22543d; }
            .condition-good { background: #bee3f8; color: #2c5282; }
            .condition-fair { background: #fefcbf; color: #744210; }
            .condition-poor { background: #fed7d7; color: #9b2c2c; }
            
            .status-active { background: #c6f6d5; color: #22543d; }
            .status-inactive { background: #fed7d7; color: #9b2c2c; }
            
            /* Receipt section - compact */
            .receipt-section {
              margin: 12px 0;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 12px;
              page-break-inside: avoid;
            }
            
            .receipt-info {
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
              margin-bottom: 8px;
            }
            
            .receipt-placeholder {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 3px;
              padding: 15px;
              text-align: center;
              font-size: 8pt;
              color: #718096;
              margin: 8px 0;
            }
            
            /* Additional info section */
            .additional-section {
              margin: 12px 0;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 12px;
              page-break-inside: avoid;
            }
            
            /* Signature area - compact */
            .signature-area {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #cbd5e0;
              display: flex;
              justify-content: space-between;
              font-size: 8pt;
            }
            
            .signature-box {
              text-align: center;
              width: 48%;
            }
            
            .signature-line {
              margin-top: 25px;
              border-top: 1px solid #666;
              padding-top: 8px;
              font-size: 8pt;
            }
            
            /* Footer */
            .footer {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px solid #cbd5e0;
              text-align: center;
              font-size: 7pt;
              color: #718096;
            }
            
            /* Hide unnecessary elements */
            .no-print, button, nav, .print-button, .back-button {
              display: none !important;
            }
            
            /* Prevent page breaks */
            * {
              page-break-inside: avoid;
            }
            
            /* Control spacing */
            .spacing-control {
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-container spacing-control">
          <!-- Header - No Company Name -->
          <div class="print-header">
            <h1 class="report-title">Asset Details Report</h1>
            <h2 class="asset-name">${asset.assetName}</h2>
            <div class="report-meta">
              Generated: ${currentDate} ${currentTime} | Asset ID: ${asset._id.substring(0, 12)}
            </div>
          </div>
          
          <!-- Main Content Grid - Compact -->
          <div class="details-grid">
            <!-- Asset Details -->
            <div class="details-section">
              <div class="section-title">Asset Information</div>
              
              <div class="detail-row">
                <span class="detail-label">Asset Name:</span>
                <span class="detail-value">${asset.assetName}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${asset.category}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Quantity:</span>
                <span class="detail-value">${asset.quantity}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Model/Size:</span>
                <span class="detail-value">${asset.sizeModel || 'N/A'}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${asset.description || 'N/A'}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Condition:</span>
                <span class="detail-value">
                  <span class="status-badge condition-${asset.condition.toLowerCase()}">
                    ${asset.condition}
                  </span>
                </span>
              </div>
            </div>
            
            <!-- Purchase Details -->
            <div class="details-section">
              <div class="section-title">Purchase Details</div>
              
              <div class="detail-row">
                <span class="detail-label">Purchase Price:</span>
                <span class="detail-value">${formatPrice(asset.purchasePrice)}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Purchased From:</span>
                <span class="detail-value">${asset.purchaseFrom || 'N/A'}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${asset.invoiceNo || 'N/A'}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Purchase Date:</span>
                <span class="detail-value">${formatDateForPrint(asset.purchaseDate)} ${asset.purchaseTime || ''}</span>
              </div>
            </div>
          </div>
          
          <!-- Assigned Details -->
          <div class="details-section">
            <div class="section-title">Assignment Information</div>
            
            <div class="detail-row">
              <span class="detail-label">Department:</span>
              <span class="detail-value">${asset.department}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Assigned To:</span>
              <span class="detail-value">${asset.assignedTo}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value">
                <span class="status-badge status-${(asset.status || 'Active').toLowerCase()}">
                  ${asset.status || 'Active'}
                </span>
              </span>
            </div>
          </div>
          
          <!-- Receipt Section -->
          <div class="receipt-section">
            <div class="section-title">Receipt / Proof of Purchase</div>
            
            <div class="receipt-info">
              <div>
                <strong>File:</strong> ${asset.receiptImage || 'No receipt uploaded'}
              </div>
              ${asset.receiptImageDetails?.size ? `
              <div>
                <strong>Size:</strong> ${formatFileSize(asset.receiptImageDetails.size)}
              </div>
              ` : ''}
            </div>
            
            <div class="receipt-placeholder">
              ${asset.receiptImage ? 'Receipt image would appear here' : 'No receipt available'}
            </div>
          </div>
          
          <!-- Additional Information -->
          <div class="additional-section">
            <div class="section-title">Additional Information</div>
            
            <div class="detail-row">
              <span class="detail-label">Created At:</span>
              <span class="detail-value">${formatDateForPrint(asset.createdAt)}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Last Updated:</span>
              <span class="detail-value">${formatDateForPrint(asset.updatedAt)}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Database ID:</span>
              <span class="detail-value" style="font-family: monospace; font-size: 7.5pt;">${asset._id}</span>
            </div>
          </div>
          
          <!-- Signature Area - Compact -->
          <div class="signature-area">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="margin-top: 4px;">Prepared By</div>
            </div>
            
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="margin-top: 4px;">Authorized By</div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>Computer generated document • Confidential</p>
            <p style="margin-top: 3px;">Page 1 of 1</p>
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
      const response = await api.get(`/api/assets/${assetId}`);
      const result = response.data;

      if (result.success) {
        setAsset(result.data);
        console.log("📦 Asset data loaded successfully");
        console.log("📸 Receipt image filename:", result.data.receiptImage);
        console.log("📸 Full receipt data:", result.data.receiptImageDetails);
        
        if (result.data.receiptImage) {
          const receiptUrl = getReceiptImageUrl(result.data.receiptImage);
          console.log("📸 Receipt URL would be:", receiptUrl);
        }
      } else {
        console.error("❌ API returned error:", result.error);
        throw new Error(result.error || "Failed to fetch asset details");
      }
    } catch (error: any) {
      console.error("❌ Error fetching asset details:", error);
      setError(error.response?.data?.message || error.message || "Failed to load asset details");
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
    if (assetId) {
      api.get(`/api/assets/${assetId}`)
        .then((res) => {
          const data = res.data;
          if (data.success) {
            setAsset(data.data);
            setError(null);
          } else {
            setError(data.error || data.message || "API returned an error");
          }
        })
        .catch((err) => {
          console.error("Manual test - Error:", err);
          setError(err.message || "Failed to connect to server");
        });
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
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                onClick={onBack}
                className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 text-sm"
              >
                Back to Assets List
              </button>
              <button
                onClick={fetchAssetDetails}
                className="px-4 py-2 bg-secondary text-foreground rounded hover:bg-secondary/90 border text-sm"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const receiptUrl = getReceiptImageUrl(asset.receiptImage);
  const isImageFile = asset.receiptImage?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isPdfFile = asset.receiptImage?.match(/\.pdf$/i);

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
          <h1 className="text-2xl font-bold text-foreground">Asset Details</h1>
          <p className="text-sm text-muted-foreground">Full details for {asset.assetName}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleProfessionalPrint}
            className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Asset Information */}
        <div className="space-y-6">
          {/* Asset Details Card */}
          <div className="bg-cms-card rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Asset Details</h3>
            <div className="space-y-4">
              <DetailRow icon={<Package className="w-4 h-4" />} label="Asset Name" value={asset.assetName} />
              <DetailRow icon={<Settings className="w-4 h-4" />} label="Category" value={asset.category} />
              <DetailRow icon={<Box className="w-4 h-4" />} label="Quantity" value={asset.quantity.toString()} />
              <DetailRow icon={<Cpu className="w-4 h-4" />} label="Model" value={asset.sizeModel || 'N/A'} />
              <DetailRow icon={<AlignLeft className="w-4 h-4" />} label="Description" value={asset.description || 'No description'} />
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
            </div>
          </div>

          {/* Purchase Details Card */}
          <div className="bg-cms-card rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Purchase Details</h3>
            <div className="space-y-4">
              <DetailRow icon={<IndianRupee className="w-4 h-4" />} label="Purchase Price" 
                value={asset.purchasePrice ? `Rs. ${asset.purchasePrice.toLocaleString()}` : 'N/A'} />
              <DetailRow icon={<Building2 className="w-4 h-4" />} label="Purchase From" value={asset.purchaseFrom || 'N/A'} />
              <DetailRow icon={<FileText className="w-4 h-4" />} label="Invoice No." value={asset.invoiceNo || 'N/A'} />
              <DetailRow icon={<Calendar className="w-4 h-4" />} label="Date & Time" 
                value={formatDateTime(asset.purchaseDate, asset.purchaseTime)} />
            </div>
          </div>

          {/* Assigned Details Card */}
          <div className="bg-cms-card rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border">Assigned Details</h3>
            <div className="space-y-4">
              <DetailRow icon={<Building className="w-4 h-4" />} label="Department" value={asset.department} />
              <DetailRow icon={<User className="w-4 h-4" />} label="Assigned To" value={asset.assignedTo} />
            </div>
          </div>
        </div>

        {/* Right Column - Receipt & Additional Info */}
        <div className="space-y-6">
          {/* Receipt Image Card */}
          <div className="bg-cms-card rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border flex items-center gap-2">
              <Image className="w-4 h-4" />
              Receipt / Proof of Purchase
            </h3>
            
            {asset.receiptImage && receiptUrl ? (
              <div className="space-y-4">
                {/* File Info */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">File:</span>
                  <span className="font-medium text-foreground truncate max-w-xs">
                    {asset.receiptImageDetails?.originalName || asset.receiptImage}
                  </span>
                </div>
                
                {asset.receiptImageDetails?.size && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">File Size:</span>
                    <span className="font-medium text-foreground">
                      {formatFileSize(asset.receiptImageDetails.size)}
                    </span>
                </div>
                )}
                
                {/* Preview Area */}
                <div className="border border-border rounded-lg overflow-hidden bg-gray-50">
                  {isImageFile ? (
                    <div className="relative">
                      <img 
                        src={receiptUrl} 
                        alt="Receipt" 
                        className="w-full h-64 object-contain cursor-pointer"
                        onClick={() => setShowReceiptPreview(true)}
                        onError={(e) => {
                          console.error("❌ Failed to load image:", receiptUrl);
                          (e.target as HTMLImageElement).src = "https://placehold.co/600x400?text=Image+Not+Found";
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                        Click to enlarge
                      </div>
                    </div>
                  ) : isPdfFile ? (
                    <div className="p-6 flex flex-col items-center justify-center h-64">
                      <FileText className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-2">PDF Document</p>
                      <p className="text-sm text-gray-500 text-center mb-4">
                        {asset.receiptImageDetails?.originalName || asset.receiptImage}
                      </p>
                      <a 
                        href={receiptUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md text-sm flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View PDF
                      </a>
                    </div>
                  ) : (
                    <div className="p-6 flex flex-col items-center justify-center h-64">
                      <FileText className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">Document File</p>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReceiptPreview(true)}
                    disabled={!isImageFile}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${
                      isImageFile 
                        ? 'bg-primary hover:bg-primary/90 text-white' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    {isImageFile ? 'Preview' : 'Preview not available'}
                  </button>
                  <button
                    onClick={downloadReceipt}
                    className="flex-1 px-4 py-2 bg-secondary hover:bg-secondary/90 text-foreground rounded-md text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">No Receipt Uploaded</h4>
                <p className="text-xs text-gray-500 mb-4">
                  No receipt or proof of purchase has been uploaded for this asset.
                </p>
                <button
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm"
                  disabled
                >
                  No Receipt Available
                </button>
              </div>
            )}
          </div>

          {/* Additional Information Card */}
          <div className="bg-cms-card rounded-xl p-5">
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
              <DetailRow icon={<Calendar className="w-4 h-4" />} label="Created At" value={formatDate(asset.createdAt)} />
              <DetailRow icon={<Calendar className="w-4 h-4" />} label="Last Updated" value={formatDate(asset.updatedAt)} />
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {showReceiptPreview && receiptUrl && isImageFile && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Receipt Preview</h3>
              <button
                onClick={() => setShowReceiptPreview(false)}
                className="p-2 hover:bg-gray-100 rounded"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <img 
                src={receiptUrl} 
                alt="Receipt Preview" 
                className="max-w-full h-auto mx-auto"
                onError={(e) => {
                  console.error("❌ Failed to load preview image:", receiptUrl);
                  (e.target as HTMLImageElement).src = "https://placehold.co/800x600?text=Image+Not+Found";
                }}
              />
            </div>
            <div className="p-4 border-t flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {asset.receiptImageDetails?.originalName || asset.receiptImage}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={downloadReceipt}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => setShowReceiptPreview(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Component for Detail Rows
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm text-foreground font-medium truncate max-w-xs">{value}</span>
    </div>
  );
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}