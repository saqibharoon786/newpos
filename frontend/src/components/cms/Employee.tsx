// Employee.tsx - BACKEND COMPATIBLE VERSION
import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import axios from "axios";

// ==================== API CONFIGURATION ====================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

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
}

const Employee = () => {
  // State Management
  const [employees, setEmployees] = useState<EmployeeType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeType | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [view, setView] = useState<"list" | "detail">("list");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
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
  });

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    fetchEmployees();
    fetchEmployeeStats();
  }, []);

  // ==================== API FUNCTIONS ====================
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await API.get("/employees/get-all");
      if (response.data.success) {
        // Backend سے آنے والے ڈیٹا کو درست طریقے سے مپ کریں
        const employeesData = (response.data.data || []).map((emp: any) => ({
          ...emp,
          id: emp._id, 
        }));
        setEmployees(employeesData);
      } else {
        setEmployees([]);
      }
    } catch (error: any) {
      console.error("Failed to load employees:", error);
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

  const createEmployee = async (employeeData: any, photoFile?: File) => {
    try {
      setIsSubmitting(true);
      const formDataToSend = new FormData();
      
      // Append all form data
      Object.keys(employeeData).forEach(key => {
        const value = employeeData[key];
        if (value !== undefined && value !== null && value !== '') {
          formDataToSend.append(key, String(value));
        }
      });

      // Append photo if exists
      if (photoFile) {
        formDataToSend.append("avatar", photoFile);
      }

      const response = await API.post("/employees/create-employee", formDataToSend);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to create employee');
      }
    } catch (error: any) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPDATE EMPLOYEE - BACKEND COMPATIBLE
  const updateEmployee = async (id: string, employeeData: any, photoFile?: File) => {
    try {
      setIsSubmitting(true);
      
      // Check if id is valid
      if (!id || id === "undefined") {
        throw new Error("Invalid employee ID");
      }
      
      console.log("Updating employee with MongoDB _id:", id);
      
      const formDataToSend = new FormData();
      
      // Append all form data
      Object.keys(employeeData).forEach(key => {
        const value = employeeData[key];
        if (value !== undefined && value !== null && value !== '') {
          formDataToSend.append(key, String(value));
        }
      });

      // Append photo if exists
      if (photoFile) {
        formDataToSend.append("avatar", photoFile);
      }

      // Use the MongoDB _id for updating
      const response = await API.put(`/employees/${id}`, formDataToSend);
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to update employee');
      }
    } catch (error: any) {
      console.error("Update error details:", error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  // DELETE EMPLOYEE - BACKEND COMPATIBLE
  const deleteEmployee = async (id: string) => {
    try {
      // Check if id is valid
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
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

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

  const triggerFileInput = (isEdit = false) => {
    if (isEdit) {
      editFileInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleSaveEmployee = async () => {
    try {
      setIsSubmitting(true);
      const photoFile = fileInputRef.current?.files?.[0];
      
      const response = await createEmployee(formData, photoFile);
      
      if (response.success) {
        // Add new employee to the list with proper _id mapping
        const newEmployee = {
          ...response.data,
          id: response.data._id, // Map _id to id
        };
        setEmployees(prev => [...prev, newEmployee]);
        setIsAddModalOpen(false);
        resetForm();
        await fetchEmployeeStats();
        alert("✅ Employee created successfully!");
      }
    } catch (error: any) {
      console.error("Create error:", error);
      alert(`Error: ${error.response?.data?.message || error.message || "Failed to create employee"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // HANDLE UPDATE - USING MONGODB _id
  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) {
      alert("No employee selected");
      return;
    }

    try {
      setIsSubmitting(true);
      const photoFile = editFileInputRef.current?.files?.[0];
      
      // Use MongoDB _id from selectedEmployee
      const mongoId = selectedEmployee._id;
      console.log("Updating employee with MongoDB ID:", mongoId);
      
      if (!mongoId || mongoId === "undefined") {
        alert("Invalid employee ID. Cannot update.");
        return;
      }
      
      console.log(`✏️ Updating employee with MongoDB ID: ${mongoId}...`);
      
      const response = await updateEmployee(mongoId, editFormData, photoFile);
      
      if (response.success) {
        // Update the employee in the list using _id
        const updatedEmployee = {
          ...response.data,
          id: response.data._id, // Map _id to id
        };
        
        setEmployees(prev => 
          prev.map(emp => emp._id === mongoId ? updatedEmployee : emp)
        );
        
        // Update the selected employee
        setSelectedEmployee(updatedEmployee);
        setIsEditModalOpen(false);
        alert("✅ Employee updated successfully!");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.response?.data?.message || "Failed to update employee. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // HANDLE DELETE - USING MONGODB _id
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
        // Remove from the list using _id
        setEmployees(prev => prev.filter(emp => emp._id !== employee._id));
        
        // If viewing this employee's detail, go back to list
        if (selectedEmployee && selectedEmployee._id === employee._id) {
          setView("list");
          setSelectedEmployee(null);
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
    });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    });
    setEditPhotoPreview(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  };

  // Handle View Profile click
  const handleViewProfile = (employee: EmployeeType) => {
    setSelectedEmployee(employee);
    setView("detail");
  };

  // Handle Edit click - FIXED FOR MONGODB _id
 const handleEditClick = (employee: EmployeeType) => {
  console.log("Editing employee with MongoDB ID:", employee._id);
  
  if (!employee) {
    alert("Error: Employee data not found");
    return;
  }
  
  setSelectedEmployee(employee);
  
  // Extract salary number from formatted string
  let salaryValue = "";
  if (employee.salary) {
    // Remove "Rs. " and commas, then parse the number
    const salaryMatch = employee.salary.match(/[\d,]+\.?\d*/);
    if (salaryMatch) {
      salaryValue = salaryMatch[0].replace(/,/g, '');
    }
  }
  
  const formattedData = {
    _id: employee._id || "", // Add the _id field here
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
  };
  
  console.log("Edit form data:", formattedData);
  
  setEditFormData(formattedData);
  setEditPhotoPreview(employee.avatar || null);
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
                onClick={() => {
                  setView("list");
                  setSelectedEmployee(null);
                }}
                className="text-foreground hover:text-muted-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={selectedEmployee.avatar}
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
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employees</h1>
            <p className="text-sm text-muted-foreground">Total: {stats.totalEmployees} employees</p>
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
              className="flex items-center gap-2 px-5 py-3 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Employees
            </button>
            <button className="flex items-center gap-2 px-5 py-3 bg-card border border-border rounded-xl text-foreground hover:bg-secondary transition-colors">
              <Printer className="w-5 h-5" />
              Print
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
            {/* Employee Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee._id} // Use MongoDB _id as key
                  className="bg-card rounded-xl p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={employee.avatar}
                        alt={employee.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                        }}
                      />
                      <div>
                        <h3 className="font-semibold text-foreground">{employee.name}</h3>
                        <p className="text-sm text-muted-foreground">{employee.title}</p>
                        <p className="text-xs text-muted-foreground">ID: {employee.employeeId}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEditClick(employee)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Edit Employee"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{employee.department || "No Department"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{employee.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{employee.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{formatSchedule(employee)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <DollarSign className="w-4 h-4" />
                      <span>{formatSalary(employee.salary)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewProfile(employee)}
                    className="w-full mt-5 py-2.5 text-center text-foreground hover:text-primary transition-colors border-t border-border"
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>

            {/* No Results */}
            {!isLoading && filteredEmployees.length === 0 && employees.length > 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No employees match your search</p>
              </div>
            )}

            {!isLoading && employees.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No employees found</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
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
              {/* Photo Upload */}
              <div className="flex items-center gap-4 mb-8">
                <div 
                  onClick={() => triggerFileInput(false)}
                  className="w-16 h-16 bg-primary rounded-full flex items-center justify-center relative cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  {photoPreview ? (
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary-foreground" />
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                    <Plus className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, false)}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Upload Photo</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG up to 1MB</p>
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
                      type: 'select',
                      options: ['', 'Lead Designer', 'Frontend Dev', 'Backend Dev', 'Manager', 'HR', 'Accountant', 'Sales Executive'] 
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'select',
                      options: ['', 'Production', 'Engineering', 'Marketing', 'HR', 'Finance', 'Sales', 'Operations'] 
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'hireDate', label: 'Hiring Date', type: 'date' },
                    { name: 'salary', label: 'Salary', type: 'text', placeholder: 'e.g 40000' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      {field.type === 'select' ? (
                        <select
                          name={field.name}
                          value={formData[field.name as keyof typeof formData] || ''}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {field.options?.map(option => (
                            <option key={option} value={option}>
                              {option || `Select ${field.label.toLowerCase()}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          value={formData[field.name as keyof typeof formData] || ''}
                          onChange={handleInputChange}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      )}
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
              <DialogTitle className="text-xl font-bold text-foreground">Edit Employee - {editFormData._id}</DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                Update the details for Employee
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              {/* Photo Upload */}
              <div className="flex items-center gap-4 mb-8">
                <div 
                  onClick={() => triggerFileInput(true)}
                  className="w-16 h-16 bg-primary rounded-full flex items-center justify-center relative cursor-pointer hover:bg-primary/90 transition-colors"
                >
                  {editPhotoPreview ? (
                    <img 
                      src={editPhotoPreview} 
                      alt="Preview" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary-foreground" />
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                    <Plus className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, true)}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Upload Photo</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG up to 1MB</p>
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
                      type: 'select',
                      options: ['', 'Lead Designer', 'Frontend Dev', 'Backend Dev', 'Manager', 'HR', 'Accountant', 'Sales Executive'] 
                    },
                    { 
                      name: 'department', 
                      label: 'Department', 
                      type: 'select',
                      options: ['', 'Production', 'Engineering', 'Marketing', 'HR', 'Finance', 'Sales', 'Operations'] 
                    },
                    { name: 'reportingManager', label: 'Reporting Manager', type: 'text', placeholder: 'e.g Mil young' },
                    { name: 'hireDate', label: 'Hiring Date', type: 'date' },
                    { name: 'salary', label: 'Salary', type: 'text', placeholder: 'e.g 40000' },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm text-muted-foreground mb-2">{field.label}</label>
                      {field.type === 'select' ? (
                        <select
                          name={field.name}
                          value={editFormData[field.name as keyof typeof editFormData] || ''}
                          onChange={handleEditInputChange}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {field.options?.map(option => (
                            <option key={option} value={option}>
                              {option || `Select ${field.label.toLowerCase()}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          name={field.name}
                          value={editFormData[field.name as keyof typeof editFormData] || ''}
                          onChange={handleEditInputChange}
                          placeholder={field.placeholder}
                          className="w-full px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      )}
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