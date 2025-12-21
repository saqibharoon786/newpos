import { useState } from "react";
import { Save, Calendar, Clock, ChevronDown, Loader2 } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";

interface AddAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddAssetDialog({ open, onOpenChange, onSuccess }: AddAssetDialogProps) {
  const [formData, setFormData] = useState({
    assetName: "",
    category: "",
    quantity: "",
    sizeModel: "",
    condition: "",
    description: "",
    department: "",
    assignedTo: "",
    purchasePrice: "",
    purchaseFrom: "",
    invoiceNo: "",
    date: "",
    time: "",
  });
  
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ CORRECT URL BASED ON YOUR BACKEND:
  // Your server.js has: app.use('/api/assets', assetRoutes)
  // Your route file has: router.post('/create-assets', ...)
  // So full URL is: http://localhost:5000/api/assets/create-assets
  const API_BASE_URL = "http://localhost:5000";
  const CREATE_ASSET_ENDPOINT = "/api/assets/create-assets";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};
    
    if (!formData.assetName.trim()) newErrors.assetName = "Asset name is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.quantity || parseInt(formData.quantity) <= 0) 
      newErrors.quantity = "Valid quantity is required";
    if (!formData.condition) newErrors.condition = "Condition is required";
    if (!formData.department) newErrors.department = "Department is required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const testBackendConnection = async () => {
    try {
      console.log("🔍 Testing backend endpoints...");
      
      // Test endpoints one by one
      const testEndpoints = [
        { url: `${API_BASE_URL}/api/assets/create-assets`, method: 'GET' },
        { url: `${API_BASE_URL}/api/assets/get-all`, method: 'GET' },
        { url: `${API_BASE_URL}/api/assets/stats`, method: 'GET' },
        { url: `${API_BASE_URL}/api/assets/test`, method: 'GET' },
        { url: `${API_BASE_URL}/`, method: 'GET' },
      ];
      
      for (const endpoint of testEndpoints) {
        try {
          const response = await fetch(endpoint.url, { 
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' }
          });
          console.log(`${endpoint.method} ${endpoint.url}: ${response.status}`);
        } catch (err: any) {
          console.log(`${endpoint.method} ${endpoint.url}: ERROR - ${err.message}`);
        }
      }
    } catch (error) {
      console.error("Connection test failed:", error);
    }
  };

  const handleSubmit = async () => {
    console.log("🚀 Starting asset creation...");
    
    // Test connection first
    await testBackendConnection();
    
    if (!validateForm()) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    
    try {
      // Format data exactly as your backend expects
      const payload = {
        assetName: formData.assetName,
        category: formData.category,
        quantity: parseInt(formData.quantity) || 1,
        sizeModel: formData.sizeModel,
        condition: formData.condition,
        description: formData.description,
        department: formData.department,
        assignedTo: formData.assignedTo,
        purchasePrice: formData.purchasePrice ? formData.purchasePrice.replace(/,/g, '') : "",
        purchaseFrom: formData.purchaseFrom,
        invoiceNo: formData.invoiceNo,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: formData.time || new Date().toLocaleTimeString('en-US', { hour12: false })
      };

      console.log("📤 Sending POST to:", `${API_BASE_URL}${CREATE_ASSET_ENDPOINT}`);
      console.log("📦 Payload:", payload);

      // ✅ CORRECT ENDPOINT: http://localhost:5000/api/assets/create-assets
      const response = await fetch(`${API_BASE_URL}${CREATE_ASSET_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        // Try to get error message
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.text();
          console.error("❌ Error response body:", errorData);
          if (errorData) {
            try {
              const parsed = JSON.parse(errorData);
              errorMessage = parsed.error || parsed.message || errorData;
            } catch {
              errorMessage = errorData;
            }
          }
        } catch {
          // Ignore if we can't read the body
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("✅ Success response:", result);

      if (result.success) {
        alert("✅ Asset created successfully!");
        
        // Reset form
        setFormData({
          assetName: "",
          category: "",
          quantity: "",
          sizeModel: "",
          condition: "",
          description: "",
          department: "",
          assignedTo: "",
          purchasePrice: "",
          purchaseFrom: "",
          invoiceNo: "",
          date: "",
          time: "",
        });
        
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        alert(`❌ Error: ${result.error || "Failed to create asset"}`);
      }
    } catch (error: any) {
      console.error("❌ API Error:", error);
      alert(`❌ Failed to create asset:\n\n${error.message}\n\nPlease check:\n1. Backend is running on port 5000\n2. CORS is enabled in backend\n3. Check browser console for more details`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* ✅ FIX: Accessibility requirements */}
        <DialogTitle className="sr-only">Add New Asset</DialogTitle>
        <DialogDescription className="sr-only">
          Form to add new assets to the system
        </DialogDescription>
        
        {/* Breadcrumb Header */}
        <div className="bg-cms-sidebar px-6 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground">Assets/ Add Assets</p>
        </div>

        <div className="p-6 bg-background">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">Add New Asset</h1>
            <p className="text-sm text-muted-foreground">Enter the details for Asset</p>
            <p className="text-xs text-blue-500 mt-1">
              Endpoint: {API_BASE_URL}{CREATE_ASSET_ENDPOINT}
            </p>
          </div>

          {/* ... Your existing form JSX remains exactly the same ... */}
          {/* Asset Information Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-primary mb-4">Asset Information</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Asset Name *</label>
                <input
                  type="text"
                  name="assetName"
                  placeholder="e.g Dell Laptop"
                  value={formData.assetName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.assetName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.assetName && <p className="text-xs text-red-500 mt-1">{errors.assetName}</p>}
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Category *</label>
                <div className="relative">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={`w-full bg-cms-input-bg border ${errors.category ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Category</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Office Equipment">Office Equipment</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  placeholder="e.g 1"
                  min="1"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.quantity ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Size/Model</label>
                <input
                  type="text"
                  name="sizeModel"
                  placeholder="e.g Xps"
                  value={formData.sizeModel}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Condition *</label>
                <div className="relative">
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className={`w-full bg-cms-input-bg border ${errors.condition ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Condition</option>
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.condition && <p className="text-xs text-red-500 mt-1">{errors.condition}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Description</label>
              <textarea
                name="description"
                placeholder="Write short detail"
                value={formData.description}
                onChange={handleInputChange}
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
                <label className="block text-xs text-muted-foreground mb-1.5">Department *</label>
                <div className="relative">
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className={`w-full bg-cms-input-bg border ${errors.department ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  >
                    <option value="">Select Department</option>
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Operations">Operations</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Assigned to</label>
                <input
                  type="text"
                  name="assignedTo"
                  placeholder="Emily Clark"
                  value={formData.assignedTo}
                  onChange={handleInputChange}
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
                  placeholder="70,000"
                  value={formData.purchasePrice}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase From</label>
                <input
                  type="text"
                  name="purchaseFrom"
                  placeholder="John Doe"
                  value={formData.purchaseFrom}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Invoice No.</label>
                <input
                  type="text"
                  name="invoiceNo"
                  placeholder="e.g 83662626"
                  value={formData.invoiceNo}
                  onChange={handleInputChange}
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
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                <div className="relative">
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
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
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}