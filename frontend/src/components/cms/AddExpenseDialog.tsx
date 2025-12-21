import { useState, useEffect } from "react";
import { Save, Calendar, Clock, ChevronDown } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Expense {
  _id: string;
  subject: string;
  description: string;
  purpose: "Car" | "Office" | "Travel" | "Equipment";
  price: string;
  personResponsible: "HR" | "Admin" | "CEO" | "Finance Dept";
  usage: "Personal" | "Company";
  date: string;
  time: string;
  createdAt: string;
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  editData?: Expense | null;
}

export function AddExpenseDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  editData 
}: AddExpenseDialogProps) {
  const [formData, setFormData] = useState({
    subject: "",
    description: "",
    purpose: "Car",
    price: "",
    personResponsible: "HR",
    usage: "Personal",
    date: "",
    time: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset form when dialog opens/closes or editData changes
  useEffect(() => {
    if (open) {
      if (editData) {
        // If editing, populate form with existing data
        setFormData({
          subject: editData.subject,
          description: editData.description,
          purpose: editData.purpose,
          price: editData.price,
          personResponsible: editData.personResponsible,
          usage: editData.usage,
          date: editData.date,
          time: editData.time,
        });
      } else {
        // If creating new, reset form
        setFormData({
          subject: "",
          description: "",
          purpose: "Car",
          price: "",
          personResponsible: "HR",
          usage: "Personal",
          date: "",
          time: "",
        });
      }
      setError("");
    }
  }, [open, editData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.subject.trim()) {
      setError("Subject is required");
      return;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }
    if (!formData.price.trim()) {
      setError("Price is required");
      return;
    }
    if (!formData.date.trim()) {
      setError("Date is required");
      return;
    }
    if (!formData.time.trim()) {
      setError("Time is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSave(formData);
    } catch (err: any) {
      console.error("Error saving expense:", err);
      setError(err.message || "Failed to save expense. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 bg-background">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">
              {editData ? "Edit Expense" : "Add New Expense"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editData ? "Update the expense details" : "Enter the details for total expenses"}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Subject *</label>
              <input
                type="text"
                name="subject"
                placeholder="e.g Fuel"
                value={formData.subject}
                onChange={handleInputChange}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Description *</label>
              <textarea
                name="description"
                placeholder="Write short detail"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* Purpose and Price */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Purpose</label>
                <div className="relative">
                  <select
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Car">Car</option>
                    <option value="Office">Office</option>
                    <option value="Travel">Travel</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Price (Rupees) *</label>
                <input
                  type="text"
                  name="price"
                  placeholder="e.g 10,000"
                  value={formData.price}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Person Responsible and Usage */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Person Responsible</label>
                <div className="relative">
                  <select
                    name="personResponsible"
                    value={formData.personResponsible}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="HR">HR</option>
                    <option value="Admin">Admin</option>
                    <option value="CEO">CEO</option>
                    <option value="Finance Dept">Finance Dept</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Usage</label>
                <div className="relative">
                  <select
                    name="usage"
                    value={formData.usage}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Company">Company</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Date & Time *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    name="date"
                    placeholder="mm/dd/yyyy"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    name="time"
                    placeholder="-- : --"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="w-24 bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6">
            <button
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="px-5 py-2.5 bg-cms-input-bg hover:bg-muted border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {editData ? "Updating..." : "Saving..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editData ? "Update" : "Save"}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}