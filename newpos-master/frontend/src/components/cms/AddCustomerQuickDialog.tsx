import { useState } from "react";
import { X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

function previewCustomerId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(10000 + Math.random() * 90000);
  return `CUST-${dateStr}-${random}`;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

interface AddCustomerQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function AddCustomerQuickDialog({
  open,
  onOpenChange,
  onSaved,
}: AddCustomerQuickDialogProps) {
  const [customerName, setCustomerName] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [previewId] = useState(previewCustomerId);
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    setCustomerName("");
    setPhoneNo("");
    onOpenChange(false);
  };

  const handleSave = async () => {
    const name = customerName.trim();
    const phone = normalizePhone(phoneNo);

    if (!name) {
      toast.error("Customer name zaroori hai");
      return;
    }
    if (phone.length < 10) {
      toast.error("Phone number kam az kam 10 digits hon");
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.post("/api/customers/create-customers", {
        customerName: name,
        phoneNo: phone,
        address: "",
        province: "",
        city: "",
        amount: 0,
        amountPaid: 0,
      });

      if (res.data.success) {
        toast.success("Customer save ho gaya");
        onSaved?.();
        close();
      } else {
        toast.error(res.data.message || "Save failed");
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Customer save nahi hua");
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-cms-sidebar border border-border rounded-lg w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Add Customer</h2>
          <button type="button" onClick={close} className="p-1 rounded hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground">
            Sirf naam aur phone — save ke baad POS dropdown mein ayega
          </p>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Customer ID (auto)
            </label>
            <input
              type="text"
              readOnly
              value={previewId}
              className="w-full bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm font-mono text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Customer Name *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Ali Traders"
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              Phone No *
            </label>
            <input
              type="tel"
              value={phoneNo}
              onChange={(e) => setPhoneNo(e.target.value)}
              placeholder="e.g. 03001234567"
              className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2.5 border border-border rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
