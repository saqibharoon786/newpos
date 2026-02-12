import { useState, useEffect, useRef } from "react";
import { 
  Save, 
  Upload, 
  Calendar, 
  ChevronDown, 
  Clock, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  Loader2 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define API endpoints
const API_ENDPOINTS = {
  PURCHASES_GET_ALL: `${API_BASE_URL}/api/purchases/get-all`,
  PRODUCTION_FOR_POS: `${API_BASE_URL}/api/processing/production/for-pos`,
  SALES_ADD: `${API_BASE_URL}/api/sales/add-sale`,
  SALES_UPDATE: (id: string) => `${API_BASE_URL}/api/sales/${id}`,
  SALES_GET_ALL: `${API_BASE_URL}/api/sales`,
};

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
  advancePayment: number;
  soldWeight: number;
  availableWeight: number;
  createdAt: string;
}

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
  advancePayment: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: 'none' | 'partial' | 'paid';
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerEmail: string;
  buyerCnic: string;
  buyerCompany: string;
  finalAmount: string;
  receiptImage?: string;
  createdAt: string;
  originalPurchaseId?: string;
  originalWeight?: number;
}

interface AddSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Sale | null;
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
  { name: "Black", color: "bg-black", value: "#000000" },
];

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function AddSaleDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  isEdit = false, 
  editData = null 
}: AddSaleDialogProps) {
  // Date picker states
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Year dropdown state
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);
  
  // Time states
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedAmPm, setSelectedAmPm] = useState<"AM" | "PM">("PM");

  // Refs
  const calendarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    materialName: "",
    supplierName: "",
    invoiceNo: "",
    weight: "",
    unit: "",
    purchaseDate: "",
    purchaseTime: "",
    branch: "",
    materialColor: "#FFFFFF",
    actualPrice: "",
    productionCost: "",
    sellingPrice: "",
    discount: "0",
    advancePayment: "",
    buyerName: "",
    buyerAddress: "",
    buyerPhone: "",
    buyerEmail: "",
    buyerCnic: "",
    buyerCompany: "",
    paymentMethod: "Cash",
    paymentStatus: "none",
    amountPaid: "0",
    transportationCost: "0",
    notes: "",
  });

  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<Purchase[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [selectedMaterialInfo, setSelectedMaterialInfo] = useState<{
    totalWeight: number;
    availableWeight: number;
    soldWeight: number;
    purchaseId?: string;
    productionId?: string;
    vendor: string;
    price: string;
    materialColor: string;
  } | null>(null);
  const [weightError, setWeightError] = useState<string>("");
  const [paymentStatusError, setPaymentStatusError] = useState<string>("");
  const [apiError, setApiError] = useState<string>("");

  // Calendar helper functions
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  // Helper functions
  const getTodayDate = (): string => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const getCurrentTime = (): string => {
    const now = new Date();
    let hour = now.getHours();
    const minute = String(now.getMinutes()).padStart(2, '0');
    const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`;
  };

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
        setShowYearDropdown(false);
      }
      if (timeRef.current && !timeRef.current.contains(event.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch materials when dialog opens
  useEffect(() => {
    if (open) {
      fetchMaterials();
      
      if (isEdit && editData) {
        // Populate form for editing
        populateEditForm();
      } else {
        // Set default values for new sale
        const todayStr = getTodayDate();
        const currentTimeStr = getCurrentTime();
        
        setFormData(prev => ({
          ...prev,
          purchaseDate: todayStr,
          purchaseTime: currentTimeStr,
        }));
        
        setSelectedDate(new Date());
      }
    }
  }, [open, isEdit, editData]);

  // Populate form for editing
  const populateEditForm = () => {
    if (!editData) return;
    
    let saleDateParsed: Date | null = null;
    let saleDateStr = getTodayDate();
    if (editData.purchaseDate) {
      try {
        saleDateParsed = new Date(editData.purchaseDate);
        if (!isNaN(saleDateParsed.getTime())) {
          const dd = String(saleDateParsed.getDate()).padStart(2, '0');
          const mm = String(saleDateParsed.getMonth() + 1).padStart(2, '0');
          const yyyy = saleDateParsed.getFullYear();
          saleDateStr = `${dd}/${mm}/${yyyy}`;
        }
      } catch (error) {
        console.error("Error parsing sale date:", error);
      }
    }

    let saleTimeStr = getCurrentTime();
    if (editData.purchaseDate) {
      try {
        const saleTimeParsed = new Date(editData.purchaseDate);
        if (!isNaN(saleTimeParsed.getTime())) {
          let hour = saleTimeParsed.getHours();
          const minute = String(saleTimeParsed.getMinutes()).padStart(2, '0');
          const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          saleTimeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`;
        }
      } catch (error) {
        console.error("Error parsing sale time:", error);
      }
    }

    setFormData({
      materialName: editData.materialName || "",
      supplierName: editData.supplierName || "",
      invoiceNo: editData.invoiceNo || "",
      weight: editData.weight || "",
      unit: editData.unit || "",
      purchaseDate: saleDateStr,
      purchaseTime: saleTimeStr,
      branch: editData.branch || "",
      materialColor: editData.materialColor || "#FFFFFF",
      actualPrice: editData.actualPrice || "",
      productionCost: editData.productionCost || "",
      sellingPrice: editData.sellingPrice || "",
      discount: editData.discount || "0",
      advancePayment: editData.advancePayment?.toString() || "",
      buyerName: editData.buyerName || "",
      buyerAddress: editData.buyerAddress || "",
      buyerPhone: editData.buyerPhone || "",
      buyerEmail: editData.buyerEmail || "",
      buyerCnic: editData.buyerCnic || "",
      buyerCompany: editData.buyerCompany || "",
      paymentMethod: "Cash",
      paymentStatus: editData.paymentStatus || "none",
      amountPaid: editData.amountPaid?.toString() || "0",
      transportationCost: "0",
      notes: "",
    });
    
    setSelectedColor(editData.materialColor || "#FFFFFF");
    
    if (saleDateParsed) {
      setSelectedDate(saleDateParsed);
      setCurrentMonth(saleDateParsed.getMonth());
      setCurrentYear(saleDateParsed.getFullYear());
    }
    
    if (editData.receiptImage) {
      setReceiptPreview(`${API_BASE_URL}${editData.receiptImage}`);
    }
  };

  // Fetch materials from Production List (for POS selling)
  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      setApiError("");
      const response = await api.get(API_ENDPOINTS.PRODUCTION_FOR_POS);
      let materialsData: any[] = [];
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        materialsData = response.data.data;
      }
      const processedMaterials = materialsData.map((item: any) => ({
        _id: item._id,
        materialName: item.materialName || "Unknown",
        vendor: "Production",
        price: "0",
        weight: String(item.totalWeight ?? 0),
        quality: item.quality || "Standard",
        purchaseDate: item.productionDate || new Date().toISOString(),
        materialColor: item.color || "#FFFFFF",
        vehicleName: "",
        vehicleType: "",
        vehicleNumber: "",
        driverName: "",
        vehicleColor: "",
        deliveryDate: "",
        receiptNo: item.batchNo || "",
        vehicleImage: "",
        advancePayment: 0,
        soldWeight: 0,
        availableWeight: item.availableWeight ?? item.totalWeight ?? 0,
        batchNo: item.batchNo,
        createdAt: item.productionDate || new Date().toISOString(),
      }));
      setMaterials(processedMaterials);
      if (processedMaterials.length === 0) {
        setApiError("No production stock. Add production via Start Process in Factory Processing.");
      }
    } catch (error: any) {
      console.error("Error fetching production list:", error);
      setApiError(`Failed to load production list: ${error.message}`);
      setMaterials([]);
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      alert('Invalid file type. Please upload JPEG, PNG, GIF, or PDF files only.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('File size too large. Maximum size is 5MB.');
      return;
    }

    setReceiptFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setReceiptPreview('pdf');
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Validate weight when changed
    if (name === 'weight' && selectedMaterialInfo) {
      const saleWeight = parseFloat(value);
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        setWeightError(`Warning: Sale weight exceeds available weight. Available: ${selectedMaterialInfo.availableWeight} kg`);
      } else {
        setWeightError("");
      }
    }
    
    // Validate amount paid
    if (name === 'amountPaid') {
      const sellingPrice = parseFloat(formData.sellingPrice) || 0;
      const amountPaid = parseFloat(value) || 0;
      
      if (amountPaid > sellingPrice) {
        setPaymentStatusError(`Warning: Amount paid (${amountPaid}) exceeds selling price (${sellingPrice})`);
      } else {
        setPaymentStatusError("");
      }
    }
  };

  // Handle material selection (value is material _id from Production List)
  const handleMaterialSelect = (selectedId: string) => {
    const selectedMaterial = materials.find(m => m._id === selectedId);
    if (!selectedMaterial) return;
    const name = selectedMaterial.materialName;
    setFormData(prev => ({
      ...prev,
      materialName: name,
      supplierName: selectedMaterial.vendor || prev.supplierName,
      actualPrice: selectedMaterial.price || prev.actualPrice,
      branch: name || prev.branch,
    }));
    setSelectedColor(selectedMaterial.materialColor || "#FFFFFF");
    const totalWeight = parseFloat(selectedMaterial.weight) || 0;
    const availableWeight = selectedMaterial.availableWeight ?? totalWeight;
    setSelectedMaterialInfo({
      totalWeight,
      availableWeight,
      soldWeight: selectedMaterial.soldWeight || 0,
      productionId: selectedMaterial._id,
      vendor: selectedMaterial.vendor,
      price: selectedMaterial.price,
      materialColor: selectedMaterial.materialColor,
    });
    setFormData(prev => ({ ...prev, weight: "" }));
    setWeightError("");
  };

  // Calendar handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setShowYearDropdown(false);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setShowYearDropdown(false);
  };

  const handleYearSelect = (year: number) => {
    setCurrentYear(year);
    setShowYearDropdown(false);
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setShowCalendar(false);
    setFormData(prev => ({ 
      ...prev, 
      purchaseDate: `${String(day).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`
    }));
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowCalendar(false);
    setFormData(prev => ({
      ...prev,
      purchaseDate: getTodayDate()
    }));
  };

  // Time picker options
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  // Calculate amounts
  const calculateFinalAmount = () => {
    const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
    const discount = parseFloat(formData.discount.replace(/,/g, '')) || 0;
    return (selling - discount).toFixed(2);
  };

  const calculateRemainingAmount = () => {
    const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    return Math.max(0, selling - amountPaid).toFixed(2);
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.supplierName.trim()) newErrors.supplierName = "Supplier name is required";
    if (!formData.invoiceNo.trim()) newErrors.invoiceNo = "Invoice number is required";
    
    if (!formData.weight.trim()) {
      newErrors.weight = "Weight is required";
    } else {
      const saleWeight = parseFloat(formData.weight);
      if (isNaN(saleWeight) || saleWeight <= 0) {
        newErrors.weight = "Valid weight is required";
      } else if (selectedMaterialInfo && saleWeight > selectedMaterialInfo.availableWeight) {
        newErrors.weight = `Sale weight cannot exceed available weight (${selectedMaterialInfo.availableWeight} kg)`;
      }
    }
    
    if (!formData.unit.trim()) newErrors.unit = "Unit is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Sale date is required";
    if (!formData.purchaseTime) newErrors.purchaseTime = "Sale time is required";
    if (!formData.branch) newErrors.branch = "Branch is required";
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice.replace(/,/g, '')) <= 0) newErrors.sellingPrice = "Valid selling price is required";
    
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    if (amountPaid < 0) {
      newErrors.amountPaid = "Amount paid cannot be negative";
    } else if (amountPaid > sellingPrice) {
      newErrors.amountPaid = "Amount paid cannot exceed selling price";
    }
    
    if (!formData.buyerName.trim()) newErrors.buyerName = "Customer name is required";
    if (!formData.buyerPhone.trim()) newErrors.buyerPhone = "Buyer phone is required";
    if (formData.buyerEmail && !/^\S+@\S+\.\S+$/.test(formData.buyerEmail)) newErrors.buyerEmail = "Invalid email address";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fill in all required fields correctly.");
      return;
    }

    if (selectedMaterialInfo) {
      const saleWeight = parseFloat(formData.weight);
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        alert(`Sale weight cannot exceed available weight (${selectedMaterialInfo.availableWeight} kg)`);
        return;
      }
    }

    const amountPaid = parseFloat(formData.amountPaid) || 0;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    
    if (amountPaid > sellingPrice) {
      alert(`Amount paid (${amountPaid}) cannot exceed selling price (${sellingPrice})`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Parse date and time
      const parseDate = (dateStr: string, timeStr: string): string => {
        const [dd, mm, yyyy] = dateStr.split('/').map(Number);
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!timeMatch) return new Date().toISOString();
        
        let hour = parseInt(timeMatch[1]);
        const minute = parseInt(timeMatch[2]);
        const ampm = timeMatch[3];
        
        if (ampm.toUpperCase() === "PM" && hour < 12) hour += 12;
        if (ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
        
        const date = new Date(yyyy, mm - 1, dd, hour, minute);
        return date.toISOString();
      };

      const dateTime = parseDate(formData.purchaseDate, formData.purchaseTime);
      const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
      const discount = parseFloat(formData.discount.replace(/,/g, '')) || 0;
      const finalAmount = (selling - discount).toFixed(2);

      // Prepare form data
      const formDataToSend = new FormData();
      if (selectedMaterialInfo?.productionId) {
        formDataToSend.append('productionId', selectedMaterialInfo.productionId);
      } else {
        formDataToSend.append('purchaseId', selectedMaterialInfo?.purchaseId || '');
      }
      formDataToSend.append('customerName', formData.buyerName);
      formDataToSend.append('customerPhone', formData.buyerPhone);
      formDataToSend.append('customerEmail', formData.buyerEmail || '');
      formDataToSend.append('sellingPrice', formData.sellingPrice);
      formDataToSend.append('sellingWeight', formData.weight);
      formDataToSend.append('saleDate', dateTime);
      formDataToSend.append('paymentMethod', formData.paymentMethod);
      formDataToSend.append('amountPaid', formData.amountPaid);
      formDataToSend.append('invoiceNo', formData.invoiceNo);
      formDataToSend.append('transportationCost', formData.transportationCost);
      formDataToSend.append('notes', formData.notes);

      // Additional fields
      formDataToSend.append('materialName', formData.materialName);
      formDataToSend.append('supplierName', formData.supplierName);
      formDataToSend.append('unit', formData.unit);
      formDataToSend.append('branch', formData.branch);
      formDataToSend.append('materialColor', selectedColor);
      formDataToSend.append('actualPrice', '0');
      formDataToSend.append('productionCost', '0');
      formDataToSend.append('discount', formData.discount);
      formDataToSend.append('advancePayment', formData.advancePayment || '0');
      formDataToSend.append('buyerAddress', formData.buyerAddress || '');
      formDataToSend.append('buyerCnic', formData.buyerCnic || '');
      formDataToSend.append('buyerCompany', formData.buyerCompany || '');
      formDataToSend.append('finalAmount', finalAmount);

      // Add receipt file
      if (receiptFile) {
        formDataToSend.append('receiptImage', receiptFile);
      }

      let response;
      if (isEdit && editData && editData._id) {
        response = await axios.put(
          API_ENDPOINTS.SALES_UPDATE(editData._id),
          formDataToSend,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
      } else {
        response = await axios.post(
          API_ENDPOINTS.SALES_ADD,
          formDataToSend,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        );
      }
      
      if (response.data.success) {
        alert(isEdit ? 'Sale updated successfully!' : 'Sale added successfully!');
        onSave();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(response.data.message || 'Failed to save sale');
      }
      
    } catch (error: any) {
      console.error('Error saving sale:', error);
      alert(error.response?.data?.message || error.message || 'Failed to save sale');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form
  const resetForm = () => {
    const todayStr = getTodayDate();
    const currentTimeStr = getCurrentTime();

    setFormData({
      materialName: "",
      supplierName: "",
      invoiceNo: "",
      weight: "",
      unit: "",
      purchaseDate: todayStr,
      purchaseTime: currentTimeStr,
      branch: "",
      materialColor: "#FFFFFF",
      actualPrice: "",
      productionCost: "",
      sellingPrice: "",
      discount: "0",
      advancePayment: "",
      buyerName: "",
      buyerAddress: "",
      buyerPhone: "",
      buyerEmail: "",
      buyerCnic: "",
      buyerCompany: "",
      paymentMethod: "Cash",
      paymentStatus: "none",
      amountPaid: "0",
      transportationCost: "0",
      notes: "",
    });
    
    setSelectedColor("#FFFFFF");
    setSelectedDate(new Date());
    setSelectedMaterialInfo(null);
    setReceiptFile(null);
    setReceiptPreview(null);
    setWeightError("");
    setPaymentStatusError("");
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Render calendar popup
  const renderCalendar = () => {
    return showCalendar && (
      <div 
        ref={calendarRef}
        className="absolute z-[999] mt-1 w-80 bg-background border border-border rounded-lg shadow-2xl"
        style={{ 
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '4px',
        }}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-1 relative">
              <div className="text-sm font-semibold text-foreground min-w-[100px] text-center">
                {monthNames[currentMonth]}
              </div>
              <button 
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted rounded"
              >
                {currentYear}
                <ChevronDown className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showYearDropdown && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 max-h-48 overflow-y-auto bg-background border border-border rounded-md shadow-lg z-10">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-muted ${year === currentYear ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleNextMonth} 
              className="p-1 hover:bg-muted rounded"
            >
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <button
            onClick={handleToday}
            className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Today
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground font-medium">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, index) => {
              const day = index + 1;
              const isToday = new Date().getDate() === day && 
                              new Date().getMonth() === currentMonth &&
                              new Date().getFullYear() === currentYear;
              const isSelected = selectedDate && 
                                selectedDate.getDate() === day &&
                                selectedDate.getMonth() === currentMonth &&
                                selectedDate.getFullYear() === currentYear;

              return (
                <button
                  key={day}
                  onClick={() => handleDateSelect(day)}
                  className={`
                    h-9 flex items-center justify-center text-sm rounded-md transition-colors
                    ${isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : isToday 
                      ? 'bg-blue-100 text-blue-600 font-semibold' 
                      : 'hover:bg-muted text-foreground'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render time picker popup
  const renderTimePicker = () => {
    return showTimePicker && (
      <div 
        ref={timeRef}
        className="absolute z-[999] mt-1 w-64 bg-background border border-border rounded-lg shadow-2xl right-0"
      >
        <div className="p-4">
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-2">Hour</div>
              <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                {hours.map(h => (
                  <button
                    key={h}
                    onClick={() => {
                      setSelectedHour(h);
                      setFormData(prev => ({ 
                        ...prev, 
                        purchaseTime: `${h}:${selectedMinute} ${selectedAmPm}` 
                      }));
                    }}
                    className={`py-1.5 text-sm rounded ${selectedHour === h ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-2">Minute</div>
              <div className="grid grid-cols-2 gap-1">
                {minutes.map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMinute(m);
                      setFormData(prev => ({ 
                        ...prev, 
                        purchaseTime: `${selectedHour}:${m} ${selectedAmPm}` 
                      }));
                    }}
                    className={`py-1.5 text-sm rounded ${selectedMinute === m ? 'bg-primary text-white' : 'hover:bg-muted text-foreground'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex border rounded overflow-hidden">
            <button
              onClick={() => {
                setSelectedAmPm("AM");
                setFormData(prev => ({ 
                  ...prev, 
                  purchaseTime: `${selectedHour}:${selectedMinute} AM` 
                }));
              }}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "AM" ? "bg-primary text-white" : "hover:bg-muted text-foreground"}`}
            >
              AM
            </button>
            <button
              onClick={() => {
                setSelectedAmPm("PM");
                setFormData(prev => ({ 
                  ...prev, 
                  purchaseTime: `${selectedHour}:${selectedMinute} PM` 
                }));
              }}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "PM" ? "bg-primary text-white" : "hover:bg-muted text-foreground"}`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-background border-border max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {isEdit ? 'Edit Sale' : 'Add New Sale'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? 'Update the sale details' : 'Enter the details for the new sale'}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-cms-sidebar px-4 py-2 mb-4 rounded-md">
          <p className="text-xs text-muted-foreground">
            Point Of Sale / {isEdit ? 'Edit Sale' : 'Add Sale'}
          </p>
        </div>

        {/* Debug Info - Remove in production */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">Debug Info</h4>
          <p className="text-xs text-yellow-700">
            API Base URL: {API_BASE_URL}
          </p>
          <p className="text-xs text-yellow-700">
            Materials Count: {materials.length}
          </p>
          <p className="text-xs text-yellow-700">
            Loading: {loadingMaterials ? "Yes" : "No"}
          </p>
          {apiError && (
            <p className="text-xs text-red-600 mt-1">
              API Error: {apiError}
            </p>
          )}
          <button 
            onClick={fetchMaterials}
            className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded"
          >
            Refresh Materials
          </button>
        </div>

        {/* Product Details Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Product Details</h3>
          
          {/* Material Info Card */}
          {selectedMaterialInfo && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-800">Material Stock Information</h4>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-gray-600">Total Weight</p>
                  <p className="text-lg font-bold text-gray-800">{selectedMaterialInfo.totalWeight} kg</p>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-gray-600">Already Sold</p>
                  <p className="text-lg font-bold text-red-600">{selectedMaterialInfo.soldWeight} kg</p>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-gray-600">Available for Sale</p>
                  <p className="text-lg font-bold text-green-600">{selectedMaterialInfo.availableWeight} kg</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
              <div className="relative">
                <select
                  name="materialName"
                  value={selectedMaterialInfo?.productionId ?? ""}
                  onChange={(e) => handleMaterialSelect(e.target.value)}
                  className={`w-full bg-cms-input-bg border ${errors.materialName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                  disabled={loadingMaterials}
                >
                  <option value="">{loadingMaterials ? "Loading production list..." : "Select Material (Production List)"}</option>
                  {!loadingMaterials && materials.length === 0 ? (
                    <option value="" disabled>
                      {apiError || "No production stock. Use Start Process in Factory Processing first."}
                    </option>
                  ) : (
                    materials.map((material) => (
                      <option key={material._id} value={material._id} style={{ color: "#000" }}>
                        {material.materialName} ({material.receiptNo || material._id}) — {material.availableWeight} kg available
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                {loadingMaterials && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              {errors.materialName && (
                <p className="text-xs text-red-500 mt-1">{errors.materialName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Supplier Name *</label>
              <input
                type="text"
                name="supplierName"
                placeholder="e.g Acme Inc."
                value={formData.supplierName}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.supplierName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.supplierName && (
                <p className="text-xs text-red-500 mt-1">{errors.supplierName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Invoice No. *</label>
              <input
                type="text"
                name="invoiceNo"
                placeholder="e.g INV-001"
                value={formData.invoiceNo}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.invoiceNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.invoiceNo && (
                <p className="text-xs text-red-500 mt-1">{errors.invoiceNo}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Sale Weight (kg) *</label>
              <input
                type="number"
                name="weight"
                placeholder="e.g 200"
                value={formData.weight}
                onChange={handleInputChange}
                min="0.1"
                step="0.1"
                className={`w-full bg-cms-input-bg border ${errors.weight ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.weight && (
                <p className="text-xs text-red-500 mt-1">{errors.weight}</p>
              )}
              {weightError && !errors.weight && (
                <p className="text-xs text-amber-600 mt-1">{weightError}</p>
              )}
              {selectedMaterialInfo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {selectedMaterialInfo.availableWeight.toFixed(2)} kg
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Units (number e.g. 3, 5, 7) *</label>
              <input
                type="text"
                name="unit"
                placeholder="e.g. 3, 5, 7"
                value={formData.unit}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.unit ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.unit && (
                <p className="text-xs text-red-500 mt-1">{errors.unit}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Sale Date & Time *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => {
                      setShowCalendar(!showCalendar);
                      setShowTimePicker(false);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.purchaseDate}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {renderCalendar()}
                </div>
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => {
                      setShowTimePicker(!showTimePicker);
                      setShowCalendar(false);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.purchaseTime}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer`}
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {renderTimePicker()}
                </div>
              </div>
              {(errors.purchaseDate || errors.purchaseTime) && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.purchaseDate || errors.purchaseTime}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Link to Raw Material Branch *</label>
              <div className="relative">
                <select
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-input-bg border ${errors.branch ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                >
                  <option value="">Select Branch</option>
                  <option value="Main Branch">Main Branch</option>
                  <option value="North Branch">North Branch</option>
                  <option value="South Branch">South Branch</option>
                  <option value="East Branch">East Branch</option>
                  <option value="West Branch">West Branch</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.branch && (
                <p className="text-xs text-red-500 mt-1">{errors.branch}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Material Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <label key={color.value} className={`flex items-center gap-1.5 cursor-pointer border rounded-md px-2 py-1.5 ${selectedColor === color.value ? 'border-primary bg-primary/5' : 'bg-cms-input-bg border-border'}`}>
                    <input
                      type="radio"
                      name="materialColor"
                      value={color.value}
                      checked={selectedColor === color.value}
                      onChange={() => setSelectedColor(color.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded ${color.color} ${selectedColor === color.value ? 'ring-2 ring-foreground' : ''}`} />
                    <span className="text-xs text-foreground">{color.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Method</label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Check">Check</option>
                <option value="Online Payment">Online Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Amount Paid *</label>
              <input
                type="number"
                name="amountPaid"
                placeholder="e.g 5000"
                value={formData.amountPaid}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full bg-cms-input-bg border ${errors.amountPaid ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.amountPaid && (
                <p className="text-xs text-red-500 mt-1">{errors.amountPaid}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Transportation Cost</label>
              <input
                type="number"
                name="transportationCost"
                placeholder="e.g 1500"
                value={formData.transportationCost}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">Notes</label>
            <textarea
              name="notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={handleInputChange}
              rows={2}
              className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
        </div>

        {/* Price Details Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Price Details</h3>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Advance Payment</label>
              <input
                type="number"
                name="advancePayment"
                placeholder="e.g 5000"
                value={formData.advancePayment}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Selling Price *</label>
              <input
                type="number"
                name="sellingPrice"
                placeholder="e.g 15000"
                value={formData.sellingPrice}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full bg-cms-input-bg border ${errors.sellingPrice ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.sellingPrice && (
                <p className="text-xs text-red-500 mt-1">{errors.sellingPrice}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Discount</label>
              <input
                type="number"
                name="discount"
                placeholder="e.g 1000"
                value={formData.discount}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Payment Summary */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-xs text-green-700 mb-1">Amount Paid</p>
              <p className="text-lg font-bold text-green-800">Rs. {parseFloat(formData.amountPaid || "0").toFixed(2)}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-xs text-yellow-700 mb-1">Remaining Amount</p>
              <p className="text-lg font-bold text-yellow-800">Rs. {calculateRemainingAmount()}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-700 mb-1">Payment Status</p>
              <p className="text-lg font-bold text-blue-800">
                {formData.paymentStatus === 'paid' ? 'Paid' :
                 formData.paymentStatus === 'partial' ? 'Partial' : 'None'}
              </p>
            </div>
          </div>
          
          <div className="bg-cms-input-bg border border-border rounded-md px-4 py-3 text-right">
            <span className="text-sm text-muted-foreground">Final Amount: </span>
            <span className="text-lg font-bold text-primary">Rs. {calculateFinalAmount()}</span>
          </div>
        </div>

        {/* Receipt Image Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Receipt Image</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-cms-input-bg hover:bg-cms-card-hover transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="mb-1 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, GIF, or PDF (MAX. 5MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.gif,.pdf"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {receiptPreview && receiptPreview !== 'pdf' && !receiptPreview.startsWith('data:') && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Existing Receipt</p>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    Remove
                  </button>
                </div>
                <div className="border border-border rounded-lg p-4 bg-cms-input-bg">
                  <div className="flex flex-col items-center">
                    <img 
                      src={receiptPreview} 
                      alt="Receipt preview" 
                      className="max-w-full h-auto max-h-64 rounded-md border border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {receiptPreview && (receiptPreview === 'pdf' || receiptPreview.startsWith('data:')) && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Uploaded Receipt</p>
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="border border-border rounded-lg p-4 bg-cms-input-bg">
                  {receiptPreview === 'pdf' ? (
                    <div className="flex flex-col items-center justify-center p-4">
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
                        <span className="text-red-600 font-bold text-xl">PDF</span>
                      </div>
                      <p className="text-sm text-foreground">
                        PDF Document - {receiptFile?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(receiptFile?.size || 0) / 1024} KB
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <img 
                        src={receiptPreview} 
                        alt="Receipt preview" 
                        className="max-w-full h-auto max-h-64 rounded-md border border-border"
                      />
                      {receiptFile && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {receiptFile.name} - {(receiptFile.size / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Customer Details Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Customer Details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Customer Name *</label>
              <input
                type="text"
                name="buyerName"
                placeholder="e.g John Smith"
                value={formData.buyerName}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.buyerName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.buyerName && (
                <p className="text-xs text-red-500 mt-1">{errors.buyerName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Address</label>
              <input
                type="text"
                name="buyerAddress"
                placeholder="e.g 123 Main St"
                value={formData.buyerAddress}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Phone No. *</label>
              <input
                type="tel"
                name="buyerPhone"
                placeholder="e.g +92 300 1234567"
                value={formData.buyerPhone}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.buyerPhone ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.buyerPhone && (
                <p className="text-xs text-red-500 mt-1">{errors.buyerPhone}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email Address</label>
              <input
                type="email"
                name="buyerEmail"
                placeholder="e.g john@example.com"
                value={formData.buyerEmail}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.buyerEmail ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.buyerEmail && (
                <p className="text-xs text-red-500 mt-1">{errors.buyerEmail}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">CNIC No.</label>
              <input
                type="text"
                name="buyerCnic"
                placeholder="e.g 42101-1234567-8"
                value={formData.buyerCnic}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Company/Business Name</label>
              <input
                type="text"
                name="buyerCompany"
                placeholder="e.g ABC Corporation"
                value={formData.buyerCompany}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEdit ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isEdit ? 'Update' : 'Save'}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}