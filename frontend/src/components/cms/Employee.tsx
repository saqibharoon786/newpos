// Employee.tsx - UPDATED WITH CNIC IMAGES AND TABLE VIEW
import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Printer,
  Mail,
  Phone,
  Clock,
  Building2,
  DollarSign,
  Pencil,
  ArrowLeft,
  Trash2,
  User,
  MapPin,
  CreditCard,
  Calendar,
  AlertCircle,
  Briefcase,
  Wallet,
  FileImage,
  Eye,
  MoreVertical,
  Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

// ==================== API CONFIGURATION ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

const createAPI = () => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  instance.interceptors.request.use(
    (config) => {
      // Ensure the URL starts with /api
      if (config.url && !config.url.startsWith('/api/')) {
        config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
      }
      
      // Handle FormData
      if (config.data instanceof FormData) {
        config.headers['Content-Type'] = 'multipart/form-data';
      }
      
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  return instance;
};

const API = createAPI();

interface EmployeeType {
  _id: string; // MongoDB ID (REQUIRED for backend operations)
  id: string; // Same as _id for frontend compatibility
  employeeId: string; // Custom employee ID
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  schedule: string;
  salary: string;
  avatar: string;
  address: string;
  cnic: string;
  dob: string;
  emergencyContact: string;
  reportingManager: string;
  hireDate: string;
  responsibilities: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  advancePayment: number;
  cnicFrontImage?: string; // ADDED: CNIC Front Image
  cnicBackImage?: string; // ADDED: CNIC Back Image
}

const Employee = () => {
  // Router Hooks
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // State Management
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeType | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  
  // Photo Previews
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  
  // CNIC Image Previews
  const [cnicFrontPreview, setCnicFrontPreview] = useState<string | null>(null);
  const [cnicBackPreview, setCnicBackPreview] = useState<string | null>(null);
  const [editCnicFrontPreview, setEditCnicFrontPreview] = useState<string | null>(null);
  const [editCnicBackPreview, setEditCnicBackPreview] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeDepartments: 0,
    pendingInterviews: 0,
  });
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const cnicFrontInputRef = useRef<HTMLInputElement>(null);
  const cnicBackInputRef = useRef<HTMLInputElement>(null);
  const editCnicFrontInputRef = useRef<HTMLInputElement>(null);
  const editCnicBackInputRef = useRef<HTMLInputElement>(null);

  // Form Data
  const [formData, setFormData] = useState({
    employeeId: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    cnic: "",
    dob: "",
    emergencyContact: "",
    title: "",
    department: "",
    reportingManager: "",
    hireDate: "",
    startTime: "09:00",
    endTime: "17:00",
    responsibilities: "",
    salary: "",
    advancePayment: "0",
  });

  const [editFormData, setEditFormData] = useState({
    _id: "",
    employeeId: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    cnic: "",
    dob: "",
    emergencyContact: "",
    title: "",
    department: "",
    reportingManager: "",
    hireDate: "",
    startTime: "09:00",
    endTime: "17:00",
    responsibilities: "",
    salary: "",
    advancePayment: "0",
  });

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    fetchEmployees();
    fetchEmployeeStats();
  }, []);

  // URL سے selected employee کا ID پڑھیں
  useEffect(() => {
    const employeeId = searchParams.get("view");
    if (employeeId && employees.length > 0) {
      const employee = employees.find(emp => emp._id === employeeId || emp.id === employeeId);
      if (employee) {
        setSelectedEmployee(employee);
        setView("detail");
      }
    }
  }, [employees, searchParams]);

  // ==================== API FUNCTIONS ====================
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await API.get("/employees/get-all");
      console.log("Backend response for get-all:", response.data);
      
      if (response.data.success) {
        const employeesData = (response.data.data || []).map((emp: any) => {
          console.log(`Employee ${emp.name} CNIC images:`, {
            front: emp.cnicFrontImage,
            back: emp.cnicBackImage,
            hasFront: !!emp.cnicFrontImage,
            hasBack: !!emp.cnicBackImage
          });
          
          return {
            ...emp,
            advancePayment: emp.advancePayment || 0,
            cnicFrontImage: emp.cnicFrontImage || "",
            cnicBackImage: emp.cnicBackImage || "",
            // Fix avatar URL if needed
            avatar: emp.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
          };
        });
        console.log("Mapped employees data with CNIC images:", employeesData);
        setEmployees(employeesData);
      } else {
        console.warn("Backend returned success: false");
        setEmployees([]);
      }
    } catch (error: any) {
      console.error("Failed to load employees:", error);
      console.error("Error response:", error.response);
      alert(`Failed to load employees: ${error.response?.data?.message || error.message}`);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeStats = async () => {
    try {
      const response = await API.get("/employees/stats");
      
      if (response.data.success) {
        const statsData = response.data.data || {};
        setStats({
          totalEmployees: statsData.totalEmployees || 0,
          activeDepartments: statsData.activeDepartments || 0,
          pendingInterviews: statsData.pendingInterviews || 0,
        });
      }
    } catch (error: any) {
      console.error("Failed to load stats:", error);
    }
  };

  const createEmployee = async (formDataToSend: FormData) => {
    try {
      const response = await API.post("/employees/create-employee", formDataToSend);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to create employee');
      }
    } catch (error: any) {
      console.error("API Create error:", error);
      throw error;
    }
  };

  // UPDATE EMPLOYEE
  const updateEmployee = async (id: string, employeeData: any, files: {
    avatar?: File;
    cnicFront?: File;
    cnicBack?: File;
  }) => {
    try {
      setIsSubmitting(true);
      
      if (!id || id === "undefined" || id === "") {
        console.error("Invalid employee ID provided:", id);
        throw new Error("Invalid employee ID");
      }
      
      console.log("Updating employee with MongoDB _id:", id);
      
      const formDataToSend = new FormData();
      
      // Append all form data EXCEPT _id
      Object.keys(employeeData).forEach(key => {
        if (key !== '_id') {
          const value = employeeData[key];
          if (value !== undefined && value !== null && value !== '') {
            formDataToSend.append(key, String(value));
          }
        }
      });

      // Append files if exists
      if (files.avatar) {
        formDataToSend.append("avatar", files.avatar);
      }
      if (files.cnicFront) {
        formDataToSend.append("cnicFrontImage", files.cnicFront);
      }
      if (files.cnicBack) {
        formDataToSend.append("cnicBackImage", files.cnicBack);
      }

      const response = await API.put(`/employees/${id}`, formDataToSend);
      
      console.log("Update response:", response.data);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to update employee');
      }
    } catch (error: any) {
      console.error("Update error details:", error);
      console.error("Error response:", error.response?.data);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // DELETE EMPLOYEE
  const deleteEmployee = async (id: string) => {
    try {
      if (!id || id === "undefined") {
        throw new Error("Invalid employee ID");
      }
      
      console.log("Deleting employee with MongoDB _id:", id);
      
      const response = await API.delete(`/employees/${id}`);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to delete employee');
      }
    } catch (error: any) {
      console.error("Delete error details:", error);
      throw error;
    }
  };

  // ==================== EVENT HANDLERS ====================
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditPhotoPreview(reader.result as string);
      } else {
        setPhotoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle CNIC Front Image Upload
  const handleCnicFrontUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditCnicFrontPreview(reader.result as string);
      } else {
        setCnicFrontPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle CNIC Back Image Upload
  const handleCnicBackUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditCnicBackPreview(reader.result as string);
      } else {
        setCnicBackPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  const checkEmployeeImages = (employee: EmployeeType) => {
    console.log("=== Employee Image Debug ===");
    console.log("Employee ID:", employee.employeeId);
    console.log("Avatar:", employee.avatar);
    console.log("CNIC Front:", employee.cnicFrontImage);
    console.log("CNIC Back:", employee.cnicBackImage);
    console.log("Type of CNIC Front:", typeof employee.cnicFrontImage);
    console.log("Type of CNIC Back:", typeof employee.cnicBackImage);
    
    // Check if URLs are valid
    if (employee.cnicFrontImage) {
      console.log("CNIC Front starts with:", employee.cnicFrontImage.substring(0, 50));
    }
    if (employee.cnicBackImage) {
      console.log("CNIC Back starts with:", employee.cnicBackImage.substring(0, 50));
    }
    console.log("=========================");
  };

  // Helper function to get full image URL
  const getFullImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "";
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // If it's a base64 data URL, return as is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // Otherwise, prepend API base URL
    return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
  };

  const handleSaveEmployee = async () => {
    // Validate required fields first
    const requiredFields = ['employeeId', 'name', 'email', 'phone', 'salary'];
    const missingFields = requiredFields.filter(field => {
      const value = formData[field as keyof typeof formData];
      return !value || (typeof value === 'string' && value.trim() === '');
    });
    
    if (missingFields.length > 0) {
      alert(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate salary is a valid number
    const salaryValue = parseFloat(formData.salary.replace(/[^0-9.-]+/g, ""));
    if (isNaN(salaryValue) || salaryValue <= 0) {
      alert("Please enter a valid salary amount");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Debug: Log form data
      console.log("Form Data to submit:", formData);
      
      // Create FormData for submission
      const formDataToSend = new FormData();
      
      // Append all form data
      Object.keys(formData).forEach(key => {
        const value = formData[key as keyof typeof formData];
        if (value !== undefined && value !== null && value !== '') {
          formDataToSend.append(key, String(value));
        }
      });
      
      // Append files with correct field names
      if (fileInputRef.current?.files?.[0]) {
        formDataToSend.append("avatar", fileInputRef.current.files[0]);
      }
      if (cnicFrontInputRef.current?.files?.[0]) {
        formDataToSend.append("cnicFrontImage", cnicFrontInputRef.current.files[0]);
      }
      if (cnicBackInputRef.current?.files?.[0]) {
        formDataToSend.append("cnicBackImage", cnicBackInputRef.current.files[0]);
      }
      
      // Debug: Log what's being sent
      console.log("FormData being sent:");
      for (let pair of formDataToSend.entries()) {
        console.log(pair[0], pair[1]);
      }
      
      const response = await createEmployee(formDataToSend);
      
      if (response.success) {
        const newEmployee = {
          ...response.data,
          id: response.data._id,
          advancePayment: response.data.advancePayment || 0,
          cnicFrontImage: response.data.cnicFrontImage || "",
          cnicBackImage: response.data.cnicBackImage || "",
          // Fix avatar URL if needed
          avatar: response.data.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
        };
        
        console.log("New employee with CNIC images:", {
          cnicFrontImage: newEmployee.cnicFrontImage,
          cnicBackImage: newEmployee.cnicBackImage
        });
        
        // Update employees list (DO NOT navigate to detail view)
        setEmployees(prev => [...prev, newEmployee]);
        setIsAddModalOpen(false);
        resetForm();
        await fetchEmployeeStats();
        alert("✅ Employee created successfully!");
        
        // Stay on list view - FIXED: No auto-navigation to detail page
      }
    } catch (error: any) {
      console.error("Create error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      let errorMessage = "Failed to create employee";
      
      if (error.response) {
        if (error.response.data) {
          errorMessage = error.response.data.message || `Server error: ${error.response.status}`;
        } else {
          errorMessage = `Server error: ${error.response.status}`;
        }
      } else if (error.request) {
        console.error("No response received:", error.request);
        errorMessage = "No response from server. Please check if backend is running.";
      } else {
        errorMessage = error.message || "Failed to create employee";
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // HANDLE UPDATE
  const handleUpdateEmployee = async () => {
    const mongoId = editFormData._id;
    
    console.log("handleUpdateEmployee - ID:", mongoId);
    
    if (!mongoId || mongoId === "undefined" || mongoId === "") {
      alert("Invalid employee ID. Cannot update.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const files = {
        avatar: editFileInputRef.current?.files?.[0],
        cnicFront: editCnicFrontInputRef.current?.files?.[0],
        cnicBack: editCnicBackInputRef.current?.files?.[0],
      };
      
      console.log(`✏️ Updating employee with MongoDB ID: ${mongoId}...`);
      
      const response = await updateEmployee(mongoId, editFormData, files);
      
      if (response.success) {
        const updatedEmployee = {
          ...response.data,
          id: response.data._id,
          advancePayment: response.data.advancePayment || 0,
          cnicFrontImage: response.data.cnicFrontImage || "",
          cnicBackImage: response.data.cnicBackImage || "",
        };
        
        setEmployees(prev => 
          prev.map(emp => emp._id === mongoId ? updatedEmployee : emp)
        );
        
        if (selectedEmployee && selectedEmployee._id === mongoId) {
          setSelectedEmployee(updatedEmployee);
        }
        
        setIsEditModalOpen(false);
        resetEditForm();
        alert("✅ Employee updated successfully!");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.response?.data?.message || "Failed to update employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // HANDLE DELETE
  const handleDeleteEmployee = async (employee: EmployeeType) => {
    if (!employee || !employee._id) {
      alert("Invalid employee");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${employee.name}?`)) {
      return;
    }

    try {
      console.log(`🗑️ Deleting employee with MongoDB ID: ${employee._id}...`);
      const response = await deleteEmployee(employee._id);
      
      if (response.success) {
        setEmployees(prev => prev.filter(emp => emp._id !== employee._id));
        
        if (selectedEmployee && selectedEmployee._id === employee._id) {
          handleBackToList();
        }
        
        await fetchEmployeeStats();
        alert("✅ Employee deleted successfully!");
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert(error.response?.data?.message || "Failed to delete employee. Please try again.");
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      cnic: "",
      dob: "",
      emergencyContact: "",
      title: "",
      department: "",
      reportingManager: "",
      hireDate: "",
      startTime: "09:00",
      endTime: "17:00",
      responsibilities: "",
      salary: "",
      advancePayment: "0",
    });
    setPhotoPreview(null);
    setCnicFrontPreview(null);
    setCnicBackPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cnicFrontInputRef.current) cnicFrontInputRef.current.value = "";
    if (cnicBackInputRef.current) cnicBackInputRef.current.value = "";
  };

  const resetEditForm = () => {
    setEditFormData({
      _id: "",
      employeeId: "",
      name: "",
      address: "",
      phone: "",
      email: "",
      cnic: "",
      dob: "",
      emergencyContact: "",
      title: "",
      department: "",
      reportingManager: "",
      hireDate: "",
      startTime: "09:00",
      endTime: "17:00",
      responsibilities: "",
      salary: "",
      advancePayment: "0",
    });
    setEditPhotoPreview(null);
    setEditCnicFrontPreview(null);
    setEditCnicBackPreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
    if (editCnicFrontInputRef.current) editCnicFrontInputRef.current.value = "";
    if (editCnicBackInputRef.current) editCnicBackInputRef.current.value = "";
  };

  // Handle View Profile click
  const handleViewProfile = (employee: EmployeeType) => {
    setSelectedEmployee(employee);
    setView("detail");
    setSearchParams({ view: employee._id });
    
    // Debug: Check image URLs
    checkEmployeeImages(employee);
  };

  // Handle Back to List
  const handleBackToList = () => {
    setView("list");
    setSelectedEmployee(null);
    setSearchParams({});
  };

  // Handle Edit click
  const handleEditClick = (employee: EmployeeType) => {
    console.log("handleEditClick - Employee data:", employee);
    
    if (!employee) {
      alert("Error: Employee data not found");
      return;
    }
    
    const mongoId = employee._id || employee.id;
    console.log("MongoDB ID found:", mongoId);
    
    if (!mongoId) {
      alert("Error: Employee ID not found. Cannot edit.");
      return;
    }
    
    setSelectedEmployee(employee);
    
    // Extract salary number
    let salaryValue = "";
    if (employee.salary) {
      if (typeof employee.salary === 'string') {
        salaryValue = employee.salary.replace(/Rs\.\s?|,/g, '');
      } else if (typeof employee.salary === 'number') {
        salaryValue = employee.salary.toString();
      }
    }
    
    // Extract advancePayment
    let advancePaymentValue = "";
    if (employee.advancePayment !== undefined) {
      if (typeof employee.advancePayment === 'number') {
        advancePaymentValue = employee.advancePayment.toString();
      } else if (typeof employee.advancePayment === 'string') {
        advancePaymentValue = employee.advancePayment.replace(/Rs\.\s?|,/g, '');
      }
    }
    
    const formattedData = {
      _id: mongoId,
      employeeId: employee.employeeId || "",
      name: employee.name || "",
      address: employee.address || "",
      phone: employee.phone || "",
      email: employee.email || "",
      cnic: employee.cnic || "",
      dob: formatDateForInput(employee.dob),
      emergencyContact: employee.emergencyContact || "",
      title: employee.title || "",
      department: employee.department || "",
      reportingManager: employee.reportingManager || "",
      hireDate: formatDateForInput(employee.hireDate),
      startTime: formatTimeForInput(employee.startTime || "09:00"),
      endTime: formatTimeForInput(employee.endTime || "17:00"),
      responsibilities: employee.responsibilities || "",
      salary: salaryValue,
      advancePayment: advancePaymentValue || "0",
    };
    
    console.log("Edit form data prepared:", formattedData);
    
    setEditFormData(formattedData);
    setEditPhotoPreview(employee.avatar || null);
    setEditCnicFrontPreview(employee.cnicFrontImage || null);
    setEditCnicBackPreview(employee.cnicBackImage || null);
    setIsEditModalOpen(true);
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn("Date formatting error:", error);
    }
    return "";
  };

  const formatTimeForInput = (timeString: string) => {
    if (!timeString) return "09:00";
    
    if (timeString.includes("AM") || timeString.includes("PM")) {
      const match = timeString.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        
        if (period === "PM" && hours < 12) hours += 12;
        if (period === "AM" && hours === 12) hours = 0;
        
        return `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }
    
    if (timeString.match(/^\d{2}:\d{2}$/)) {
      return timeString;
    }
    
    return "09:00";
  };

  const formatSalary = (salary: string | number) => {
    if (typeof salary === "number") {
      return `Rs. ${salary.toLocaleString()}`;
    }
    if (typeof salary === "string") {
      if (salary.startsWith("Rs.")) return salary;
      const num = parseFloat(salary.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(num)) {
        return `Rs. ${num.toLocaleString()}`;
      }
    }
    return `Rs. 0`;
  };

  const formatAdvancePayment = (advancePayment: number) => {
    return `Rs. ${advancePayment.toLocaleString()}`;
  };

  const formatSchedule = (employee: EmployeeType) => {
    if (employee.startTime && employee.endTime) {
      return `${formatTimeForDisplay(employee.startTime)} - ${formatTimeForDisplay(employee.endTime)}`;
    }
    return employee.schedule || "09:00 AM - 05:00 PM";
  };

  const formatTimeForDisplay = (timeString: string) => {
    if (!timeString) return "09:00 AM";
    
    if (timeString.includes("AM") || timeString.includes("PM")) {
      return timeString;
    }
    
    const match = timeString.match(/^(\d{2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2];
      const period = hours >= 12 ? "PM" : "AM";
      
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      
      return `${hours}:${minutes} ${period}`;
    }
    
    return timeString;
  };

  // ==================== RENDER ====================
  if (view === "detail" && selectedEmployee) {
    return (
      <div className="h-full w-full bg-background">
        <div className="h-full w-full px-6 py-4">
          <div className="text-muted-foreground text-sm mb-4">Employees / Detail</div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBackToList}
                className="text-foreground hover:text-muted-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={getFullImageUrl(selectedEmployee.avatar)}
                alt={selectedEmployee.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-primary"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                }}
              />
              <div>
                <h1 className="text-xl font-semibold text-foreground">{selectedEmployee.name}</h1>
                <p className="text-muted-foreground text-sm">Employee ID: {selectedEmployee.employeeId}</p>
                <p className="text-muted-foreground text-sm">{selectedEmployee.title} - {selectedEmployee.department}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleEditClick(selectedEmployee)}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-foreground hover:bg-secondary transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-foreground hover:bg-secondary transition-colors">
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => handleDeleteEmployee(selectedEmployee)}
                className="flex items-center gap-2 px-4 py-2 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-secondary rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6 border-b border-border pb-3">
                Personal Details
              </h2>
              <div className="space-y-4">
                {[
                  { icon: User, label: "Name", value: selectedEmployee.name },
                  { icon: Phone, label: "Phone No.", value: selectedEmployee.phone },
                  { icon: Mail, label: "Email", value: selectedEmployee.email },
                  { icon: CreditCard, label: "CNIC No.", value: selectedEmployee.cnic || "N/A" },
                  { icon: MapPin, label: "Address", value: selectedEmployee.address || "N/A" },
                  { icon: Calendar, label: "DOB", value: selectedEmployee.dob || "N/A" },
                  { icon: AlertCircle, label: "Emergency Contact", value: selectedEmployee.emergencyContact || "N/A" },
                  { icon: Wallet, label: "Advance Payment", value: formatAdvancePayment(selectedEmployee.advancePayment || 0) },
                ].map((item, index) => (
                  <div key={`personal-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
              
              {/* CNIC Images in Detail View */}
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-md font-semibold text-foreground mb-4">CNIC Images</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    {selectedEmployee && selectedEmployee.cnicFrontImage && 
                     selectedEmployee.cnicFrontImage !== "" && 
                     !selectedEmployee.cnicFrontImage.includes("data:image/svg+xml") ? (
                      <div className="relative">
                        <img 
                          src={getFullImageUrl(selectedEmployee.cnicFrontImage)} 
                          alt="CNIC Front" 
                          className="w-full h-40 object-contain rounded-lg border border-border bg-gray-50"
                          onError={(e) => {
                            console.error("Error loading CNIC front image:", selectedEmployee.cnicFrontImage);
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='10' fill='%23999'%3ECNIC Front%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <a 
                          href={getFullImageUrl(selectedEmployee.cnicFrontImage)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                          title="View full image"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-gray-50">
                        <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No CNIC Front Image</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload in edit mode</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    {selectedEmployee && selectedEmployee.cnicBackImage && 
                     selectedEmployee.cnicBackImage !== "" && 
                     !selectedEmployee.cnicBackImage.includes("data:image/svg+xml") ? (
                      <div className="relative">
                        <img 
                          src={getFullImageUrl(selectedEmployee.cnicBackImage)} 
                          alt="CNIC Back" 
                          className="w-full h-40 object-contain rounded-lg border border-border bg-gray-50"
                          onError={(e) => {
                            console.error("Error loading CNIC back image:", selectedEmployee.cnicBackImage);
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='10' fill='%23999'%3ECNIC Back%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <a 
                          href={getFullImageUrl(selectedEmployee.cnicBackImage)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                          title="View full image"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    ) : (
                      <div className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-gray-50">
                        <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No CNIC Back Image</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload in edit mode</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-secondary rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6 border-b border-border pb-3">
                Employment Details
              </h2>
              <div className="space-y-4">
                {[
                  { icon: Briefcase, label: "Job Title", value: selectedEmployee.title || "N/A" },
                  { icon: User, label: "Reporting Manager", value: selectedEmployee.reportingManager || "N/A" },
                  { icon: Calendar, label: "Hire Date", value: selectedEmployee.hireDate || "N/A" },
                  { icon: Clock, label: "Work Schedule", value: formatSchedule(selectedEmployee) },
                  { icon: Building2, label: "Department", value: selectedEmployee.department || "N/A" },
                  { icon: DollarSign, label: "Salary", value: formatSalary(selectedEmployee.salary) },
                  { icon: Briefcase, label: "Job Responsibilities", value: selectedEmployee.responsibilities || "N/A" },
                ].map((item, index) => (
                  <div key={`employment-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-foreground text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background">
      <div className="h-full w-full px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Employees</h1>
              <p className="text-sm text-muted-foreground">Total: {stats.totalEmployees} employees</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors">
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Employees", value: stats.totalEmployees },
            { label: "Active Departments", value: stats.activeDepartments },
            { label: "Pending Interviews", value: stats.pendingInterviews },
          ].map((stat, index) => (
            <div
              key={`stat-${index}`}
              className="bg-card rounded-xl p-5"
            >
              <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, department, title, or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading employees...</span>
          </div>
        ) : (
          <>
            {/* Employee Table */}
            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-secondary border-b border-border">
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Department & Role
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Schedule
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Salary
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Advance
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((employee) => (
                      <tr key={employee._id} className="hover:bg-secondary/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img
                                src={getFullImageUrl(employee.avatar)}
                                alt={employee.name}
                                className="w-10 h-10 rounded-full object-cover border border-primary"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                                }}
                              />
                              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                                employee.isActive ? 'bg-green-500' : 'bg-red-500'
                              }`}></div>
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{employee.name}</p>
                              <p className="text-xs text-muted-foreground">ID: {employee.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-foreground">{employee.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-foreground truncate max-w-[180px]">
                                {employee.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">{employee.department}</p>
                            <p className="text-xs text-muted-foreground">{employee.title}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatSchedule(employee)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatSalary(employee.salary)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{formatAdvancePayment(employee.advancePayment || 0)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewProfile(employee)}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleEditClick(employee)}
                              className="p-1.5 hover:bg-muted rounded-md transition-colors"
                              title="Edit employee"
                            >
                              <Pencil className="w-4 h-4 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(employee)}
                              className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                              title="Delete employee"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                            <button className="p-1.5 hover:bg-muted rounded-md transition-colors">
                              <MoreVertical className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="bg-secondary border-t border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredEmployees.length} of {employees.length} employees
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                      Previous
                    </button>
                    <span className="px-3 py-1.5 text-sm text-foreground">1</span>
                    <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors">
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* No Results */}
            {!isLoading && filteredEmployees.length === 0 && employees.length > 0 && (
              <div className="text-center py-12 bg-card rounded-xl border border-border mt-6">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No employees found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Clear search
                </button>
              </div>
            )}

            {!isLoading && employees.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-10 h-10 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No employees found</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Add Your First Employee
                </button>
              </div>
            )}
          </>
        )}

        {/* Add Employee Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <div className="text-muted-foreground text-sm mb-1">Employees / Add Employee</div>
              <DialogTitle className="text-xl font-bold text-foreground">Add New Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Enter the details for Employee
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              {/* Photo Upload Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upload Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Photo */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Profile Photo</p>
                    <div 
                      onClick={() => triggerFileInput(fileInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {photoPreview ? (
                        <img 
                          src={photoPreview} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <User className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, false)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Front */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    <div 
                      onClick={() => triggerFileInput(cnicFrontInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {cnicFrontPreview ? (
                        <img 
                          src={cnicFrontPreview} 
                          alt="CNIC Front Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={cnicFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicFrontUpload(e, false)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Back */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    <div 
                      onClick={() => triggerFileInput(cnicBackInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {cnicBackPreview ? (
                        <img 
                          src={cnicBackPreview} 
                          alt="CNIC Back Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={cnicBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicBackUpload(e, false)}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'name', label: 'Employee Name', type: 'text', placeholder: 'e.g John Doe' },
                    { name: 'address', label: 'Address', type: 'text', placeholder: 'e.g Lahore' },
                    { name: 'phone', label: 'Phone No.', type: 'text', placeholder: 'e.g 03001234567' },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'e.g john@example.com' },
                    { name: 'cnic', label: 'CNIC No.', type: 'text', placeholder: 'e.g 17301-242111-3' },
                    { name: 'dob', label: 'Date of Birth', type: 'date' },
                    { name: 'emergencyContact', label: 'Emergency Contact', type: 'text', placeholder: 'e.g 83662626' },
                    { name: 'advancePayment', label: 'Advance Payment', type: 'number', placeholder: 'e.g 5000', min: "0" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name as keyof typeof formData] || ''}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.name === 'advancePayment' ? "1" : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Employment Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'employeeId', label: 'Employee ID', type: 'text', placeholder: 'e.g EMP202' },
                    { 
                      name: 'title', 
                      label: 'Job Title', 
                      type: 'text',
                      placeholder: 'e.g Senior Developer'
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'text',
                      placeholder: 'e.g IT Department'
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'hireDate', label: 'Hiring Date', type: 'date' },
                    { name: 'salary', label: 'Salary*', type: 'number', placeholder: 'e.g 40000', min: "0", step: "1" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name as keyof typeof formData] || ''}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.step}
                        required={field.name === 'salary'}
                      />
                    </div>
                  ))}
                  
                  {/* Time Fields */}
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        value={formData.startTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">End Time</label>
                      <input
                        type="time"
                        name="endTime"
                        value={formData.endTime}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Job Responsibilities</label>
                    <input
                      type="text"
                      name="responsibilities"
                      value={formData.responsibilities}
                      onChange={handleInputChange}
                      placeholder="e.g Designing"
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsAddModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-success rounded-lg text-success-foreground hover:bg-success/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Employee Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            resetEditForm();
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border">
            <DialogHeader>
              <div className="text-muted-foreground text-sm mb-1">Employees / Edit Employee</div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Edit Employee - {editFormData.employeeId || "Loading..."}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Update the details for Employee
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              {/* Photo Upload Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upload Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Photo */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Profile Photo</p>
                    <div 
                      onClick={() => triggerFileInput(editFileInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editPhotoPreview ? (
                        <img 
                          src={editPhotoPreview} 
                          alt="Profile Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <User className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(e, true)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Front */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Front</p>
                    <div 
                      onClick={() => triggerFileInput(editCnicFrontInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editCnicFrontPreview ? (
                        <img 
                          src={editCnicFrontPreview} 
                          alt="CNIC Front Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editCnicFrontInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicFrontUpload(e, true)}
                      className="hidden"
                    />
                  </div>

                  {/* CNIC Back */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">CNIC Back</p>
                    <div 
                      onClick={() => triggerFileInput(editCnicBackInputRef)}
                      className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-secondary transition-colors"
                    >
                      {editCnicBackPreview ? (
                        <img 
                          src={editCnicBackPreview} 
                          alt="CNIC Back Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <FileImage className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 1MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={editCnicBackInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleCnicBackUpload(e, true)}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'name', label: 'Employee Name', type: 'text', placeholder: 'e.g John Doe' },
                    { name: 'address', label: 'Address', type: 'text', placeholder: 'e.g Lahore' },
                    { name: 'phone', label: 'Phone No.', type: 'text', placeholder: 'e.g 03001234567' },
                    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'e.g john@example.com' },
                    { name: 'cnic', label: 'CNIC No.', type: 'text', placeholder: 'e.g 17301-242111-3' },
                    { name: 'dob', label: 'Date of Birth', type: 'date' },
                    { name: 'emergencyContact', label: 'Emergency Contact', type: 'text', placeholder: 'e.g 83662626' },
                    { name: 'advancePayment', label: 'Advance Payment', type: 'number', placeholder: 'e.g 5000', min: "0" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={editFormData[field.name as keyof typeof editFormData] || ''}
                        onChange={handleEditInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.name === 'advancePayment' ? "1" : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Employment Details */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Employee ID</label>
                    <input
                      type="text"
                      name="employeeId"
                      value={editFormData.employeeId}
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground cursor-not-allowed opacity-70"
                      disabled
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground mt-1">Employee ID cannot be changed</p>
                  </div>
                  
                  {[
                    { 
                      name: 'title', 
                      label: 'Job Title', 
                      type: 'text',
                      placeholder: 'e.g Senior Developer'
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'text',
                      placeholder: 'e.g IT Department'
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'hireDate', label: 'Hiring Date', type: 'date' },
                    { name: 'salary', label: 'Salary', type: 'number', placeholder: 'e.g 40000', min: "0", step: "1" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={editFormData[field.name as keyof typeof editFormData] || ''}
                        onChange={handleEditInputChange}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        min={field.min}
                        step={field.step}
                      />
                    </div>
                  ))}
                  
                  {/* Time Fields */}
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">Start Time</label>
                      <input
                        type="time"
                        name="startTime"
                        value={editFormData.startTime}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-2">End Time</label>
                      <input
                        type="time"
                        name="endTime"
                        value={editFormData.endTime}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-muted-foreground mb-2">Job Responsibilities</label>
                    <input
                      type="text"
                      name="responsibilities"
                      value={editFormData.responsibilities}
                      onChange={handleEditInputChange}
                      placeholder="e.g Designing"
                      className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetEditForm();
                  }}
                  className="px-6 py-3 bg-destructive rounded-lg text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateEmployee}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-success rounded-lg text-success-foreground hover:bg-success/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Pencil className="w-4 h-4" />
                      Update
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Employee;