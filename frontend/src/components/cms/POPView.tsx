import { useState, useEffect, useRef } from "react";
import { Search, Plus, Printer, Pencil, Trash2, Eye, ChevronLeft, ChevronRight, ShoppingCart, Loader2, Save, Upload, Calendar, Clock, X, Package, ChevronDown } from "lucide-react";
import { PurchaseDetailsView } from "./PurchaseDetailsView";
import { toast } from "@/hooks/use-toast";
import axios from "axios";

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// API endpoints
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`;
const SALES_API_URL = `${API_BASE_URL}/api/sales`;

interface Purchase {
  _id: string;
  materialName: string;
  vendor: string;
  price: string;
  weight: string;
  quality: string;
  purchaseDate: string;
  purchaseTime?: string;
  materialColor: string;
  vehicleName: string;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  vehicleColor: string;
  deliveryDate: string;
  deliveryTime?: string;
  receiptNo: string;
  vehicleImage: string;
  advancePayment: number;
  createdAt: string;
  updatedAt: string;
}

// Interface with remaining weight
interface PurchaseWithRemaining extends Purchase {
  totalWeight: number;
  soldWeight: number;
  remainingWeight: number;
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

// Quality options
const qualityOptions = [
  { value: "PP750", label: "PP750" },
  { value: "PP1000", label: "PP1000" },
  { value: "HD", label: "HD" },
  { value: "Natural", label: "Natural" },
  { value: "Dodya", label: "Dodya" },
  { value: "Pipe", label: "Pipe" },
];

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  isEdit?: boolean;
  editData?: Purchase | null;
}

function PurchaseDialog({ open, onOpenChange, onSave, isEdit = false, editData = null }: DialogProps) {
  // Date picker states for purchase
  const [showPurchaseCalendar, setShowPurchaseCalendar] = useState(false);
  const [showPurchaseTimePicker, setShowPurchaseTimePicker] = useState(false);
  const [purchaseCurrentMonth, setPurchaseCurrentMonth] = useState(new Date().getMonth());
  const [purchaseCurrentYear, setPurchaseCurrentYear] = useState(new Date().getFullYear());
  const [selectedPurchaseDate, setSelectedPurchaseDate] = useState<Date | null>(null);
  
  // Date picker states for delivery
  const [showDeliveryCalendar, setShowDeliveryCalendar] = useState(false);
  const [showDeliveryTimePicker, setShowDeliveryTimePicker] = useState(false);
  const [deliveryCurrentMonth, setDeliveryCurrentMonth] = useState(new Date().getMonth());
  const [deliveryCurrentYear, setDeliveryCurrentYear] = useState(new Date().getFullYear());
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<Date | null>(null);
  
  // Time states for purchase
  const [selectedPurchaseHour, setSelectedPurchaseHour] = useState("12");
  const [selectedPurchaseMinute, setSelectedPurchaseMinute] = useState("00");
  const [selectedPurchaseAmPm, setSelectedPurchaseAmPm] = useState<"AM" | "PM">("PM");
  
  // Time states for delivery
  const [selectedDeliveryHour, setSelectedDeliveryHour] = useState("09");
  const [selectedDeliveryMinute, setSelectedDeliveryMinute] = useState("00");
  const [selectedDeliveryAmPm, setSelectedDeliveryAmPm] = useState<"AM" | "PM">("AM");

  // Year dropdown states
  const [showPurchaseYearDropdown, setShowPurchaseYearDropdown] = useState(false);
  const [showDeliveryYearDropdown, setShowDeliveryYearDropdown] = useState(false);
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);

  // Refs for click outside handling
  const purchaseCalendarRef = useRef<HTMLDivElement>(null);
  const purchaseTimeRef = useRef<HTMLDivElement>(null);
  const deliveryCalendarRef = useRef<HTMLDivElement>(null);
  const deliveryTimeRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    materialName: "",
    vendor: "",
    price: "",
    weight: "",
    quality: "PP750",
    purchaseDate: "",
    purchaseTime: "",
    materialColor: "#FFFFFF",
    vehicleName: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    vehicleColor: "",
    deliveryDate: "",
    deliveryTime: "",
    receiptNo: "",
    advancePayment: "",
    vehicleImage: null as File | null,
  });

  const [selectedMaterialColor, setSelectedMaterialColor] = useState("#FFFFFF");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (purchaseCalendarRef.current && !purchaseCalendarRef.current.contains(event.target as Node)) {
        setShowPurchaseCalendar(false);
        setShowPurchaseYearDropdown(false);
      }
      if (purchaseTimeRef.current && !purchaseTimeRef.current.contains(event.target as Node)) {
        setShowPurchaseTimePicker(false);
      }
      if (deliveryCalendarRef.current && !deliveryCalendarRef.current.contains(event.target as Node)) {
        setShowDeliveryCalendar(false);
        setShowDeliveryYearDropdown(false);
      }
      if (deliveryTimeRef.current && !deliveryTimeRef.current.contains(event.target as Node)) {
        setShowDeliveryTimePicker(false);
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

  // Helper function to construct image URL
  const getImageUrl = (imagePath: string | undefined): string | null => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    
    if (cleanPath.startsWith('uploads/')) {
      return `${API_BASE_URL}/${cleanPath}`;
    }
    
    if (!cleanPath.includes('/')) {
      return `${API_BASE_URL}/uploads/${cleanPath}`;
    }
    
    return `${API_BASE_URL}/${cleanPath}`;
  };

  // Populate form when editing
  useEffect(() => {
    if (open) {
      const now = new Date();
      const todayStr = getTodayDate();
      const currentTimeStr = getCurrentTime();

      if (isEdit && editData) {
        // Parse purchase date
        let purchaseDateParsed: Date | null = null;
        let purchaseDateStr = todayStr;
        if (editData.purchaseDate) {
          try {
            purchaseDateParsed = new Date(editData.purchaseDate);
            if (!isNaN(purchaseDateParsed.getTime())) {
              const dd = String(purchaseDateParsed.getDate()).padStart(2, '0');
              const mm = String(purchaseDateParsed.getMonth() + 1).padStart(2, '0');
              const yyyy = purchaseDateParsed.getFullYear();
              purchaseDateStr = `${dd}/${mm}/${yyyy}`;
            }
          } catch (error) {
            console.error("Error parsing purchase date:", error);
          }
        }

        // Parse delivery date
        let deliveryDateParsed: Date | null = null;
        let deliveryDateStr = "";
        if (editData.deliveryDate) {
          try {
            deliveryDateParsed = new Date(editData.deliveryDate);
            if (!isNaN(deliveryDateParsed.getTime())) {
              const dd = String(deliveryDateParsed.getDate()).padStart(2, '0');
              const mm = String(deliveryDateParsed.getMonth() + 1).padStart(2, '0');
              const yyyy = deliveryDateParsed.getFullYear();
              deliveryDateStr = `${dd}/${mm}/${yyyy}`;
            }
          } catch (error) {
            console.error("Error parsing delivery date:", error);
          }
        }

        // Parse purchase time
        let purchaseTimeStr = currentTimeStr;
        if (editData.purchaseTime) {
          const match = editData.purchaseTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            purchaseTimeStr = `${match[1].padStart(2, '0')}:${match[2]} ${(match[3] || 'AM').toUpperCase()}`;
          }
        }

        // Parse delivery time
        let deliveryTimeStr = "09:00 AM";
        if (editData.deliveryTime) {
          const match = editData.deliveryTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            deliveryTimeStr = `${match[1].padStart(2, '0')}:${match[2]} ${(match[3] || 'AM').toUpperCase()}`;
          }
        }

        setFormData({
          materialName: editData.materialName || "",
          vendor: editData.vendor || "",
          price: editData.price || "",
          weight: editData.weight || "",
          quality: editData.quality || "PP750",
          purchaseDate: purchaseDateStr,
          purchaseTime: purchaseTimeStr,
          materialColor: editData.materialColor || "#FFFFFF",
          vehicleName: editData.vehicleName || "",
          vehicleType: editData.vehicleType || "",
          vehicleNumber: editData.vehicleNumber || "",
          driverName: editData.driverName || "",
          vehicleColor: editData.vehicleColor || "",
          deliveryDate: deliveryDateStr,
          deliveryTime: deliveryTimeStr,
          receiptNo: editData.receiptNo || "",
          advancePayment: editData.advancePayment?.toString() || "",
          vehicleImage: null,
        });
        
        setSelectedMaterialColor(editData.materialColor || "#FFFFFF");
        
        // Set date picker states for purchase
        if (purchaseDateParsed) {
          setSelectedPurchaseDate(purchaseDateParsed);
          setPurchaseCurrentMonth(purchaseDateParsed.getMonth());
          setPurchaseCurrentYear(purchaseDateParsed.getFullYear());
        } else {
          setSelectedPurchaseDate(now);
          setPurchaseCurrentMonth(now.getMonth());
          setPurchaseCurrentYear(now.getFullYear());
        }

        // Set date picker states for delivery
        if (deliveryDateParsed) {
          setSelectedDeliveryDate(deliveryDateParsed);
          setDeliveryCurrentMonth(deliveryDateParsed.getMonth());
          setDeliveryCurrentYear(deliveryDateParsed.getFullYear());
        } else {
          setSelectedDeliveryDate(null);
        }

        // Set time picker states for purchase
        const purchaseTimeMatch = purchaseTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (purchaseTimeMatch) {
          setSelectedPurchaseHour(purchaseTimeMatch[1].padStart(2, '0'));
          setSelectedPurchaseMinute(purchaseTimeMatch[2]);
          setSelectedPurchaseAmPm((purchaseTimeMatch[3] as "AM" | "PM") || "AM");
        }

        // Set time picker states for delivery
        const deliveryTimeMatch = deliveryTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (deliveryTimeMatch) {
          setSelectedDeliveryHour(deliveryTimeMatch[1].padStart(2, '0'));
          setSelectedDeliveryMinute(deliveryTimeMatch[2]);
          setSelectedDeliveryAmPm((deliveryTimeMatch[3] as "AM" | "PM") || "AM");
        }
        
        if (editData.vehicleImage) {
          const imageUrl = getImageUrl(editData.vehicleImage);
          setImagePreview(imageUrl);
          setOriginalImageUrl(imageUrl);
        } else {
          setImagePreview(null);
          setOriginalImageUrl(null);
        }
      } else {
        resetForm();
      }
    }
  }, [open, isEdit, editData]);

  // Update form data when purchase date changes
  useEffect(() => {
    if (selectedPurchaseDate) {
      const dd = String(selectedPurchaseDate.getDate()).padStart(2, '0');
      const mm = String(selectedPurchaseDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedPurchaseDate.getFullYear();
      setFormData(prev => ({ ...prev, purchaseDate: `${dd}/${mm}/${yyyy}` }));
    }
  }, [selectedPurchaseDate]);

  // Update form data when delivery date changes
  useEffect(() => {
    if (selectedDeliveryDate) {
      const dd = String(selectedDeliveryDate.getDate()).padStart(2, '0');
      const mm = String(selectedDeliveryDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedDeliveryDate.getFullYear();
      setFormData(prev => ({ ...prev, deliveryDate: `${dd}/${mm}/${yyyy}` }));
    } else {
      setFormData(prev => ({ ...prev, deliveryDate: "" }));
    }
  }, [selectedDeliveryDate]);

  // Update form data when purchase time changes
  useEffect(() => {
    const timeStr = `${selectedPurchaseHour}:${selectedPurchaseMinute} ${selectedPurchaseAmPm}`;
    setFormData(prev => ({ ...prev, purchaseTime: timeStr }));
  }, [selectedPurchaseHour, selectedPurchaseMinute, selectedPurchaseAmPm]);

  // Update form data when delivery time changes
  useEffect(() => {
    const timeStr = `${selectedDeliveryHour}:${selectedDeliveryMinute} ${selectedDeliveryAmPm}`;
    setFormData(prev => ({ ...prev, deliveryTime: timeStr }));
  }, [selectedDeliveryHour, selectedDeliveryMinute, selectedDeliveryAmPm]);

  // Calendar helper functions
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  // Purchase calendar handlers
  const handlePurchasePrevMonth = () => {
    if (purchaseCurrentMonth === 0) {
      setPurchaseCurrentMonth(11);
      setPurchaseCurrentYear(y => y - 1);
    } else {
      setPurchaseCurrentMonth(m => m - 1);
    }
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseNextMonth = () => {
    if (purchaseCurrentMonth === 11) {
      setPurchaseCurrentMonth(0);
      setPurchaseCurrentYear(y => y + 1);
    } else {
      setPurchaseCurrentMonth(m => m + 1);
    }
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseYearSelect = (year: number) => {
    setPurchaseCurrentYear(year);
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseDateSelect = (day: number) => {
    const date = new Date(purchaseCurrentYear, purchaseCurrentMonth, day);
    setSelectedPurchaseDate(date);
    setShowPurchaseCalendar(false);
    setShowPurchaseYearDropdown(false);
  };

  const handlePurchaseToday = () => {
    const today = new Date();
    setSelectedPurchaseDate(today);
    setPurchaseCurrentMonth(today.getMonth());
    setPurchaseCurrentYear(today.getFullYear());
    setShowPurchaseCalendar(false);
    setShowPurchaseYearDropdown(false);
  };

  // Delivery calendar handlers
  const handleDeliveryPrevMonth = () => {
    if (deliveryCurrentMonth === 0) {
      setDeliveryCurrentMonth(11);
      setDeliveryCurrentYear(y => y - 1);
    } else {
      setDeliveryCurrentMonth(m => m - 1);
    }
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryNextMonth = () => {
    if (deliveryCurrentMonth === 11) {
      setDeliveryCurrentMonth(0);
      setDeliveryCurrentYear(y => y + 1);
    } else {
      setDeliveryCurrentMonth(m => m + 1);
    }
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryYearSelect = (year: number) => {
    setDeliveryCurrentYear(year);
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryDateSelect = (day: number) => {
    const date = new Date(deliveryCurrentYear, deliveryCurrentMonth, day);
    setSelectedDeliveryDate(date);
    setShowDeliveryCalendar(false);
    setShowDeliveryYearDropdown(false);
  };

  const handleDeliveryToday = () => {
    const today = new Date();
    setSelectedDeliveryDate(today);
    setDeliveryCurrentMonth(today.getMonth());
    setDeliveryCurrentYear(today.getFullYear());
    setShowDeliveryCalendar(false);
    setShowDeliveryYearDropdown(false);
  };

  // Time picker options
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required";
    if (!formData.vendor.trim()) newErrors.vendor = "Vendor is required";
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = "Valid price is required";
    if (!formData.weight || parseFloat(formData.weight) <= 0) newErrors.weight = "Valid weight is required";
    if (!formData.quality) newErrors.quality = "Quality is required";
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required";
    if (!formData.purchaseTime) newErrors.purchaseTime = "Purchase time is required";
    if (!formData.vehicleName.trim()) newErrors.vehicleName = "Vehicle name is required";
    if (!formData.vehicleType.trim()) newErrors.vehicleType = "Vehicle type is required";
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = "Vehicle number is required";
    if (!formData.driverName.trim()) newErrors.driverName = "Driver name is required";
    if (!formData.vehicleColor.trim()) newErrors.vehicleColor = "Vehicle color is required";
    if (!formData.deliveryDate) newErrors.deliveryDate = "Delivery date is required";
    if (!formData.deliveryTime) newErrors.deliveryTime = "Delivery time is required";
    if (!formData.receiptNo.trim()) newErrors.receiptNo = "Receipt number is required";
    
    if (formData.advancePayment && isNaN(Number(formData.advancePayment))) {
      newErrors.advancePayment = "Advance payment must be a valid number";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleQualityChange = (quality: string) => {
    setFormData(prev => ({ ...prev, quality }));
    if (errors.quality) {
      setErrors(prev => ({ ...prev, quality: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size should be less than 5MB");
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file");
        return;
      }
      
      setFormData(prev => ({ ...prev, vehicleImage: file }));
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formDataToSend = new FormData();
      
      // Convert date strings to ISO format for backend
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

      const purchaseDateTime = parseDate(formData.purchaseDate, formData.purchaseTime);
      const deliveryDateTime = parseDate(formData.deliveryDate, formData.deliveryTime);

      const fields = {
        materialName: formData.materialName,
        vendor: formData.vendor,
        price: formData.price,
        weight: formData.weight,
        quality: formData.quality,
        purchaseDate: purchaseDateTime,
        materialColor: selectedMaterialColor,
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: formData.vehicleColor,
        deliveryDate: deliveryDateTime,
        receiptNo: formData.receiptNo,
        advancePayment: formData.advancePayment || 0,
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formDataToSend.append(key, String(value));
        }
      });

      if (formData.vehicleImage) {
        formDataToSend.append('vehicleImage', formData.vehicleImage);
      }

      let response;
      if (isEdit && editData && editData._id) {
        response = await api.put(
          `${PURCHASES_API_URL}/${editData._id}`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      } else {
        response = await api.post(
          `${PURCHASES_API_URL}/add`,
          formDataToSend,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );
      }
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: isEdit ? "Purchase updated successfully!" : "Purchase added successfully!",
        });
        onSave();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(response.data.message || 'Failed to save purchase');
      }
      
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      
      if (error.response) {
        const errorMessage = error.response.data?.message || 'Failed to save purchase';
        const errors = error.response.data?.errors;
        
        if (errors && Array.isArray(errors)) {
          toast({
            title: "Error",
            description: `Validation errors:\n${errors.join('\n')}`,
            variant: "destructive",
          });
        } else if (errors && typeof errors === 'object') {
          const errorList = Object.values(errors).flat().join('\n');
          toast({
            title: "Error",
            description: `Validation errors:\n${errorList}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else if (error.request) {
        toast({
          title: "Error",
          description: `Network error. Please check if the backend server is running at ${API_BASE_URL}.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
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
      vendor: "",
      price: "",
      weight: "",
      quality: "PP750",
      purchaseDate: todayStr,
      purchaseTime: currentTimeStr,
      materialColor: "#FFFFFF",
      vehicleName: "",
      vehicleType: "",
      vehicleNumber: "",
      driverName: "",
      vehicleColor: "",
      deliveryDate: "",
      deliveryTime: "09:00 AM",
      receiptNo: "",
      advancePayment: "",
      vehicleImage: null,
    });
    
    setSelectedMaterialColor("#FFFFFF");
    setSelectedPurchaseDate(now);
    setSelectedDeliveryDate(null);
    setPurchaseCurrentMonth(now.getMonth());
    setPurchaseCurrentYear(now.getFullYear());
    setDeliveryCurrentMonth(now.getMonth());
    setDeliveryCurrentYear(now.getFullYear());
    setShowPurchaseYearDropdown(false);
    setShowDeliveryYearDropdown(false);
    
    const currentTimeMatch = currentTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (currentTimeMatch) {
      setSelectedPurchaseHour(currentTimeMatch[1].padStart(2, '0'));
      setSelectedPurchaseMinute(currentTimeMatch[2]);
      setSelectedPurchaseAmPm((currentTimeMatch[3] as "AM" | "PM") || "AM");
    }
    
    setSelectedDeliveryHour("09");
    setSelectedDeliveryMinute("00");
    setSelectedDeliveryAmPm("AM");
    
    setImagePreview(null);
    setOriginalImageUrl(null);
    setErrors({});
    
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Render calendar popup
  const renderCalendar = (type: 'purchase' | 'delivery') => {
    const showCalendar = type === 'purchase' ? showPurchaseCalendar : showDeliveryCalendar;
    const calendarRef = type === 'purchase' ? purchaseCalendarRef : deliveryCalendarRef;
    const currentMonth = type === 'purchase' ? purchaseCurrentMonth : deliveryCurrentMonth;
    const currentYear = type === 'purchase' ? purchaseCurrentYear : deliveryCurrentYear;
    const handlePrevMonth = type === 'purchase' ? handlePurchasePrevMonth : handleDeliveryPrevMonth;
    const handleNextMonth = type === 'purchase' ? handlePurchaseNextMonth : handleDeliveryNextMonth;
    const handleToday = type === 'purchase' ? handlePurchaseToday : handleDeliveryToday;
    const handleDateSelect = type === 'purchase' ? handlePurchaseDateSelect : handleDeliveryDateSelect;
    const selectedDate = type === 'purchase' ? selectedPurchaseDate : selectedDeliveryDate;
    const showYearDropdown = type === 'purchase' ? showPurchaseYearDropdown : showDeliveryYearDropdown;
    const setShowYearDropdown = type === 'purchase' ? setShowPurchaseYearDropdown : setShowDeliveryYearDropdown;
    const handleYearSelect = type === 'purchase' ? handlePurchaseYearSelect : handleDeliveryYearSelect;

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
  const renderTimePicker = (type: 'purchase' | 'delivery') => {
    const showTimePicker = type === 'purchase' ? showPurchaseTimePicker : showDeliveryTimePicker;
    const timeRef = type === 'purchase' ? purchaseTimeRef : deliveryTimeRef;
    const selectedHour = type === 'purchase' ? selectedPurchaseHour : selectedDeliveryHour;
    const selectedMinute = type === 'purchase' ? selectedPurchaseMinute : selectedDeliveryMinute;
    const selectedAmPm = type === 'purchase' ? selectedPurchaseAmPm : selectedDeliveryAmPm;
    const setSelectedHour = type === 'purchase' ? setSelectedPurchaseHour : setSelectedDeliveryHour;
    const setSelectedMinute = type === 'purchase' ? setSelectedPurchaseMinute : setSelectedDeliveryMinute;
    const setSelectedAmPm = type === 'purchase' ? setSelectedPurchaseAmPm : setSelectedDeliveryAmPm;

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Point Of Purchase / {isEdit ? 'Edit Purchase' : 'Add Purchase'}
          </p>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {isEdit ? 'Edit Purchase' : 'Add New Purchase'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update the purchase details' : 'Enter the details for the new asset purchase and delivery'}
            </p>
          </div>

          {/* Product Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Product Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
                <input
                  type="text"
                  name="materialName"
                  placeholder="e.g Steel Beams"
                  value={formData.materialName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.materialName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.materialName && (
                  <p className="text-xs text-red-500 mt-1">{errors.materialName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vendor *</label>
                <input
                  type="text"
                  name="vendor"
                  placeholder="e.g Acme Inc."
                  value={formData.vendor}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vendor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vendor && (
                  <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Price *</label>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  placeholder="e.g 10000"
                  value={formData.price}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.price ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Weight (kg) *</label>
                <input
                  type="number"
                  name="weight"
                  min="0"
                  step="0.1"
                  placeholder="e.g 500"
                  value={formData.weight}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.weight ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.weight && (
                  <p className="text-xs text-red-500 mt-1">{errors.weight}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Quality *</label>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {qualityOptions.map((option) => (
                    <label 
                      key={option.value} 
                      className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:bg-cms-card-hover px-2 py-1 rounded transition-colors"
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={option.value}
                        checked={formData.quality === option.value}
                        onChange={() => handleQualityChange(option.value)}
                        className="sr-only"
                      />
                      <div className="w-4 h-4 border border-border bg-cms-card rounded flex items-center justify-center">
                        {formData.quality === option.value && (
                          <div className="w-2 h-2 bg-primary rounded-sm" />
                        )}
                      </div>
                      {option.label}
                    </label>
                  ))}
                </div>
                {errors.quality && (
                  <p className="text-xs text-red-500 mt-1">{errors.quality}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purchase Date & Time *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPurchaseCalendar(prev => !prev);
                        setShowPurchaseTimePicker(false);
                        setShowPurchaseYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="dd/mm/yyyy"
                        value={formData.purchaseDate}
                        className={`w-full bg-cms-card border ${errors.purchaseDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderCalendar('purchase')}
                  </div>
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPurchaseTimePicker(prev => !prev);
                        setShowPurchaseCalendar(false);
                        setShowPurchaseYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="-- : --"
                        value={formData.purchaseTime}
                        className={`w-full bg-cms-card border ${errors.purchaseTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderTimePicker('purchase')}
                  </div>
                </div>
                {(errors.purchaseDate || errors.purchaseTime) && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.purchaseDate || errors.purchaseTime}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-2">Material Color *</label>
                <div className="flex flex-wrap items-center gap-3">
                  {colorOptions.map((color) => (
                    <label key={color.value} className="flex items-center gap-1.5 cursor-pointer">
                      <div className="relative flex items-center">
                        <input
                          type="radio"
                          name="materialColor"
                          value={color.value}
                          checked={selectedMaterialColor === color.value}
                          onChange={() => setSelectedMaterialColor(color.value)}
                          className="sr-only"
                        />
                        <div 
                          className={`w-5 h-5 rounded-full ${color.color} border-2 ${
                            selectedMaterialColor === color.value 
                              ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' 
                              : 'border-border'
                          }`} 
                        />
                      </div>
                      <span className="text-xs text-foreground">{color.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Advance Payment</label>
                <input
                  type="number"
                  name="advancePayment"
                  min="0"
                  step="0.01"
                  placeholder="e.g 20000"
                  value={formData.advancePayment}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.advancePayment ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.advancePayment && (
                  <p className="text-xs text-red-500 mt-1">{errors.advancePayment}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Optional</p>
              </div>
            </div>
          </div>

          {/* Delivery Vehicle Details Section */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Delivery Vehicle Details</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Name *</label>
                <input
                  type="text"
                  name="vehicleName"
                  placeholder="e.g Heavy Truck"
                  value={formData.vehicleName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleName && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Type *</label>
                <input
                  type="text"
                  name="vehicleType"
                  placeholder="e.g Truck"
                  value={formData.vehicleType}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleType ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleType && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleType}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Number *</label>
                <input
                  type="text"
                  name="vehicleNumber"
                  placeholder="e.g MS-12_Ab"
                  value={formData.vehicleNumber}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleNumber ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleNumber && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Driver Name *</label>
                <input
                  type="text"
                  name="driverName"
                  placeholder="e.g Smith"
                  value={formData.driverName}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.driverName ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.driverName && (
                  <p className="text-xs text-red-500 mt-1">{errors.driverName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Vehicle Color *</label>
                <input
                  type="text"
                  name="vehicleColor"
                  placeholder="e.g Black, Pink, Metallic Red, Dark Blue, etc."
                  value={formData.vehicleColor}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.vehicleColor ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.vehicleColor && (
                  <p className="text-xs text-red-500 mt-1">{errors.vehicleColor}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Delivery Date & Time *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeliveryCalendar(prev => !prev);
                        setShowDeliveryTimePicker(false);
                        setShowDeliveryYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="dd/mm/yyyy"
                        value={formData.deliveryDate}
                        className={`w-full bg-cms-card border ${errors.deliveryDate ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderCalendar('delivery')}
                  </div>
                  <div className="relative flex-1">
                    <div 
                      className="relative cursor-pointer select-none touch-manipulation"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowDeliveryTimePicker(prev => !prev);
                        setShowDeliveryCalendar(false);
                        setShowDeliveryYearDropdown(false);
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="-- : --"
                        value={formData.deliveryTime}
                        className={`w-full bg-cms-card border ${errors.deliveryTime ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none`}
                      />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    {renderTimePicker('delivery')}
                  </div>
                </div>
                {(errors.deliveryDate || errors.deliveryTime) && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.deliveryDate || errors.deliveryTime}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Receipt No. *</label>
                <input
                  type="text"
                  name="receiptNo"
                  placeholder="e.g AB1232"
                  value={formData.receiptNo}
                  onChange={handleInputChange}
                  className={`w-full bg-cms-card border ${errors.receiptNo ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.receiptNo && (
                  <p className="text-xs text-red-500 mt-1">{errors.receiptNo}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-muted-foreground mb-1.5">Recepiet Image</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-cms-card border border-border rounded-md cursor-pointer hover:bg-cms-card-hover transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm text-foreground">Choose File...</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {imagePreview && (
                    <div className="relative w-16 h-16 border border-border rounded-md overflow-hidden">
                      <img 
                        src={imagePreview} 
                        alt="Vehicle preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {isEdit && !formData.vehicleImage && originalImageUrl && (
                    <div className="text-xs text-muted-foreground">
                      Current image will be kept
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.vehicleImage ? formData.vehicleImage.name : 'No new file chosen'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
      </div>
    </div>
  );
}

// MAIN EXPORT
export function POPView() {
  const [purchases, setPurchases] = useState<PurchaseWithRemaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<PurchaseWithRemaining | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch purchases on component mount
  useEffect(() => {
    fetchPurchases();
  }, []);

  // FIXED: Fetch sold weight by purchase ID (not material name)
  const fetchSoldWeightForPurchase = async (purchaseId: string): Promise<number> => {
    try {
      const response = await api.get(`${SALES_API_URL}/purchase/${purchaseId}`);
      if (response.data.success && response.data.data) {
        let totalSoldWeight = 0;
        response.data.data.forEach((sale: any) => {
          totalSoldWeight += parseFloat(sale.sellingWeight) || 0;
        });
        return totalSoldWeight;
      }
      return 0;
    } catch (error) {
      console.error('Error fetching sales for purchase:', error);
      return 0;
    }
  };

  // Calculate remaining weight
  const calculateRemainingWeight = (totalWeight: number, soldWeight: number): number => {
    return totalWeight - soldWeight;
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`${PURCHASES_API_URL}/get-all`);
      
      if (response.data.success) {
        const purchasesData = response.data.data || [];
        
        // Calculate sold weight and remaining weight for each purchase
        const purchasesWithRemaining = await Promise.all(
          purchasesData.map(async (purchase: Purchase) => {
            const totalWeight = parseFloat(purchase.weight) || 0;
            const soldWeight = await fetchSoldWeightForPurchase(purchase._id);
            const remainingWeight = calculateRemainingWeight(totalWeight, soldWeight);
            
            return {
              ...purchase,
              totalWeight,
              soldWeight,
              remainingWeight: remainingWeight > 0 ? remainingWeight : 0
            };
          })
        );
        
        setPurchases(purchasesWithRemaining);
      } else {
        throw new Error(response.data.message || 'Failed to fetch purchases');
      }
    } catch (error: any) {
      console.error('Error fetching purchases:', error);
      setError(error.response?.data?.message || error.message || 'Failed to fetch purchases');
      toast({
        title: "Error",
        description: "Failed to load purchases. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchase = async () => {
    await fetchPurchases();
  };

  const handleEditPurchase = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseForEdit(purchase);
    setIsEditMode(true);
    setDialogOpen(true);
  };

const handleDeletePurchase = async (id: string) => {
  if (window.confirm('Are you sure you want to delete this purchase?')) {
    try {
      console.log('Attempting to delete purchase with ID:', id);
      
      // First, check if we can delete directly without sales check
      // Or handle the 404 error gracefully for the sales check
      try {
        // Try to check for sales, but don't fail if the endpoint doesn't exist
        const salesResponse = await api.get(`${SALES_API_URL}/purchase/${id}`).catch(error => {
          // If it's a 404, the endpoint might not exist, so we'll skip the check
          if (error.response?.status === 404) {
            console.log('Sales check endpoint not found, skipping sales verification');
            return null;
          }
          throw error;
        });
        
        // If we got a response and there are sales, prevent deletion
        if (salesResponse?.data?.success && salesResponse.data.data?.length > 0) {
          toast({
            title: "Cannot Delete",
            description: "This purchase has existing sales. Delete the sales first.",
            variant: "destructive",
          });
          return;
        }
      } catch (salesError: any) {
        // If sales check fails for other reasons, log but continue
        console.warn('Sales check failed, proceeding with delete:', salesError.message);
      }

      // Now try to delete the purchase
      const deleteResponse = await api.delete(`${PURCHASES_API_URL}/${id}`);
      console.log('Delete response:', deleteResponse.data);
      
      if (deleteResponse.data.success) {
        await fetchPurchases();
        toast({
          title: "Success",
          description: "Purchase deleted successfully!",
        });
      } else {
        throw new Error(deleteResponse.data.message || 'Failed to delete purchase');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      
      let errorMessage = "Failed to delete purchase";
      
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "Purchase not found. It may have already been deleted.";
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }
};

  const handleViewDetails = (purchase: PurchaseWithRemaining) => {
    setSelectedPurchaseId(purchase._id);
    setShowDetails(true);
  };

  const handleAddNew = () => {
    setSelectedPurchaseForEdit(null);
    setIsEditMode(false);
    setDialogOpen(true);
  };

  // Filter purchases based on search term
  const filteredPurchases = purchases.filter(purchase =>
    purchase.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    purchase.receiptNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date and time for display
  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
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

  // Format currency
  const formatCurrency = (amount: string) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) return '0';
      return numAmount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } catch (error) {
      return amount;
    }
  };

  // Format advance payment
  const formatAdvancePayment = (amount: number) => {
    if (!amount && amount !== 0) return '0';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  };

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredPurchases.slice(startIndex, endIndex);

  // If showing details, render PurchaseDetailsView
  if (showDetails && selectedPurchaseId) {
    return (
      <PurchaseDetailsView 
        purchaseId={selectedPurchaseId} 
        onBack={() => {
          setShowDetails(false);
          setSelectedPurchaseId(null);
        }} 
      />
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="w-8 h-6 border-2 border-primary rounded-sm flex items-center justify-center">
          <div className="w-4 h-0.5 bg-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Point Of Purchase (POP)</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Purchases</p>
              <p className="text-2xl font-semibold text-foreground">{purchases.length}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Weight</p>
              <p className="text-2xl font-semibold text-foreground">
                {purchases.reduce((total, p) => total + p.totalWeight, 0).toLocaleString()} kg
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <div className="text-blue-500 text-lg font-bold">Σ</div>
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sold Weight</p>
              <p className="text-2xl font-semibold text-foreground">
                {purchases.reduce((total, p) => total + p.soldWeight, 0).toLocaleString()} kg
              </p>
            </div>
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Remaining Weight</p>
              <p className="text-2xl font-semibold text-foreground">
                {purchases.reduce((total, p) => total + p.remainingWeight, 0).toLocaleString()} kg
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-semibold text-foreground">
                Rs. {purchases.reduce((total, p) => total + (parseFloat(p.price) || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <span className="text-green-500 text-lg font-bold">₹</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for anything..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-72"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddNew}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
          <button 
            onClick={() => window.print()}
            className="px-4 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-cms-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading purchases...</span>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No purchases found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No purchases match your search.' : 'Add your first purchase to get started.'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" />
                Add First Purchase
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-cms-table-header">
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Receipt No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Sold Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining Weight (kg)</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Price</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Advance Paid</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Vehicle No.</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date & Time</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Stock Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((purchase, index) => (
                  <tr
                    key={purchase._id}
                    className={`border-t border-border ${index % 2 === 0 ? 'bg-cms-table-row' : 'bg-cms-table-row-alt'} hover:bg-cms-card-hover transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: purchase.materialColor || '#FFFFFF' }}
                        />
                        <span className="text-sm font-medium text-foreground">{purchase.receiptNo || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="font-medium">{purchase.materialName || 'N/A'}</div>
                      <div className="text-xs text-muted-foreground">{purchase.quality || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="font-medium">{purchase.totalWeight.toLocaleString()} kg</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className={`font-medium ${purchase.soldWeight > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                        {purchase.soldWeight.toLocaleString()} kg
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className={`font-medium ${
                        purchase.remainingWeight > 0 
                          ? 'text-green-600' 
                          : purchase.remainingWeight === 0 
                            ? 'text-amber-600' 
                            : 'text-red-600'
                      }`}>
                        {purchase.remainingWeight.toLocaleString()} kg
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">Rs. {formatCurrency(purchase.price)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">Rs. {formatAdvancePayment(purchase.advancePayment)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{purchase.vendor || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{purchase.vehicleNumber || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-primary">{formatDateTime(purchase.purchaseDate || purchase.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex">
                        {purchase.remainingWeight > purchase.totalWeight * 0.5 ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            In Stock
                          </span>
                        ) : purchase.remainingWeight > 0 ? (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            Low Stock
                          </span>
                        ) : purchase.remainingWeight === 0 ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Over Sold
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleEditPurchase(purchase)}
                          className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleViewDetails(purchase)}
                          className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePurchase(purchase._id)}
                          className="p-1.5 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-border">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-secondary text-muted-foreground'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="text-muted-foreground px-2">...</span>
                )}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary text-muted-foreground'
                    }`}
                  >
                    {totalPages}
                  </button>
                )}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Purchase Dialog */}
      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddPurchase}
        isEdit={isEditMode}
        editData={selectedPurchaseForEdit}
      />
    </div>
  );
}

// Default export
export default POPView;