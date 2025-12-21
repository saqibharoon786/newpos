import { useState } from "react";
import { Search, Plus, Printer, Phone, Mail, Users, Eye } from "lucide-react";
import { AddCustomerDialog, CustomerFormData } from "./AddCustomerDialog";
import { CustomerDetailView } from "./CustomerDetailView";
import { toast } from "sonner";

interface Customer {
  id: number;
  name: string;
  customerId: string;
  location: string;
  phone: string;
  email: string;
  mobile: string;
  cnic: string;
  avatar: string;
  avatarBg: string;
  purchaseDetails: {
    product: string;
    totalProducts: number;
    price: number;
    date: string;
    invoiceId: string;
  };
  history: {
    invoiceId: string;
    productName: string;
    qty: number;
    price: number;
    paymentStatus: "Paid" | "Pending" | "Partially Paid";
    dateTime: string;
  }[];
  installmentPlan: {
    totalLoan: number;
    downPayment: number;
    remainingPayment: number;
    duration: number;
    monthlyInstallment: number;
    paidInstallments: number;
    nextDueDate: string;
    status: "APPROVED" | "PENDING" | "REJECTED";
  } | null;
}

const initialCustomers: Customer[] = [
  { 
    id: 1, 
    name: "Lork Lina",
    customerId: "83722",
    location: "Lahore", 
    phone: "(302) 555-0107",
    email: "alma.lawson@example.com", 
    mobile: "(316) 555-0116",
    cnic: "17301-242111-3",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    avatarBg: "bg-cyan-500",
    purchaseDetails: {
      product: "Macbook Pro 16\"",
      totalProducts: 1,
      price: 400000,
      date: "06/01/2025",
      invoiceId: "INV 82716-521",
    },
    history: [
      { invoiceId: "#13223", productName: "Dell Laptop", qty: 1, price: 80000, paymentStatus: "Paid", dateTime: "10-24-2025 09:00AM" },
      { invoiceId: "#29283", productName: "Plastic Beams", qty: 3, price: 800000, paymentStatus: "Pending", dateTime: "10-20-2025 09:00AM" },
      { invoiceId: "#Bl399", productName: "Plastic Beams", qty: 2, price: 50000, paymentStatus: "Partially Paid", dateTime: "10-10-2025 09:00AM" },
      { invoiceId: "#BHS96", productName: "Plastic Beams", qty: 4, price: 800000, paymentStatus: "Partially Paid", dateTime: "10-05-2025 09:00AM" },
    ],
    installmentPlan: {
      totalLoan: 400000,
      downPayment: 100000,
      remainingPayment: 300000,
      duration: 3,
      monthlyInstallment: 100000,
      paidInstallments: 1,
      nextDueDate: "Dec 15, 2025",
      status: "APPROVED",
    },
  },
  { 
    id: 2, 
    name: "Tuba",
    customerId: "49832",
    location: "Peshawar", 
    phone: "17301-98273-4", 
    email: "tubakpk@example.com", 
    mobile: "(316) 555-0116",
    cnic: "17301-98273-4",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    avatarBg: "bg-green-500",
    purchaseDetails: {
      product: "Office Chair",
      totalProducts: 5,
      price: 75000,
      date: "05/15/2025",
      invoiceId: "INV 82716-522",
    },
    history: [
      { invoiceId: "#13224", productName: "Office Chair", qty: 5, price: 75000, paymentStatus: "Paid", dateTime: "05-15-2025 10:00AM" },
    ],
    installmentPlan: null,
  },
  { 
    id: 3, 
    name: "Jane Cooper",
    customerId: "38291",
    location: "Lahore", 
    phone: "17301-8263-4", 
    email: "goehew@example.com", 
    mobile: "(629) 555-0129",
    cnic: "17301-8263-4",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    avatarBg: "bg-yellow-500",
    purchaseDetails: {
      product: "Desktop Computer",
      totalProducts: 2,
      price: 150000,
      date: "04/20/2025",
      invoiceId: "INV 82716-523",
    },
    history: [
      { invoiceId: "#13225", productName: "Desktop Computer", qty: 2, price: 150000, paymentStatus: "Pending", dateTime: "04-20-2025 11:00AM" },
    ],
    installmentPlan: {
      totalLoan: 150000,
      downPayment: 50000,
      remainingPayment: 100000,
      duration: 5,
      monthlyInstallment: 20000,
      paidInstallments: 2,
      nextDueDate: "Jan 20, 2026",
      status: "APPROVED",
    },
  },
];

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = (data: CustomerFormData) => {
    const newCustomer: Customer = {
      id: customers.length + 1,
      name: data.customerName,
      customerId: data.customerId || String(Math.floor(Math.random() * 100000)),
      location: data.city || data.province || "Unknown",
      phone: data.phoneNo,
      email: data.email,
      mobile: data.phoneNo,
      cnic: data.cnicNo,
      avatar: data.photo || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      avatarBg: "bg-blue-500",
      purchaseDetails: {
        product: "N/A",
        totalProducts: 0,
        price: 0,
        date: data.registrationDate || new Date().toLocaleDateString(),
        invoiceId: "N/A",
      },
      history: [],
      installmentPlan: null,
    };
    setCustomers(prev => [...prev, newCustomer]);
  };

  const handleDeleteCustomer = (id: number) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    setSelectedCustomer(null);
    toast.success("Customer deleted successfully");
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
  };

  if (selectedCustomer) {
    return (
      <CustomerDetailView 
        customer={{
          ...selectedCustomer,
          city: selectedCustomer.location,
        }}
        onBack={() => setSelectedCustomer(null)}
        onDelete={handleDeleteCustomer}
      />
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center gap-3 border-l-4 border-primary">
        <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
          <Users className="w-4 h-4 text-primary-foreground" />
        </div>
        <h1 className="text-base sm:text-lg font-semibold text-foreground">Customers</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-cms-card rounded-xl p-4">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Customers</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">{customers.length}</p>
        </div>
        <div className="bg-cms-card rounded-xl p-4">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">Active Plans</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">
            {customers.filter(c => c.installmentPlan).length}
          </p>
        </div>
        <div className="bg-cms-card rounded-xl p-4">
          <p className="text-xs sm:text-sm text-muted-foreground mb-1">New This Month</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground">2</p>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for anything"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-cms-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-72"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setAddDialogOpen(true)}
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

      {/* Customer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-cms-card rounded-xl p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className="relative flex-shrink-0">
                <img 
                  src={customer.avatar} 
                  alt={customer.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover"
                />
                <button className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">{customer.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{customer.location}</p>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">{customer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">{customer.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="truncate">{customer.mobile}</span>
              </div>
            </div>

            <button 
              onClick={() => handleViewCustomer(customer)}
              className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              View Profile
            </button>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No customers found</p>
        </div>
      )}

      {/* Add Customer Dialog */}
      <AddCustomerDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddCustomer}
      />
    </div>
  );
}