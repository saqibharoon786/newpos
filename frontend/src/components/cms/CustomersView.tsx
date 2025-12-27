import { useState, useEffect } from "react";
import { Search, Plus, Printer, Phone, Mail, Users, Eye, Edit2, Trash2, RefreshCw, FolderOpen } from "lucide-react";
import { AddCustomerDialog, CustomerFormData } from "./AddCustomerDialog";
import { toast } from "sonner";
import axios from "axios";

interface Customer {
  _id: string;
  customerName: string;
  customerId: string;
  phoneNo: string;
  email: string;
  cnicNo: string;
  registrationDate: string;
  address: string;
  province: string;
  city: string;
  photo: string | null;
  documents: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = "http://localhost:5000/api/customers";

export default function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Fetch customers from backend
  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      console.log("📡 Fetching customers from:", `${API_BASE_URL}/getall-customers`);
      
      const response = await axios.get(`${API_BASE_URL}/getall-customers`, {
        timeout: 10000,
      });
      
      console.log("✅ Backend response:", response.data);
      
      if (response.data.success) {
        // Transform backend data to match frontend interface
        const transformedCustomers = response.data.data.map((customer: any) => ({
          _id: customer._id,
          customerName: customer.customerName || "",
          customerId: customer.customerId || `CUST-${new Date(customer.createdAt).getFullYear()}${String(new Date(customer.createdAt).getMonth() + 1).padStart(2, '0')}${String(new Date(customer.createdAt).getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 100000)}`,
          phoneNo: customer.phoneNo || "",
          email: customer.email || "",
          cnicNo: customer.cnicNo || "",
          registrationDate: customer.registrationDate || new Date().toISOString().split('T')[0],
          address: customer.address || "",
          province: customer.province || "",
          city: customer.city || "",
          photo: customer.photo || null,
          documents: customer.documents || [],
          isActive: customer.isActive !== undefined ? customer.isActive : true,
          createdAt: customer.createdAt || new Date().toISOString(),
          updatedAt: customer.updatedAt || new Date().toISOString(),
        }));
        
        setCustomers(transformedCustomers);
        console.log("✅ Customers fetched:", transformedCustomers.length);
        toast.success(`Loaded ${transformedCustomers.length} customers`);
      } else {
        toast.error("Failed to fetch customers: " + (response.data.message || "Unknown error"));
      }
    } catch (error: any) {
      console.error("❌ Error fetching customers:", error);
      
      if (error.code === 'ECONNREFUSED') {
        toast.error("Cannot connect to backend. Please make sure server is running on port 5000.");
      } else if (error.response) {
        toast.error(`Server error ${error.response.status}: ${error.response.data?.message || "Failed to load customers"}`);
      } else if (error.request) {
        toast.error("No response from server. Backend might be down.");
      } else {
        toast.error("Failed to load customers from server");
      }
      
      // Set empty array as fallback
      setCustomers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load customers on component mount
  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer =>
    customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phoneNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.customerId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = () => {
    setAddDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    // Convert Customer to CustomerFormData
    const customerFormData: CustomerFormData = {
      _id: customer._id,
      customerName: customer.customerName,
      customerId: customer.customerId,
      phoneNo: customer.phoneNo,
      email: customer.email,
      cnicNo: customer.cnicNo,
      registrationDate: customer.registrationDate,
      address: customer.address,
      province: customer.province,
      city: customer.city,
      photo: customer.photo,
      documents: customer.documents,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
    setCustomerToEdit(customerFormData);
    setEditDialogOpen(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this customer?")) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/${id}`);
      
      if (response.data.success) {
        toast.success("Customer deleted successfully");
        // Refresh customer list
        fetchCustomers();
        // Close detail view if open
        setSelectedCustomer(null);
      } else {
        toast.error(response.data.message || "Failed to delete customer");
      }
    } catch (error: any) {
      console.error("❌ Error deleting customer:", error);
      toast.error(error.response?.data?.message || "Failed to delete customer");
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCustomers();
  };

  // Handle customer added successfully
  const handleCustomerAdded = () => {
    fetchCustomers();
  };

  // Handle customer updated successfully
  const handleCustomerUpdated = () => {
    fetchCustomers();
    setSelectedCustomer(null); // Close detail view if open
  };

  // Render Customer Detail View
  const renderCustomerDetailView = () => {
    if (!selectedCustomer) return null;

    return (
      <div className="bg-cms-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              ←
            </button>
            <div className="flex items-center gap-4">
              <img 
                src={selectedCustomer.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"} 
                alt={selectedCustomer.customerName}
                className="w-16 h-16 rounded-full object-cover border-2 border-border"
              />
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedCustomer.customerName}</h2>
                <p className="text-sm text-muted-foreground">Customer ID: {selectedCustomer.customerId}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleEditCustomer(selectedCustomer)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => handleDeleteCustomer(selectedCustomer._id)}
              className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Customer Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Personal Info */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Personal Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="text-sm text-foreground">{selectedCustomer.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="text-sm text-foreground">{selectedCustomer.phoneNo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground truncate">{selectedCustomer.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CNIC</p>
                <p className="text-sm text-foreground">{selectedCustomer.cnicNo || "N/A"}</p>
              </div>
            </div>
          </div>

          {/* Address Info */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Address Information</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm text-foreground">{selectedCustomer.address || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">City</p>
                <p className="text-sm text-foreground">{selectedCustomer.city || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Province</p>
                <p className="text-sm text-foreground">{selectedCustomer.province || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registration Date</p>
                <p className="text-sm text-foreground">
                  {new Date(selectedCustomer.registrationDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Status & Documents */}
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Status & Documents</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Account Status</p>
                <span className={`px-3 py-1 rounded-full text-xs ${selectedCustomer.isActive ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                  {selectedCustomer.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Member Since</p>
                <p className="text-sm text-foreground">
                  {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Updated</p>
                <p className="text-sm text-foreground">
                  {new Date(selectedCustomer.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="text-sm text-foreground">
                  {selectedCustomer.documents?.length || 0} document(s)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Documents Preview */}
        {selectedCustomer.documents && selectedCustomer.documents.length > 0 && (
          <div className="bg-cms-sidebar p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">Uploaded Documents</h3>
            <div className="flex flex-wrap gap-3">
              {selectedCustomer.documents.map((doc, index) => (
                <div key={index} className="relative w-20 h-20">
                  <img 
                    src={doc} 
                    alt={`Document ${index + 1}`} 
                    className="w-full h-full object-cover rounded-lg border border-border"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' font-size='10' fill='%23999'%3EDoc%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (selectedCustomer) {
    return (
      <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
        {renderCustomerDetailView()}
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center justify-between border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
            <Users className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-foreground">Customers</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 hover:bg-muted rounded-md transition-colors"
            title="Refresh customers"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Total: {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-cms-card rounded-xl p-8 text-center mb-6">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      )}

      {/* Main Content - Show when not loading */}
      {!isLoading && (
        <>
          {/* Stats Cards - Always show even with 0 customers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Customers</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{customers.length}</p>
            </div>
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Active Customers</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {customers.filter(c => c.isActive).length}
              </p>
            </div>
            <div className="bg-cms-card rounded-xl p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Inactive Customers</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">
                {customers.filter(c => !c.isActive).length}
              </p>
            </div>
          </div>

          {/* Search and Actions - Always show */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customers by name, phone, email, or city"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-80"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={handleAddCustomer}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
              <button className="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* Empty State - When no customers exist */}
          {customers.length === 0 ? (
            <div className="bg-cms-card rounded-xl p-8 sm:p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
                No Customers Yet
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Get started by adding your first customer. You can add customer details, contact information, and upload documents.
              </p>
              <button
                onClick={handleAddCustomer}
                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium flex items-center justify-center gap-2 mx-auto transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Your First Customer
              </button>
            </div>
          ) : (
            <>
              {/* Customer Cards - When customers exist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((customer) => (
                  <div key={customer._id} className="bg-cms-card rounded-xl p-4 sm:p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="relative flex-shrink-0">
                          <img 
                            src={customer.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"} 
                            alt={customer.customerName}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face";
                            }}
                          />
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            customer.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">
                            {customer.customerName}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {customer.city ? `${customer.city}, ${customer.province}` : customer.province || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">ID: {customer.customerId}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditCustomer(customer)}
                          className="p-1.5 hover:bg-muted rounded-md transition-colors"
                          title="Edit customer"
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer._id)}
                          className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 sm:space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="truncate">{customer.phoneNo}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="truncate">{customer.email || "No email"}</span>
                      </div>
                      {customer.cnicNo && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                          <Users className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="truncate">CNIC: {customer.cnicNo}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => handleViewCustomer(customer)}
                        className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        customer.isActive 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-red-500/10 text-red-600'
                      }`}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty Search State */}
              {filteredCustomers.length === 0 && searchTerm && (
                <div className="text-center py-12 bg-cms-card rounded-xl">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No customers found for "{searchTerm}"</p>
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Add Customer Dialog */}
      <AddCustomerDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCustomerAdded={handleCustomerAdded}
        isEditMode={false}
      />

      {/* Edit Customer Dialog */}
      <AddCustomerDialog 
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onCustomerUpdated={handleCustomerUpdated}
        customerToEdit={customerToEdit}
        isEditMode={true}
      />
    </div>
  );
}