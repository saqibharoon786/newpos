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
import api, { API_BASE_URL } from "@/lib/api";
import { getCurrentUser, canApprove } from "@/lib/auth";
import {
  resolveProductCode,
  getBagSizeForCode,
  calcPopWeightFromBags,
  calcBagsFromKg,
  getProductCodeLabel,
} from "@/lib/productCodes";

type PaymentType = "cash" | "credit" | "advance";

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
  quality?: string;
  materialColor: string;
  actualPrice: string;
  productionCost: string;
  sellingPrice: string;
  sellingPricePerKg?: number;
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
  notes?: string;
  transportationCost?: string | number;
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
    paymentMethod: "cash",
    customerId: "",
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
    quality: string;
    materialColor: string;
    productionCost?: string | number;
    weight?: number;
    weightForCost?: number;
    costPerKg?: number;
  } | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [weightError, setWeightError] = useState<string>("");
  const [paymentStatusError, setPaymentStatusError] = useState<string>("");
  const [apiError, setApiError] = useState<string>("");
  const [registeredCustomers, setRegisteredCustomers] = useState<
    {
      _id: string;
      customerName: string;
      customerId: string;
      phoneNo: string;
      address?: string;
      email?: string;
      totalBalanceDue?: number;
      salesBalanceDue?: number;
      profileBalanceDue?: number;
      advanceCredit?: number;
      financeAdvanceBalance?: number;
    }[]
  >([]);
  const [cartLines, setCartLines] = useState<
    {
      materialName: string;
      quality: string;
      materialColor: string;
      weight: number;
      sellingPricePerKg: number;
      discount: number;
      transportationCost: number;
      amount: number;
      actualCostPerKg: number;
    }[]
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerBalanceInfo, setCustomerBalanceInfo] = useState<{
    totalBalanceDue: number;
    salesBalanceDue: number;
    advanceCredit: number;
  } | null>(null);

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

  const costPerKgDisplay = (() => {
    const fromApi =
      (selectedMaterialInfo as { actualCostPerKg?: number })?.actualCostPerKg ??
      selectedMaterialInfo?.costPerKg;
    if (fromApi != null && Number.isFinite(fromApi) && fromApi > 0) {
      return fromApi.toFixed(2);
    }
    return null;
  })();

  const currentUser = getCurrentUser();

  const fetchRegisteredCustomers = async () => {
    try {
      const res = await api.get("/api/customers/getall-customers");
      if (res.data.success) {
        setRegisteredCustomers(res.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setCustomerBalanceInfo(null);
      setFormData((prev) => ({
        ...prev,
        buyerName: "",
        buyerPhone: "",
        customerId: "",
      }));
      return;
    }
    const customer = registeredCustomers.find((c) => c._id === customerId);
    if (!customer) return;
    setCustomerBalanceInfo({
      totalBalanceDue: customer.totalBalanceDue ?? 0,
      salesBalanceDue: customer.salesBalanceDue ?? 0,
      advanceCredit:
        customer.advanceCredit ??
        (customer.financeAdvanceBalance ?? 0),
    });
    setFormData((prev) => ({
      ...prev,
      buyerName: customer.customerName,
      buyerPhone: customer.phoneNo || "",
      buyerAddress: customer.address || prev.buyerAddress,
      buyerEmail: customer.email || prev.buyerEmail,
      customerId: customer._id,
    }));
    if (errors.buyerName) {
      setErrors((prev) => ({ ...prev, buyerName: "" }));
    }
  };

  const fetchNextInvoiceNo = async () => {
    try {
      const res = await api.get("/api/sales/next-invoice");
      if (res.data?.success && res.data.data?.invoiceNo) {
        setFormData((prev) => ({
          ...prev,
          invoiceNo: res.data.data.invoiceNo,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch next invoice:", e);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMaterials();
      fetchRegisteredCustomers();
      
      if (isEdit && editData) {
        populateEditForm();
      } else {
        const todayStr = getTodayDate();
        const currentTimeStr = getCurrentTime();
        setFormData((prev) => ({
          ...prev,
          purchaseDate: todayStr,
          purchaseTime: currentTimeStr,
          branch: prev.branch || "Main",
        }));
        setSelectedDate(new Date());
        fetchNextInvoiceNo();
      }
    }
  }, [open, isEdit, editData]);

  /** Edit/view: rate per kg before discount (DB may only store final bill total). */
  const resolveSellingRatePerKg = (sale: Sale): string => {
    const w = parseFloat(sale.weight) || 0;
    if (w <= 0) return sale.sellingPrice || "";
    const stored = sale.sellingPricePerKg;
    if (stored != null && stored > 0) return String(stored);
    const finalAmt = parseFloat(sale.finalAmount || sale.sellingPrice) || 0;
    const discount = parseFloat(sale.discount) || 0;
    const transport = parseFloat(String(sale.transportationCost)) || 0;
    if (finalAmt > 0) {
      const rate = (finalAmt + discount - transport) / w;
      if (rate > 0) return String(Math.round(rate * 100) / 100);
    }
    return sale.sellingPrice || "";
  };

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
      unit: editData.unit || "1",
      purchaseDate: saleDateStr,
      purchaseTime: saleTimeStr,
      branch: editData.branch || "Main",
      materialColor: editData.materialColor || "#FFFFFF",
      actualPrice: editData.actualPrice || "",
      productionCost: editData.productionCost || "",
      sellingPrice: resolveSellingRatePerKg(editData),
      discount: editData.discount || "0",
      advancePayment: editData.advancePayment?.toString() || "",
      buyerName: editData.buyerName || "",
      buyerAddress: editData.buyerAddress || "",
      buyerPhone: editData.buyerPhone || "",
      buyerEmail: editData.buyerEmail || "",
      buyerCnic: editData.buyerCnic || "",
      buyerCompany: editData.buyerCompany || "",
      paymentMethod: (editData as Sale & { paymentMethod?: string }).paymentMethod?.toLowerCase() || "cash",
      customerId: (editData as Sale & { customerId?: string }).customerId || "",
      paymentStatus: editData.paymentStatus || "none",
      amountPaid: editData.amountPaid?.toString() || "0",
      transportationCost: editData.transportationCost != null ? String(editData.transportationCost) : "0",
      notes: editData.notes || "",
    });

    const pm = ((editData as Sale & { paymentMethod?: string }).paymentMethod || "cash").toLowerCase();
    setPaymentType(
      pm === "credit" || pm === "advance" || pm === "cash" ? (pm as PaymentType) : "cash"
    );
    
    setSelectedColor(editData.materialColor || "#FFFFFF");
    const editWeight = parseFloat(editData.weight) || 0;
    const editProdCost = parseFloat(editData.productionCost) || 0;
    setSelectedMaterialInfo({
      totalWeight: editWeight,
      availableWeight: 0,
      soldWeight: 0,
      vendor: editData.supplierName || "",
      price: editData.actualPrice || "0",
      quality: editData.quality || "Standard",
      materialColor: editData.materialColor || "#FFFFFF",
      productionCost: editData.productionCost || undefined,
      weight: editWeight > 0 ? editWeight : undefined,
    });
    if (editProdCost > 0 && editWeight > 0) {
      setFormData((prev) => ({ ...prev, productionCost: String(editProdCost) }));
    }
    if (saleDateParsed) {
      setSelectedDate(saleDateParsed);
      setCurrentMonth(saleDateParsed.getMonth());
      setCurrentYear(saleDateParsed.getFullYear());
    }
    if (editData.receiptImage) {
      setReceiptPreview(`${API_BASE_URL}${editData.receiptImage}`);
    }
  };

  useEffect(() => {
    if (!open || !isEdit || !editData?.buyerName || registeredCustomers.length === 0) return;
    const cid = (editData as Sale & { customerId?: string }).customerId || "";
    if (cid) {
      setSelectedCustomerId(cid);
      return;
    }
    const match = registeredCustomers.find(
      (c) => c.customerName.toLowerCase() === editData.buyerName.trim().toLowerCase()
    );
    if (match) setSelectedCustomerId(match._id);
  }, [open, isEdit, editData, registeredCustomers]);

  const handlePaymentTypeChange = (type: PaymentType) => {
    setPaymentType(type);
    const cust = registeredCustomers.find((c) => c._id === selectedCustomerId);
    const financeAdv = cust?.financeAdvanceBalance ?? cust?.advanceCredit ?? 0;
    setFormData((prev) => ({
      ...prev,
      paymentMethod: type,
      amountPaid:
        type === "credit"
          ? "0"
          : type === "advance" && financeAdv > 0
            ? String(Math.min(financeAdv, calculateTotalAmount()))
            : prev.amountPaid,
    }));
    setPaymentStatusError("");
  };

  const addCurrentLineToCart = () => {
    if (!formData.materialName || !formData.weight || !formData.sellingPrice) {
      alert("Material, weight aur selling price zaroori hain");
      return;
    }
    const w = parseFloat(formData.weight) || 0;
    const rate = parseFloat(formData.sellingPrice.replace(/,/g, "")) || 0;
    if (w <= 0 || rate <= 0) return;
    const lineAmount = calculateTotalAmount();
    setCartLines((prev) => [
      ...prev,
      {
        materialName: formData.materialName,
        quality: selectedMaterialInfo?.quality || "Standard",
        materialColor: selectedColor,
        weight: w,
        sellingPricePerKg: rate,
        discount: parseFloat(formData.discount) || 0,
        transportationCost: parseFloat(formData.transportationCost) || 0,
        amount: lineAmount,
        actualCostPerKg: parseFloat(costPerKgDisplay || "0") || 0,
      },
    ]);
    alert("Product line added. Add more products or save the invoice.");
  };

  // Fetch materials from Production List – aggregated by material+quality+color (total weight per option)
  const fetchMaterials = async () => {
    try {
      setLoadingMaterials(true);
      setApiError("");
      const response = await api.get("/api/processing/production/for-pos");
      let materialsData: any[] = [];
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        materialsData = response.data.data;
      }
      const processedMaterials = materialsData.map((item: any) => {
        const materialName = item.materialName || "Unknown";
        const quality = item.quality || "Standard";
        const color = (item.color || "#FFFFFF").toString().trim();
        const compositeId = `${materialName}|${quality}|${color}`;
        const totalAvailable = item.totalAvailableWeight ?? 0;
        const totalCost = parseFloat(item.totalProductionCost) || 0;
        const outputW = parseFloat(item.totalOutputWeight) || totalAvailable;
        const costPerKg =
          item.actualCostPerKg != null && item.actualCostPerKg > 0
            ? parseFloat(item.actualCostPerKg)
            : item.costPerKg != null && item.costPerKg > 0
              ? parseFloat(item.costPerKg)
              : 0;
        return {
          _id: compositeId,
          materialName,
          vendor: "Production",
          price: "0",
          weight: String(totalAvailable),
          quality,
          purchaseDate: "",
          materialColor: color,
          vehicleName: "",
          vehicleType: "",
          vehicleNumber: "",
          driverName: "",
          vehicleColor: "",
          deliveryDate: "",
          receiptNo: "",
          vehicleImage: "",
          advancePayment: 0,
          soldWeight: 0,
          availableWeight: totalAvailable,
          batchNo: "",
          createdAt: "",
          isAggregated: true,
          totalProductionCost: totalCost,
          costPerKg,
        };
      });
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
    
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "buyerName") {
        next.customerId = "";
      }
      if (name === "weight" || name === "unit") {
        const code = resolveProductCode(next.materialName);
        const bagSize = getBagSizeForCode(code);
        if (bagSize > 0) {
          if (name === "weight") {
            const kg = parseFloat(String(value).replace(/,/g, "")) || 0;
            if (kg > 0) {
              const bags = calcBagsFromKg(code, kg);
              if (bags > 0) next.unit = String(bags);
            }
          } else {
            const bags = parseFloat(String(value).replace(/,/g, "")) || 0;
            if (bags > 0) {
              const kg = calcPopWeightFromBags(code, bags);
              if (kg > 0) next.weight = String(kg);
            }
          }
        }
      }
      if (
        name === "amountPaid" ||
        name === "weight" ||
        name === "unit" ||
        name === "sellingPrice" ||
        name === "discount" ||
        name === "transportationCost"
      ) {
        const kg = parseFloat(String(next.weight).replace(/,/g, "")) || 0;
        const rate = parseFloat(String(next.sellingPrice).replace(/,/g, "")) || 0;
        const disc = parseFloat(String(next.discount).replace(/,/g, "")) || 0;
        const transport = parseFloat(String(next.transportationCost).replace(/,/g, "")) || 0;
        const total = kg > 0 && rate > 0 ? Math.max(0, kg * rate - disc + transport) : 0;
        const paid = parseFloat(next.amountPaid) || 0;
        if (total > 0 && paid >= total) next.paymentStatus = "paid";
        else if (paid > 0) next.paymentStatus = "partial";
        else next.paymentStatus = "none";
      }
      return next;
    });
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Validate weight when changed
    if ((name === "weight" || name === "unit") && selectedMaterialInfo) {
      let saleWeight = 0;
      if (name === "weight") {
        saleWeight = parseFloat(value) || 0;
      } else {
        const code = resolveProductCode(formData.materialName);
        const bags = parseFloat(String(value).replace(/,/g, "")) || 0;
        saleWeight =
          bags > 0 && getBagSizeForCode(code) > 0
            ? calcPopWeightFromBags(code, bags)
            : parseFloat(String(formData.weight).replace(/,/g, "")) || 0;
      }
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        setWeightError(`Warning: Sale weight exceeds available weight. Available: ${selectedMaterialInfo.availableWeight} kg`);
      } else {
        setWeightError("");
      }
    }
    
    // Validate amount paid
    if (
      name === "weight" ||
      name === "unit" ||
      name === "sellingPrice" ||
      name === "discount" ||
      name === "transportationCost"
    ) {
      const total = calculateTotalAmount();
      const paid = parseFloat(formData.amountPaid) || 0;
      if (total > 0 && paid > total) {
        setPaymentStatusError(`Received cannot exceed total (Rs. ${total.toLocaleString()})`);
      } else {
        setPaymentStatusError("");
      }
    }

    if (name === 'amountPaid') {
      const total = calculateTotalAmount();
      const amountPaid = parseFloat(value) || 0;
      
      if (total > 0 && amountPaid > total) {
        setPaymentStatusError(`Warning: Received (${amountPaid}) exceeds total bill (Rs. ${total.toLocaleString()})`);
      } else {
        setPaymentStatusError("");
      }
    }
  };

  // Handle material selection (value is composite id for aggregated or _id for single batch)
  const handleMaterialSelect = (selectedId: string) => {
    const selectedMaterial = materials.find(m => m._id === selectedId);
    if (!selectedMaterial) return;
    const name = selectedMaterial.materialName;
    setFormData((prev) => ({
      ...prev,
      materialName: name,
      actualPrice: selectedMaterial.price || prev.actualPrice,
    }));
    setSelectedColor(selectedMaterial.materialColor || "#FFFFFF");
    const totalWeight = parseFloat(selectedMaterial.weight) || 0;
    const availableWeight = selectedMaterial.availableWeight ?? totalWeight;
    const isAggregated = (selectedMaterial as { isAggregated?: boolean }).isAggregated === true;
    const mat = selectedMaterial as {
      totalProductionCost?: number;
      productionCost?: string;
      costPerKg?: number;
    };
    const productionCost =
      mat.totalProductionCost ?? mat.productionCost;
    const costPerKg =
      mat.costPerKg != null && mat.costPerKg > 0
        ? mat.costPerKg
        : undefined;
    setSelectedMaterialInfo({
      totalWeight,
      availableWeight,
      soldWeight: selectedMaterial.soldWeight || 0,
      productionId: isAggregated ? undefined : selectedMaterial._id,
      vendor: selectedMaterial.vendor,
      price: selectedMaterial.price,
      quality: (selectedMaterial as { quality?: string }).quality || "Standard",
      materialColor: selectedMaterial.materialColor,
      productionCost: productionCost ?? formData.productionCost,
      weight: totalWeight > 0 ? totalWeight : undefined,
      weightForCost: availableWeight > 0 ? availableWeight : totalWeight,
      costPerKg,
    });
    if (productionCost != null) {
      setFormData((prev) => ({
        ...prev,
        productionCost: String(productionCost),
      }));
    }
    setFormData((prev) => ({ ...prev, weight: "", unit: "" }));
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

  const getSaleWeightKg = () => parseFloat(String(formData.weight).replace(/,/g, "")) || 0;

  const getPricePerKg = () => parseFloat(String(formData.sellingPrice).replace(/,/g, "")) || 0;

  /** Total bill = price per kg × weight − discount + transport */
  const calculateTotalAmount = () => {
    const kg = getSaleWeightKg();
    const rate = getPricePerKg();
    const discount = parseFloat(String(formData.discount).replace(/,/g, "")) || 0;
    const transport = parseFloat(String(formData.transportationCost).replace(/,/g, "")) || 0;
    if (kg <= 0 || rate <= 0) return 0;
    return Math.max(0, Math.round((kg * rate - discount + transport) * 100) / 100);
  };

  const calculateRemainingAmount = () => {
    const total = calculateTotalAmount();
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    return Math.max(0, Math.round((total - amountPaid) * 100) / 100);
  };

  const totalBill = calculateTotalAmount();
  const paymentReceived = parseFloat(formData.amountPaid || "0") || 0;
  const receivableAfterSale = calculateRemainingAmount();
  const advanceCredit = customerBalanceInfo?.advanceCredit ?? 0;
  const advanceRemainingAfterSale =
    paymentType === "advance"
      ? Math.max(0, Math.round((advanceCredit - totalBill) * 100) / 100)
      : advanceCredit;

  /** Edit: fill blanks from saved sale so partial edits work; backend still gets valid strings */
  const getEffectiveFormData = (): typeof formData => {
    if (!isEdit || !editData) return formData;
    let purchaseDateFallback = formData.purchaseDate;
    if (!purchaseDateFallback.trim() && editData.purchaseDate) {
      try {
        const d = new Date(editData.purchaseDate);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          purchaseDateFallback = `${dd}/${mm}/${yyyy}`;
        }
      } catch {
        /* keep */
      }
    }
    let purchaseTimeFallback = formData.purchaseTime;
    if (!purchaseTimeFallback.trim() && editData.purchaseDate) {
      try {
        const t = new Date(editData.purchaseDate);
        if (!isNaN(t.getTime())) {
          let hour = t.getHours();
          const minute = String(t.getMinutes()).padStart(2, "0");
          const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 || 12;
          purchaseTimeFallback = `${hour12.toString().padStart(2, "0")}:${minute} ${ampm}`;
        }
      } catch {
        /* keep */
      }
    }
    return {
      ...formData,
      materialName: formData.materialName.trim() || editData.materialName || "",
      supplierName: formData.supplierName.trim() || editData.supplierName || "-",
      invoiceNo: formData.invoiceNo.trim() || editData.invoiceNo || "",
      weight: formData.weight.trim() || editData.weight || "",
      unit: formData.unit.trim() || editData.unit || "1",
      purchaseDate: purchaseDateFallback,
      purchaseTime: purchaseTimeFallback,
      branch: formData.branch.trim() || editData.branch || "Main",
      sellingPrice: formData.sellingPrice || editData.sellingPrice || "",
      discount: formData.discount ?? editData.discount ?? "0",
      buyerName: formData.buyerName.trim() || editData.buyerName || "",
      buyerPhone: formData.buyerPhone.trim() || editData.buyerPhone || "",
      buyerAddress: formData.buyerAddress || editData.buyerAddress || "",
      buyerEmail: formData.buyerEmail || editData.buyerEmail || "",
      amountPaid: formData.amountPaid ?? String(editData.amountPaid ?? 0),
    };
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const fd = getEffectiveFormData();

    if (!fd.materialName.trim()) newErrors.materialName = "Material name is required";

    if (!fd.weight.trim()) {
      newErrors.weight = "Weight is required";
    } else {
      const saleWeight = parseFloat(fd.weight);
      if (isNaN(saleWeight) || saleWeight <= 0) {
        newErrors.weight = "Valid weight is required";
      } else if (
        !isEdit &&
        selectedMaterialInfo &&
        selectedMaterialInfo.availableWeight > 0 &&
        saleWeight > selectedMaterialInfo.availableWeight
      ) {
        newErrors.weight = `Sale weight cannot exceed available weight (${selectedMaterialInfo.availableWeight} kg)`;
      }
    }

    if (!fd.unit.trim()) newErrors.unit = "Bags is required";
    if (!fd.purchaseDate) newErrors.purchaseDate = "Sale date is required";
    if (!fd.purchaseTime) newErrors.purchaseTime = "Sale time is required";
    const saleKg = parseFloat(fd.weight.replace(/,/g, "")) || 0;
    const pricePerKg = parseFloat(fd.sellingPrice.replace(/,/g, "")) || 0;
    if (!fd.sellingPrice || pricePerKg <= 0)
      newErrors.sellingPrice = "Valid price per kg is required";
    if (saleKg <= 0) newErrors.weight = newErrors.weight || "Valid weight is required";

    const amountPaid = parseFloat(fd.amountPaid) || 0;
    const totalBill =
      saleKg > 0 && pricePerKg > 0
        ? Math.max(
            0,
            saleKg * pricePerKg -
              (parseFloat(fd.discount.replace(/,/g, "")) || 0) +
              (parseFloat(fd.transportationCost.replace(/,/g, "")) || 0)
          )
        : 0;
    if (amountPaid < 0) {
      newErrors.amountPaid = "Received amount cannot be negative";
    } else if (totalBill > 0 && amountPaid > totalBill) {
      newErrors.amountPaid = "Received amount cannot exceed total bill";
    } else if (paymentType === "advance") {
      const advance = parseFloat(fd.advancePayment) || 0;
      if (advance < 0) newErrors.advancePayment = "Advance amount cannot be negative";
    }

    if (!fd.buyerName.trim()) newErrors.buyerName = "Customer name is required";
    if (!isEdit && !fd.buyerPhone.trim()) newErrors.buyerPhone = "Buyer phone is required";
    if (fd.buyerEmail && !/^\S+@\S+\.\S+$/.test(fd.buyerEmail)) newErrors.buyerEmail = "Invalid email address";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      alert("Kuch zaroori fields missing ya galat hain — form par red errors dekhein.");
      return;
    }

    const fd = getEffectiveFormData();

    if (
      !isEdit &&
      selectedMaterialInfo &&
      selectedMaterialInfo.availableWeight > 0
    ) {
      const saleWeight = parseFloat(fd.weight);
      if (saleWeight > selectedMaterialInfo.availableWeight) {
        alert(`Sale weight cannot exceed available weight (${selectedMaterialInfo.availableWeight} kg)`);
        return;
      }
    }

    const amountPaid = parseFloat(fd.amountPaid) || 0;
    const totalBill = calculateTotalAmount();

    if (totalBill > 0 && amountPaid > totalBill) {
      alert(`Received amount (${amountPaid}) cannot exceed total bill (Rs. ${totalBill.toLocaleString()})`);
      return;
    }

    if (paymentType === "credit" && !canApprove(currentUser.role) && amountPaid > 0) {
      alert("Only Owner or Admin can record payment on credit sales.");
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

      const dateTime = parseDate(fd.purchaseDate, fd.purchaseTime);
      const pricePerKg = parseFloat(fd.sellingPrice.replace(/,/g, "")) || 0;
      const totalBill = calculateTotalAmount();
      const finalAmount = totalBill.toFixed(2);

      const qualityValue =
        selectedMaterialInfo?.quality ||
        (isEdit && editData ? editData.quality : "") ||
        "";

      // Prepare form data (aggregated = no productionId/purchaseId; backend uses materialName+quality+materialColor and FIFO)
      const formDataToSend = new FormData();
      if (selectedMaterialInfo?.productionId) {
        formDataToSend.append('productionId', selectedMaterialInfo.productionId);
      } else if (selectedMaterialInfo?.purchaseId) {
        formDataToSend.append('purchaseId', selectedMaterialInfo.purchaseId);
      }
      // else: aggregated production – do not send productionId/purchaseId; materialName, quality, materialColor are enough
      formDataToSend.append('customerName', fd.buyerName);
      formDataToSend.append('customerPhone', fd.buyerPhone);
      formDataToSend.append('customerEmail', fd.buyerEmail || '');
      formDataToSend.append("pricePerKg", String(pricePerKg));
      formDataToSend.append("sellingPrice", finalAmount);
      formDataToSend.append('sellingWeight', fd.weight);
      formDataToSend.append('saleDate', dateTime);
      formDataToSend.append('paymentMethod', fd.paymentMethod || paymentType);
      formDataToSend.append('amountPaid', fd.amountPaid);
      if (fd.customerId) {
        formDataToSend.append('customerId', fd.customerId);
      }
      if (fd.invoiceNo.trim()) {
        formDataToSend.append('invoiceNo', fd.invoiceNo.trim());
      }
      formDataToSend.append('transportationCost', fd.transportationCost);
      formDataToSend.append('notes', fd.notes);

      // Additional fields
      formDataToSend.append('materialName', fd.materialName);
      formDataToSend.append('supplierName', 'Production');
      formDataToSend.append('quality', qualityValue);
      formDataToSend.append('unit', fd.unit);
      formDataToSend.append('branch', fd.branch);
      formDataToSend.append('materialColor', selectedColor);
      formDataToSend.append('actualPrice', '0');
      const prodCost =
        selectedMaterialInfo?.productionCost != null
          ? String(selectedMaterialInfo.productionCost)
          : costPerKgDisplay && fd.weight
            ? String(
                parseFloat(costPerKgDisplay) * (parseFloat(fd.weight) || 0)
              )
            : "0";
      formDataToSend.append('productionCost', prodCost);
      formDataToSend.append('discount', fd.discount);
      formDataToSend.append('advancePayment', fd.advancePayment || '0');
      formDataToSend.append('buyerAddress', fd.buyerAddress || '');
      formDataToSend.append('buyerCnic', fd.buyerCnic || '');
      formDataToSend.append('buyerCompany', fd.buyerCompany || '');
      const cartTotal = cartLines.reduce((s, l) => s + l.amount, 0);
      const combinedTotal = cartLines.length > 0 ? cartTotal : totalBill;
      formDataToSend.append('finalAmount', String(combinedTotal));
      formDataToSend.append('sellingPrice', String(combinedTotal));
      if (cartLines.length > 0) {
        formDataToSend.append('lineItems', JSON.stringify(cartLines));
        const totalKg = cartLines.reduce((s, l) => s + l.weight, 0);
        formDataToSend.set('sellingWeight', String(totalKg));
        formDataToSend.set('weight', String(totalKg));
      }

      // Add receipt file
      if (receiptFile) {
        formDataToSend.append('receiptImage', receiptFile);
      }

      let response;
      if (isEdit && editData && editData._id) {
        response = await api.put(`/api/sales/${editData._id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await api.post('/api/sales/add-sale', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
      paymentMethod: "cash",
      customerId: "",
      paymentStatus: "none",
      amountPaid: "0",
      transportationCost: "0",
      notes: "",
    });
    
    setSelectedColor("#FFFFFF");
    setSelectedDate(new Date());
    setSelectedMaterialInfo(null);
    setCartLines([]);
    setPaymentType("cash");
    setReceiptFile(null);
    setReceiptPreview(null);
    setWeightError("");
    setPaymentStatusError("");
    setErrors({});
    setSelectedCustomerId("");
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

        {/* Customer Details — sab se pehle */}
        <div className="mb-6">
          <h3 className="text-base font-semibold text-foreground mb-4">Customer Details</h3>
          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">
              Select Customer *
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select customer...</option>
              {registeredCustomers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.customerName}
                  {c.customerId ? ` (${c.customerId})` : ""}
                </option>
              ))}
            </select>
          </div>
          {customerBalanceInfo && (
            <div className="mb-4 p-4 rounded-lg border-2 border-primary/25 bg-card shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-3">Customer account summary</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40">
                  <p className="text-xs font-medium text-red-900 dark:text-red-100">
                    Purana balance (hum ne lena hai)
                  </p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300 mt-1">
                    Rs. {customerBalanceInfo.totalBalanceDue.toLocaleString()}
                  </p>
                  {customerBalanceInfo.salesBalanceDue > 0 && (
                    <p className="text-xs font-medium text-red-800/90 dark:text-red-200/90 mt-1">
                      Sales pending: Rs. {customerBalanceInfo.salesBalanceDue.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/40">
                  <p className="text-xs font-medium text-green-900 dark:text-green-100">
                    Advance / pehle diya hua
                  </p>
                  <p className="text-xl font-bold text-green-800 dark:text-green-300 mt-1">
                    {customerBalanceInfo.advanceCredit > 0
                      ? `Rs. ${customerBalanceInfo.advanceCredit.toLocaleString()}`
                      : "Rs. 0"}
                  </p>
                  {customerBalanceInfo.advanceCredit <= 0 && (
                    <p className="text-xs text-green-800/80 dark:text-green-200/80 mt-1">Koi advance nahi</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Customer Name *</label>
              <input
                type="text"
                name="buyerName"
                placeholder="Customer name"
                value={formData.buyerName}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.buyerName ? "border-red-500" : "border-border"} rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.buyerName && (
                <p className="text-xs text-red-500 mt-1">{errors.buyerName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Phone No *</label>
              <input
                type="tel"
                name="buyerPhone"
                placeholder="e.g 03001234567"
                value={formData.buyerPhone}
                onChange={handleInputChange}
                className={`w-full bg-cms-input-bg border ${errors.buyerPhone ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.buyerPhone && (
                <p className="text-xs text-red-500 mt-1">{errors.buyerPhone}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Address</label>
              <input
                type="text"
                name="buyerAddress"
                placeholder="Optional"
                value={formData.buyerAddress}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Email</label>
              <input
                type="email"
                name="buyerEmail"
                placeholder="Optional"
                value={formData.buyerEmail}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">CNIC</label>
              <input
                type="text"
                name="buyerCnic"
                placeholder="Optional"
                value={formData.buyerCnic}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground"
              />
            </div>
          </div>
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
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
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
                <div className="text-center p-2 bg-white rounded border">
                  <p className="text-xs text-gray-600">Actual cost per kg</p>
                  <p className="text-lg font-bold text-indigo-700">
                    {costPerKgDisplay ? `Rs. ${costPerKgDisplay}` : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {cartLines.length > 0 && (
            <div className="mb-4 p-3 border border-primary/30 rounded-md bg-primary/5">
              <p className="text-sm font-medium mb-2">Invoice lines ({cartLines.length})</p>
              <ul className="text-xs space-y-1">
                {cartLines.map((line, i) => (
                  <li key={i}>
                    {line.materialName} — {line.weight} kg @ Rs.{line.sellingPricePerKg}/kg = Rs.
                    {line.amount.toLocaleString()}
                  </li>
                ))}
              </ul>
              <p className="text-sm font-bold mt-2">
                Cart total: Rs. {cartLines.reduce((s, l) => s + l.amount, 0).toLocaleString()}
              </p>
            </div>
          )}

          <div className="mb-4">
            <button
              type="button"
              onClick={addCurrentLineToCart}
              className="px-3 py-2 text-sm border border-primary text-primary rounded-md hover:bg-primary/10"
            >
              + Add another product to this invoice
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
              <div className="relative">
                <select
                  name="materialName"
                  value={selectedMaterialInfo ? (selectedMaterialInfo.productionId ?? (formData.materialName && selectedMaterialInfo.quality != null && selectedColor ? `${formData.materialName}|${selectedMaterialInfo.quality}|${selectedColor}` : "")) : ""}
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
                        {material.materialName} {material.quality ? `(${material.quality})` : ""} — {material.availableWeight} kg total
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

            {selectedMaterialInfo && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Quality (from selected material only)</label>
                <select
                  value={selectedMaterialInfo.quality || ""}
                  onChange={(e) => setSelectedMaterialInfo(prev => prev ? { ...prev, quality: e.target.value } : null)}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={selectedMaterialInfo.quality || "Standard"}>
                    {selectedMaterialInfo.quality || "Standard"}
                  </option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">Only the quality of the selected production item is shown (e.g. 1 item = 1 quality).</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Sale Invoice No. (SI — auto)</label>
              <input
                type="text"
                name="invoiceNo"
                readOnly={!isEdit}
                placeholder="SI052600001"
                value={formData.invoiceNo}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary read-only:opacity-80"
              />
              <p className="text-xs text-muted-foreground mt-1">SI se start — sale identify karne ke liye</p>
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
              <label className="block text-xs text-muted-foreground mb-1.5">Bags *</label>
              <input
                type="number"
                name="unit"
                placeholder="e.g. 3"
                value={formData.unit}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full bg-cms-input-bg border ${errors.unit ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.unit && (
                <p className="text-xs text-red-500 mt-1">{errors.unit}</p>
              )}
              {(() => {
                const code = resolveProductCode(formData.materialName);
                const bagSize = getBagSizeForCode(code);
                if (!formData.materialName.trim()) return null;
                if (bagSize > 0) {
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getProductCodeLabel(code)}: {bagSize} kg/bag — kg aur bags khud sync honge
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-amber-600 mt-1">
                    Is material ka standard bag size nahi — kg ya bags manually likhein
                  </p>
                );
              })()}
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
              <label className="block text-xs text-muted-foreground mb-1.5">Branch (optional)</label>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Selling Price per kg (Rs.) *</label>
              <input
                type="number"
                name="sellingPrice"
                placeholder="e.g 500"
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
              <label className="block text-xs text-muted-foreground mb-1.5">Discount (Rs.)</label>
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

          {getSaleWeightKg() > 0 && getPricePerKg() > 0 && (
            <div className="bg-muted/40 border border-border rounded-md px-4 py-3 mb-4 text-sm text-foreground">
              <p>
                <span className="text-muted-foreground">Subtotal:</span>{" "}
                Rs. {getPricePerKg().toLocaleString()} × {getSaleWeightKg()} kg ={" "}
                <strong>Rs. {(getPricePerKg() * getSaleWeightKg()).toLocaleString()}</strong>
              </p>
              {(parseFloat(formData.discount) || 0) > 0 && (
                <p className="text-muted-foreground">− Discount: Rs. {parseFloat(formData.discount).toLocaleString()}</p>
              )}
              {(parseFloat(formData.transportationCost) || 0) > 0 && (
                <p className="text-muted-foreground">
                  + Transport: Rs. {parseFloat(formData.transportationCost).toLocaleString()}
                </p>
              )}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Type</label>
            <div className="flex rounded-md border border-border overflow-hidden w-fit">
              {(["cash", "credit", "advance"] as PaymentType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handlePaymentTypeChange(type)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    paymentType === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-cms-input-bg text-foreground hover:bg-muted"
                  }`}
                >
                  {type === "cash" ? "Cash" : type === "credit" ? "Credit" : "Advance"}
                </button>
              ))}
            </div>
          </div>

          <div className={`grid gap-4 mb-4 ${paymentType === "advance" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">
                Payment Received {paymentType === "credit" ? "" : "*"}
              </label>
              <input
                type="number"
                name="amountPaid"
                placeholder={paymentType === "credit" ? "0 for full credit" : "e.g 5000"}
                value={formData.amountPaid}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className={`w-full bg-cms-input-bg border ${errors.amountPaid ? "border-red-500" : "border-border"} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
              />
              {errors.amountPaid && (
                <p className="text-xs text-red-500 mt-1">{errors.amountPaid}</p>
              )}
              {paymentStatusError && (
                <p className="text-xs text-amber-600 mt-1">{paymentStatusError}</p>
              )}
              {paymentType === "credit" && (
                <p className="text-xs text-muted-foreground mt-1">Credit sales may have Rs. 0 received.</p>
              )}
            </div>

            {paymentType === "advance" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Advance Received (from Finance)</label>
                <input
                  type="number"
                  name="advancePayment"
                  placeholder="e.g 5000"
                  value={formData.advancePayment}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className={`w-full bg-cms-input-bg border ${errors.advancePayment ? "border-red-500" : "border-border"} rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary`}
                />
                {errors.advancePayment && (
                  <p className="text-xs text-red-500 mt-1">{errors.advancePayment}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-primary/10 border border-primary/30 rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Total Bill</p>
              <p className="text-lg font-bold text-primary">Rs. {calculateTotalAmount().toLocaleString()}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-xs text-green-700 mb-1">Payment Received</p>
              <p className="text-lg font-bold text-green-800">Rs. {paymentReceived.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-xs text-yellow-700 mb-1">Receivable (Baqi)</p>
              <p className="text-lg font-bold text-yellow-800">Rs. {receivableAfterSale.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-700 mb-1">Payment Status</p>
              <p className="text-lg font-bold text-blue-800">
                {formData.paymentStatus === "paid"
                  ? "Paid"
                  : formData.paymentStatus === "partial"
                    ? "Partial"
                    : "Unpaid"}
              </p>
            </div>
          </div>
          {customerBalanceInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {paymentType === "advance" && advanceCredit > 0 && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:bg-emerald-950/30">
                  <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100">
                    Advance remaining (after this bill)
                  </p>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                    Rs. {advanceRemainingAfterSale.toLocaleString()}
                  </p>
                  <p className="text-xs text-emerald-800/80 mt-1">
                    Pehle advance Rs. {advanceCredit.toLocaleString()} — bill Rs.{" "}
                    {totalBill.toLocaleString()}
                  </p>
                </div>
              )}
              {paymentType !== "advance" && receivableAfterSale > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                    Customer se lena hai (receivable)
                  </p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-1">
                    Rs. {receivableAfterSale.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
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