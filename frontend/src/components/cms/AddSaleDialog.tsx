import { useState, useEffect, useRef } from "react";
import { Save, Upload, Calendar, Edit, Trash2, Eye, Loader2, ChevronDown, Clock, Image as ImageIcon, X, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create axios instance with environment variable as base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Define endpoints using environment variable
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;
const SALES_API_URL = `${API_BASE_URL}/api/sales`;

// Updated API endpoints to match your backend routes
const API_ENDPOINTS = {
  GET_ALL: PURCHASES_API_URL + "/get-all",
  GET_ONE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  UPDATE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  DELETE: (id: string) => `${PURCHASES_API_URL}/${id}`,
  ADD_SALE: `${SALES_API_URL}/add-sale`,
  UPDATE_SALE: (id: string) => `${SALES_API_URL}/${id}`,
  GET_SALES: `${SALES_API_URL}`,
};

interface Purchase {
  _id: string;
  materialName: string;
  vendor: string;
  price: string;
  weight: string; // Total weight in POP
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
  soldWeight: number; // Weight already sold
  availableWeight: number; // Weight still available
  createdAt: string;
}

interface Sale {
  _id: string;
  materialName: string;
  supplierName: string;
  invoiceNo: string;
  weight: string; // Sale weight
  unit: string;
  purchaseDate: string;
  branch: string;
  materialColor: string;
  actualPrice: string;
  productionCost: string;
  sellingPrice: string;
  discount: string;
  advancePayment: number;
  
  // New payment tracking fields
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
  originalPurchaseId?: string; // Reference to purchase record
  originalWeight?: number; // Original available weight before sale
}

interface AddSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Sale | null;
}

// Updated color options with Black
const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
  { name: "Black", color: "bg-black", value: "#000000" },
];

// Allowed file types for receipt
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

  // Refs for click outside handling
  const calendarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

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
    // Additional fields for controller
    paymentMethod: "Cash",
    paymentStatus: "none", // Changed from "Completed" to match backend
    amountPaid: "0", // NEW FIELD: Initial amount paid
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
    purchaseId: string;
    vendor: string;
    price: string;
    materialColor: string;
  } | null>(null);
  const [weightError, setWeightError] = useState<string>("");
  const [paymentStatusError, setPaymentStatusError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calendar helper functions
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

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
    setShowYearDropdown(false);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowCalendar(false);
    setShowYearDropdown(false);
  };

  // Time picker options
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

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

  // Helper function to get today's date in dd/mm/yyyy format
  const getTodayDate = (): string => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Helper function to get current time in HH:MM AM/PM format
  const getCurrentTime = (): string => {
    const now = new Date();
    let hour = now.getHours();
    const minute = String(now.getMinutes()).padStart(2, '0');
    const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`;
  };

  // Calculate payment status based on amount paid and selling price
  const calculatePaymentStatus = (amountPaid: number, sellingPrice: number): 'none' | 'partial' | 'paid' => {
    if (amountPaid === 0) {
      return 'none';
    } else if (amountPaid >= sellingPrice) {
      return 'paid';
    } else {
      return 'partial';
    }
  };

  // Populate form when editing
  useEffect(() => {
    if (open) {
      const todayStr = getTodayDate();
      const currentTimeStr = getCurrentTime();

      if (isEdit && editData) {
        // Parse sale date
        let saleDateParsed: Date | null = null;
        let saleDateStr = todayStr;
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

        // Parse sale time
        let saleTimeStr = currentTimeStr;
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
        
        // Set date picker states
        if (saleDateParsed) {
          setSelectedDate(saleDateParsed);
          setCurrentMonth(saleDateParsed.getMonth());
          setCurrentYear(saleDateParsed.getFullYear());
        } else {
          const now = new Date();
          setSelectedDate(now);
          setCurrentMonth(now.getMonth());
          setCurrentYear(now.getFullYear());
        }

        // Set time picker states
        const saleTimeMatch = saleTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (saleTimeMatch) {
          setSelectedHour(saleTimeMatch[1].padStart(2, '0'));
          setSelectedMinute(saleTimeMatch[2]);
          setSelectedAmPm((saleTimeMatch[3] as "AM" | "PM") || "AM");
        }
        
        // Set receipt preview if exists
        if (editData.receiptImage) {
          setReceiptPreview(`${API_BASE_URL}${editData.receiptImage}`);
        }
      } else {
        resetForm();
      }
      
      // Fetch materials
      fetchMaterials();
    }
  }, [open, isEdit, editData]);

  // Update form data when date changes
  useEffect(() => {
    if (selectedDate) {
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedDate.getFullYear();
      setFormData(prev => ({ ...prev, purchaseDate: `${dd}/${mm}/${yyyy}` }));
    }
  }, [selectedDate]);

  // Update form data when time changes
  useEffect(() => {
    const timeStr = `${selectedHour}:${selectedMinute} ${selectedAmPm}`;
    setFormData(prev => ({ ...prev, purchaseTime: timeStr }));
  }, [selectedHour, selectedMinute, selectedAmPm]);

  // Update payment status when amount paid or selling price changes
  useEffect(() => {
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    
    if (sellingPrice > 0) {
      const paymentStatus = calculatePaymentStatus(amountPaid, sellingPrice);
      setFormData(prev => ({ ...prev, paymentStatus }));
    }
  }, [formData.amountPaid, formData.sellingPrice]);

  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const response = await api.get(API_ENDPOINTS.GET_ALL);
      
      if (response.data.success) {
        const materialsData = response.data.data || [];
        
        // Calculate available weight for each material
        const materialsWithAvailableWeight = await Promise.all(
          materialsData.map(async (material: Purchase) => {
            try {
              // Fetch sales for this material to calculate sold weight
              const salesResponse = await api.get(`${SALES_API_URL}/get-by-material/${material.materialName}`);
              let totalSoldWeight = 0;
              
              if (salesResponse.data.success && salesResponse.data.data) {
                salesResponse.data.data.forEach((sale: Sale) => {
                  totalSoldWeight += parseFloat(sale.weight) || 0;
                });
              }
              
              const totalWeight = parseFloat(material.weight) || 0;
              const availableWeight = totalWeight - totalSoldWeight;
              
              return {
                ...material,
                soldWeight: totalSoldWeight,
                availableWeight: availableWeight > 0 ? availableWeight : 0,
              };
            } catch (error) {
              // If error fetching sales, assume no sales yet
              const totalWeight = parseFloat(material.weight) || 0;
              return {
                ...material,
                soldWeight: 0,
                availableWeight: totalWeight,
              };
            }
          })
        );
        
        setMaterials(materialsWithAvailableWeight);
      } else {
        throw new Error(response.data.message || 'Failed to fetch materials');
      }
    } catch (error: any) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.supplierName.trim()) newErrors.supplierName = "Supplier name is required";
    if (!formData.invoiceNo.trim()) newErrors.invoiceNo = "Invoice number is required";
    
    // Weight validation with custom logic
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
    if (!formData.actualPrice || parseFloat(formData.actualPrice.replace(/,/g, '')) <= 0) newErrors.actualPrice = "Valid actual price is required";
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice.replace(/,/g, '')) <= 0) newErrors.sellingPrice = "Valid selling price is required";
    
    // Amount paid validation
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    if (amountPaid < 0) {
      newErrors.amountPaid = "Amount paid cannot be negative";
    } else if (amountPaid > sellingPrice) {
      newErrors.amountPaid = "Amount paid cannot exceed selling price";
    }
    
    if (!formData.buyerName.trim()) newErrors.buyerName = "Buyer name is required";
    if (!formData.buyerPhone.trim()) newErrors.buyerPhone = "Buyer phone is required";
    if (formData.buyerEmail && !/^\S+@\S+\.\S+$/.test(formData.buyerEmail)) newErrors.buyerEmail = "Invalid email address";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
      // For PDF files, show a PDF icon preview
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle amount paid special validation
    if (name === 'amountPaid') {
      const sellingPrice = parseFloat(formData.sellingPrice) || 0;
      const amountPaid = parseFloat(value) || 0;
      
      if (amountPaid > sellingPrice) {
        setPaymentStatusError(`Warning: Amount paid (${amountPaid}) exceeds selling price (${sellingPrice})`);
      } else {
        setPaymentStatusError("");
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate weight when weight changes
    if (name === 'weight' && selectedMaterialInfo) {
      const saleWeight = parseFloat(value);
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        setWeightError(`Warning: Sale weight exceeds available weight. Available: ${selectedMaterialInfo.availableWeight} kg`);
      } else {
        setWeightError("");
      }
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleMaterialSelect = (materialName: string) => {
    const selectedMaterial = materials.find(m => m.materialName === materialName);
    
    if (selectedMaterial) {
      setFormData(prev => ({ 
        ...prev, 
        materialName,
        supplierName: selectedMaterial.vendor || prev.supplierName,
        actualPrice: selectedMaterial.price || prev.actualPrice
      }));
      
      setSelectedColor(selectedMaterial.materialColor || "#FFFFFF");
      
      // Set material info for weight validation
      const totalWeight = parseFloat(selectedMaterial.weight) || 0;
      const soldWeight = selectedMaterial.soldWeight || 0;
      const availableWeight = selectedMaterial.availableWeight || totalWeight;
      
      setSelectedMaterialInfo({
        totalWeight,
        availableWeight,
        soldWeight,
        purchaseId: selectedMaterial._id,
        vendor: selectedMaterial.vendor,
        price: selectedMaterial.price,
        materialColor: selectedMaterial.materialColor
      });
      
      // Reset weight field
      setFormData(prev => ({ ...prev, weight: "" }));
      setWeightError("");
    }
  };

  const handleBranchSelect = (materialName: string) => {
    handleMaterialSelect(materialName);
    setFormData(prev => ({ ...prev, branch: materialName }));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Please fill in all required fields correctly.");
      return;
    }

    // Additional weight validation
    if (selectedMaterialInfo) {
      const saleWeight = parseFloat(formData.weight);
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        alert(`Sale weight cannot exceed available weight (${selectedMaterialInfo.availableWeight} kg)`);
        return;
      }
    }

    // Amount paid validation
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    
    if (amountPaid > sellingPrice) {
      alert(`Amount paid (${amountPaid}) cannot exceed selling price (${sellingPrice})`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Parse date from dd/mm/yyyy format
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

      // Calculate final amount
      const selling = parseFloat(formData.sellingPrice.replace(/,/g, '')) || 0;
      const discount = parseFloat(formData.discount.replace(/,/g, '')) || 0;
      const finalAmount = (selling - discount).toFixed(2);

      // Prepare FormData for API
      const formDataToSend = new FormData();
      
      // Required fields by controller:
      formDataToSend.append('purchaseId', selectedMaterialInfo?.purchaseId || '');
      formDataToSend.append('customerName', formData.buyerName); // buyerName → customerName
      formDataToSend.append('customerPhone', formData.buyerPhone);
      formDataToSend.append('customerEmail', formData.buyerEmail || '');
      formDataToSend.append('sellingPrice', formData.sellingPrice);
      formDataToSend.append('sellingWeight', formData.weight); // weight → sellingWeight
      formDataToSend.append('saleDate', dateTime);
      formDataToSend.append('paymentMethod', formData.paymentMethod);
      formDataToSend.append('amountPaid', formData.amountPaid); // NEW: Send amountPaid
      formDataToSend.append('invoiceNo', formData.invoiceNo);
      formDataToSend.append('transportationCost', formData.transportationCost);
      formDataToSend.append('notes', formData.notes);

      // Also include original Sale model fields (optional for backend)
      formDataToSend.append('materialName', formData.materialName);
      formDataToSend.append('supplierName', formData.supplierName);
      formDataToSend.append('unit', formData.unit);
      formDataToSend.append('branch', formData.branch);
      formDataToSend.append('materialColor', selectedColor);
      formDataToSend.append('actualPrice', formData.actualPrice);
      formDataToSend.append('productionCost', formData.productionCost || '0');
      formDataToSend.append('discount', formData.discount);
      formDataToSend.append('advancePayment', formData.advancePayment || '0');
      formDataToSend.append('buyerName', formData.buyerName);
      formDataToSend.append('buyerAddress', formData.buyerAddress || '');
      formDataToSend.append('buyerPhone', formData.buyerPhone);
      formDataToSend.append('buyerEmail', formData.buyerEmail || '');
      formDataToSend.append('buyerCnic', formData.buyerCnic || '');
      formDataToSend.append('buyerCompany', formData.buyerCompany || '');
      formDataToSend.append('finalAmount', finalAmount);
      formDataToSend.append('paymentStatus', formData.paymentStatus); // This will be auto-calculated by backend

      // Add receipt file if exists
      if (receiptFile) {
        formDataToSend.append('receiptImage', receiptFile);
      }

      let response;
      if (isEdit && editData && editData._id) {
        // If editing and want to remove existing receipt
        if (!receiptFile && !receiptPreview && editData.receiptImage) {
          // Remove receipt - your backend should handle this based on removeReceipt field
          formDataToSend.append('removeReceipt', 'true');
        }
        
        // UPDATE request using PUT to /api/sales/:id
        response = await api.put(
          API_ENDPOINTS.UPDATE_SALE(editData._id),
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        // CREATE request using POST to /api/sales/add-sale
        response = await api.post(
          API_ENDPOINTS.ADD_SALE,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }
      
      if (response.data.success) {
        onSave();
        onOpenChange(false);
        resetForm();
        alert(isEdit ? 'Sale updated successfully!' : 'Sale added successfully!');
      } else {
        throw new Error(response.data.message || 'Failed to save sale');
      }
      
    } catch (error: any) {
      console.error('Error saving sale:', error);
      
      // Detailed error handling
      if (error.response) {
        console.log('Response error:', error.response);
        const errorMessage = error.response.data?.message || 'Failed to save sale';
        const errors = error.response.data?.errors;
        
        if (errors && Array.isArray(errors)) {
          alert(`Validation errors:\n${errors.join('\n')}`);
        } else if (errors && typeof errors === 'object') {
          const errorList = Object.values(errors).flat().join('\n');
          alert(`Validation errors:\n${errorList}`);
        } else {
          alert(`Error: ${errorMessage}`);
        }
      } else if (error.request) {
        console.log('Request error:', error.request);
        alert(`Network error. Please check if the backend server is running at ${API_BASE_URL}.`);
      } else {
        console.log('Error message:', error.message);
        alert('Error: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const now = new Date();
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
      paymentStatus: "none", // Reset to 'none'
      amountPaid: "0", // Reset to 0
      transportationCost: "0",
      notes: "",
    });
    
    setSelectedColor("#FFFFFF");
    setSelectedDate(now);
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    setShowYearDropdown(false);
    
    const currentTimeMatch = currentTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (currentTimeMatch) {
      setSelectedHour(currentTimeMatch[1].padStart(2, '0'));
      setSelectedMinute(currentTimeMatch[2]);
      setSelectedAmPm((currentTimeMatch[3] as "AM" | "PM") || "AM");
    }
    
    setReceiptFile(null);
    setReceiptPreview(null);
    setSelectedMaterialInfo(null);
    setWeightError("");
    setPaymentStatusError("");
    setErrors({});
  };

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
                    onClick={() => setSelectedHour(h)}
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
                    onClick={() => setSelectedMinute(m)}
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
              onClick={() => setSelectedAmPm("AM")}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "AM" ? "bg-primary text-white" : "hover:bg-muted text-foreground"}`}
            >
              AM
            </button>
            <button
              onClick={() => setSelectedAmPm("PM")}
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
                  value={formData.materialName}
                  onChange={(e) => handleMaterialSelect(e.target.value)}
                  className={`w-full bg-cms-input-bg border ${errors.materialName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                >
                  <option value="">Select Material</option>
                  {loadingMaterials ? (
                    <option disabled>Loading materials...</option>
                  ) : materials.length === 0 ? (
                    <option disabled>No materials found in purchases</option>
                  ) : (
                    materials.map((material) => (
                      <option key={material._id} value={material.materialName}>
                        {material.materialName} - {material.quality} 
                        (Stock: {material.availableWeight}/{material.weight} kg)
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
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
                  Available: {selectedMaterialInfo.availableWeight} kg
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Unit *</label>
              <input
                type="text"
                name="unit"
                placeholder="e.g 2"
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
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCalendar(prev => !prev);
                      setShowTimePicker(false);
                      setShowYearDropdown(false);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.purchaseDate}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                  {renderCalendar()}
                </div>
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimePicker(prev => !prev);
                      setShowCalendar(false);
                      setShowYearDropdown(false);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.purchaseTime}
                      className={`w-full bg-cms-input-bg border ${errors.purchaseTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
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
                  onChange={(e) => handleBranchSelect(e.target.value)}
                  className={`w-full bg-cms-input-bg border ${errors.branch ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary`}
                >
                  <option value="">Select Material/Branch</option>
                  {loadingMaterials ? (
                    <option disabled>Loading materials...</option>
                  ) : materials.length === 0 ? (
                    <option disabled>No materials found in purchases</option>
                  ) : (
                    materials.map((material) => (
                      <option key={`branch-${material._id}`} value={material.materialName}>
                        {material.materialName} - Available: {material.availableWeight} kg
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.branch && (
                <p className="text-xs text-red-500 mt-1">{errors.branch}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Select a material to link this sale to raw material inventory
              </p>
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

          {/* Additional fields for controller */}
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
              {paymentStatusError && !errors.amountPaid && (
                <p className="text-xs text-amber-600 mt-1">{paymentStatusError}</p>
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
            <input
              type="text"
              name="notes"
              placeholder="Additional notes..."
              value={formData.notes}
              onChange={handleInputChange}
              className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Price Details Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Price Details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Actual Price *</label>
              <input
                type="number"
                name="actualPrice"
                placeholder="e.g 10000"
                value={formData.actualPrice}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full bg-cms-input-bg border ${errors.actualPrice ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.actualPrice && (
                <p className="text-xs text-red-500 mt-1">{errors.actualPrice}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Production Cost</label>
              <input
                type="number"
                name="productionCost"
                placeholder="e.g 5000"
                value={formData.productionCost}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
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
              <p className="text-xs text-muted-foreground mt-1">Optional</p>
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
              <div className="flex items-center justify-between">
                <p className={`text-lg font-bold ${
                  formData.paymentStatus === 'paid' ? 'text-green-600' :
                  formData.paymentStatus === 'partial' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {formData.paymentStatus === 'paid' ? 'Paid' :
                   formData.paymentStatus === 'partial' ? 'Partial' : 'None'}
                </p>
                {formData.paymentStatus === 'paid' && (
                  <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">✓ Completed</span>
                )}
                {formData.paymentStatus === 'partial' && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">⚠ Pending</span>
                )}
                {formData.paymentStatus === 'none' && (
                  <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">✗ Not Paid</span>
                )}
              </div>
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
                </div>
                <div className="border border-border rounded-lg p-4 bg-cms-input-bg">
                  <div className="flex flex-col items-center">
                    <img 
                      src={receiptPreview} 
                      alt="Receipt preview" 
                      className="max-w-full h-auto max-h-64 rounded-md border border-border"
                    />
                    <button
                      type="button"
                      onClick={removeReceipt}
                      className="mt-2 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Receipt
                    </button>
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
                    <X className="w-4 h-4" />
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

        {/* Buyer Details Section */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Buyer Details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Name *</label>
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
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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