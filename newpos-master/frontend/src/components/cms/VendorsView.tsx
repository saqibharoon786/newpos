import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Phone,
  Users,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  Package,
  Eye,
  MapPin,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { exportAsCsv, exportAsExcelTable, exportAsPdf } from "@/lib/exportUtils";
import { PRODUCT_CODES, getMaterialNameForCode, getProductByCode } from "@/lib/productCodes";

interface VendorMaterial {
  productCode: string;
  materialName: string;
  pricePerKg: number;
  defaultWeight?: number;
}

interface Vendor {
  _id: string;
  vendorId: string;
  name: string;
  phone: string;
  address?: string;
  materials: VendorMaterial[];
  payableBalance?: number;
  advanceBalance?: number;
  ledgerClosingBalance?: number;
  ledgerOpeningBalance?: number;
  ledgerAdvanceBalance?: number;
  createdAt?: string;
}

interface MaterialRowForm {
  productCode: string;
  materialName: string;
  pricePerKg: string;
  weight: string;
}

const emptyMaterialRow = (): MaterialRowForm => ({
  productCode: "",
  materialName: "",
  pricePerKg: "",
  weight: "",
});

function previewVendorId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(10000 + Math.random() * 90000);
  return `VEND-${dateStr}-${random}`;
}

export default function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [previewId, setPreviewId] = useState(previewVendorId());
  const [materialRows, setMaterialRows] = useState<MaterialRowForm[]>([
    emptyMaterialRow(),
  ]);

  const fetchVendors = async () => {
    try {
      const res = await api.get("/api/vendors", { params: { withLedger: "1" } });
      if (res.data.success) {
        setVendors(res.data.data || []);
      }
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Failed to load vendors";
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const filteredVendors = vendors.filter((v) => {
    const q = searchTerm.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.vendorId || "").toLowerCase().includes(q) ||
      (v.phone || "").toLowerCase().includes(q)
    );
  });

  const openAddDialog = () => {
    setEditingVendor(null);
    setName("");
    setPhone("");
    setAddress("");
    setPreviewId(previewVendorId());
    setMaterialRows([emptyMaterialRow()]);
    setDialogOpen(true);
  };

  const openViewDialog = async (vendor: Vendor) => {
    try {
      const res = await api.get(`/api/vendors/${vendor._id}`);
      if (res.data.success && res.data.data) {
        setViewingVendor(res.data.data);
      } else {
        setViewingVendor(vendor);
      }
    } catch {
      setViewingVendor(vendor);
    }
    setViewDialogOpen(true);
  };

  const closeViewDialog = () => {
    setViewDialogOpen(false);
    setViewingVendor(null);
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setName(vendor.name);
    setPhone(vendor.phone || "");
    setAddress(vendor.address || "");
    setPreviewId(vendor.vendorId);
    setMaterialRows(
      vendor.materials?.length
        ? vendor.materials.map((m) => ({
            productCode: m.productCode || "",
            materialName: m.materialName || "",
            pricePerKg: String(m.pricePerKg ?? ""),
            weight: m.defaultWeight ? String(m.defaultWeight) : "",
          }))
        : [emptyMaterialRow()]
    );
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingVendor(null);
  };

  const updateMaterialRow = (
    index: number,
    field: keyof MaterialRowForm,
    value: string
  ) => {
    setMaterialRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "productCode" && value) {
        const materialName = getMaterialNameForCode(value);
        if (materialName) next[index].materialName = materialName;
        const bagSize = getProductByCode(value)?.bagSize;
        if (bagSize && bagSize > 0 && !next[index].weight.trim()) {
          next[index].weight = String(bagSize);
        }
      }
      return next;
    });
  };

  const addMaterialRow = () => {
    setMaterialRows((prev) => [...prev, emptyMaterialRow()]);
  };

  const removeMaterialRow = (index: number) => {
    setMaterialRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    const materials = materialRows
      .filter((r) => r.materialName.trim() || r.productCode.trim())
      .map((r) => ({
        productCode: r.productCode,
        materialName: r.materialName.trim() || getMaterialNameForCode(r.productCode),
        pricePerKg: parseFloat(r.pricePerKg) || 0,
        defaultWeight: parseFloat(r.weight) || 0,
      }));

    setIsSaving(true);
    try {
      const payload = { name: name.trim(), phone, address, materials };
      if (editingVendor) {
        const res = await api.put(`/api/vendors/${editingVendor._id}`, payload);
        if (res.data.success) {
          toast.success("Vendor updated");
          closeDialog();
          fetchVendors();
        }
      } else {
        const res = await api.post("/api/vendors", payload);
        if (res.data.success) {
          toast.success(
            res.data.message === "Vendor already exists"
              ? "Vendor already exists"
              : "Vendor created"
          );
          closeDialog();
          fetchVendors();
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to save vendor");
    } finally {
      setIsSaving(false);
    }
  };

  const exportVendors = (format: "csv" | "excel" | "pdf") => {
    const headers = [
      "Vendor ID",
      "Name",
      "Phone",
      "Address",
      "Closing Balance",
      "Advance Balance",
    ];
    const rows = filteredVendors.map((v) => ({
      "Vendor ID": v.vendorId || v._id,
      Name: v.name,
      Phone: v.phone || "",
      Address: v.address || "",
      "Closing Balance": v.ledgerClosingBalance ?? v.payableBalance ?? 0,
      "Advance Balance": v.ledgerAdvanceBalance ?? v.advanceBalance ?? 0,
    }));
    const name = `Vendors_${Date.now()}`;
    if (format === "csv") exportAsCsv(`${name}.csv`, headers, rows);
    else if (format === "excel") exportAsExcelTable(`${name}.xls`, "Vendors", headers, rows);
    else {
      const body = rows
        .map((r) => `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r]}</td>`).join("")}</tr>`)
        .join("");
      exportAsPdf("Vendors", `<table border="1" cellpadding="4"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`);
    }
    toast.success("Vendors exported");
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Delete vendor "${vendor.name}"?`)) return;
    try {
      const res = await api.delete(`/api/vendors/${vendor._id}`);
      if (res.data.success) {
        toast.success("Vendor deleted");
        fetchVendors();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to delete vendor");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register vendors with materials, codes, and price per kg — used in POP
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportVendors("excel")}
            className="px-3 py-2.5 bg-cms-card border border-border rounded-md text-sm font-medium hover:bg-cms-card-hover"
          >
            Excel
          </button>
          <button
            type="button"
            onClick={() => exportVendors("pdf")}
            className="px-3 py-2.5 bg-cms-card border border-border rounded-md text-sm font-medium hover:bg-cms-card-hover"
          >
            PDF
          </button>
          <button
            type="button"
            onClick={openAddDialog}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-cms-card border border-border rounded-md text-sm text-foreground"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setIsRefreshing(true);
            fetchVendors();
          }}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-md text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading vendors...
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No vendors yet. Add your first vendor to use in POP.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor._id}
              className="bg-cms-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{vendor.name}</h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {vendor.vendorId}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openViewDialog(vendor)}
                    className="p-2 text-muted-foreground hover:text-cms-success rounded-md"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditDialog(vendor)}
                    className="p-2 text-muted-foreground hover:text-primary rounded-md"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(vendor)}
                    className="p-2 text-muted-foreground hover:text-red-500 rounded-md"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {vendor.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-3">
                  <Phone className="w-3.5 h-3.5" />
                  {vendor.phone}
                </p>
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Materials & rates
                </p>
                {(vendor.materials || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No materials configured</p>
                ) : (
                  vendor.materials.map((m, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-sm py-1.5 px-2 bg-background rounded border border-border"
                    >
                      <span>
                        {m.productCode ? `${m.productCode} – ` : ""}
                        {m.materialName}
                        {m.defaultWeight ? ` · ${m.defaultWeight} kg` : ""}
                      </span>
                      <span className="font-medium text-foreground">
                        Rs. {Number(m.pricePerKg).toLocaleString()}/kg
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewDialogOpen && viewingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-cms-sidebar border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-cms-sidebar border-b border-border px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">Vendor Details</h2>
              <button type="button" onClick={closeViewDialog} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Vendor ID</p>
                  <p className="text-sm font-mono font-medium text-foreground flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    {viewingVendor.vendorId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Name</p>
                  <p className="text-sm font-semibold text-foreground">{viewingVendor.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    {viewingVendor.phone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Address</p>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {viewingVendor.address || "—"}
                  </p>
                </div>
              </div>

              {(viewingVendor.ledgerClosingBalance != null ||
                viewingVendor.payableBalance != null ||
                viewingVendor.advanceBalance != null) && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Closing Balance (Ledger)</p>
                    <p className="text-sm font-semibold text-red-600">
                      Rs.{" "}
                      {(
                        viewingVendor.ledgerClosingBalance ??
                        viewingVendor.payableBalance ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Advance Balance</p>
                    <p className="text-sm font-semibold text-green-600">
                      Rs.{" "}
                      {(
                        viewingVendor.ledgerAdvanceBalance ??
                        viewingVendor.advanceBalance ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Materials & Pricing
                </h4>
                {(viewingVendor.materials || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials configured</p>
                ) : (
                  <div className="space-y-2">
                    {viewingVendor.materials.map((m, i) => {
                      const lineTotal =
                        (Number(m.defaultWeight) || 0) * (Number(m.pricePerKg) || 0);
                      return (
                        <div
                          key={i}
                          className="p-3 bg-background border border-border rounded-md text-sm"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-foreground">
                              {m.productCode ? `${m.productCode} – ` : ""}
                              {m.materialName}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              Code {m.productCode || "—"}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Weight</span>
                              <p className="font-medium text-foreground">
                                {m.defaultWeight ? `${m.defaultWeight} kg` : "—"}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Price/kg</span>
                              <p className="font-medium text-foreground">
                                Rs. {Number(m.pricePerKg).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Line Total</span>
                              <p className="font-medium text-foreground">
                                Rs. {lineTotal.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {viewingVendor.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Registered: {new Date(viewingVendor.createdAt).toLocaleDateString("en-PK", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeViewDialog}
                  className="px-4 py-2.5 border border-border rounded-md text-sm"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeViewDialog();
                    openEditDialog(viewingVendor);
                  }}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-cms-sidebar border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-cms-sidebar border-b border-border px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </h2>
              <button type="button" onClick={closeDialog} className="p-1 rounded hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">
                    Vendor ID (auto)
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
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ali Traders"
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Phone No</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03xx-xxxxxxx"
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg bg-cms-card/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Materials & pricing
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Optional — code select karein to POP mein auto-fill hoga
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMaterialRow}
                    className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>

                <div className="space-y-3">
                  {materialRows.map((row, index) => {
                    const rowTotal =
                      (parseFloat(row.weight) || 0) * (parseFloat(row.pricePerKg) || 0);
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-12 gap-2 items-end p-3 bg-background border border-border rounded-md"
                      >
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Code</label>
                          <select
                            value={row.productCode}
                            onChange={(e) =>
                              updateMaterialRow(index, "productCode", e.target.value)
                            }
                            className="w-full bg-cms-card border border-border rounded-md px-1 py-2 text-xs"
                          >
                            <option value="">—</option>
                            {PRODUCT_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <label className="block text-xs text-muted-foreground mb-1">
                            Material
                          </label>
                          <input
                            type="text"
                            value={row.materialName}
                            onChange={(e) =>
                              updateMaterialRow(index, "materialName", e.target.value)
                            }
                            className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">
                            Price/kg
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.pricePerKg}
                            onChange={(e) =>
                              updateMaterialRow(index, "pricePerKg", e.target.value)
                            }
                            className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={row.weight}
                            onChange={(e) =>
                              updateMaterialRow(index, "weight", e.target.value)
                            }
                            placeholder="e.g. 500"
                            className="w-full bg-cms-card border border-border rounded-md px-2 py-2 text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-muted-foreground mb-1">Total</label>
                          <div className="px-2 py-2 text-sm font-medium bg-muted/50 border border-border rounded-md">
                            Rs. {rowTotal.toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {materialRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMaterialRow(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
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
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingVendor ? "Update" : "Save"} Vendor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
