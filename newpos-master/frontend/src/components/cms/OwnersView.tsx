import { useState, useEffect, useCallback } from "react";
import {
  Crown,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  DollarSign,
  PieChart,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/lib/api";

const OWNERS_API = "/api/owners";

interface Owner {
  _id: string;
  ownerCode?: string;
  name: string;
  phone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  profitSharePercent: number;
  investmentAccountId?: string;
  totalProfitReceived?: number;
  advanceBalance?: number;
  isActive?: boolean;
}

interface FinanceHistoryRow {
  _id?: string;
  date: string;
  type: string;
  amount: number;
  method?: string;
  description?: string;
  reference?: string;
  transactionId?: string;
  canDelete?: boolean;
}

interface ProfitPreview {
  periodLabel: string;
  periodYear: number;
  periodMonth: number;
  netProfit: number;
  distributableProfit: number;
  reserveAmount: number;
  totalSharePercent: number;
  shareWarning?: string | null;
  existingStatus?: string | null;
  existingId?: string | null;
  lines: Array<{
    ownerId: string;
    ownerName: string;
    sharePercent: number;
    amount: number;
  }>;
}

interface ProfitDistributionRecord {
  _id: string;
  periodLabel: string;
  netProfit: number;
  distributableProfit: number;
  status: string;
  paidAt?: string;
  lines: Array<{ ownerName: string; sharePercent: number; amount: number }>;
}

const fmt = (n: number) => `Rs. ${(n ?? 0).toLocaleString("en-PK")}`;

const METHOD_LABELS: Record<string, string> = {
  drawer: "Cash Drawer",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  bank: "Bank",
};

export default function OwnersView() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareSummary, setShareSummary] = useState<{ totalSharePercent: number; isValid: boolean } | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOwner, setEditOwner] = useState<Owner | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    cnic: "",
    address: "",
    profitSharePercent: "",
  });

  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [financeHistory, setFinanceHistory] = useState<FinanceHistoryRow[]>([]);
  const [financeForm, setFinanceForm] = useState({
    action: "advance" as "advance" | "repayment",
    method: "drawer",
    amount: "",
    description: "",
  });
  const [financeLoading, setFinanceLoading] = useState(false);

  const now = new Date();
  const [profitYear, setProfitYear] = useState(String(now.getFullYear()));
  const [profitMonth, setProfitMonth] = useState(String(now.getMonth() + 1));
  const [reserveAmount, setReserveAmount] = useState("");
  const [profitPreview, setProfitPreview] = useState<ProfitPreview | null>(null);
  const [profitHistory, setProfitHistory] = useState<ProfitDistributionRecord[]>([]);
  const [profitLoading, setProfitLoading] = useState(false);
  const [payMethod, setPayMethod] = useState("drawer");

  const fetchOwners = useCallback(async () => {
    setLoading(true);
    try {
      const [res, shareRes] = await Promise.all([
        api.get(OWNERS_API),
        api.get(`${OWNERS_API}/share-summary`),
      ]);
      if (res.data?.success) setOwners(res.data.data || []);
      if (shareRes.data?.success) setShareSummary(shareRes.data.data);
    } catch {
      toast.error("Owners load nahi ho sakay");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfitHistory = useCallback(async () => {
    try {
      const res = await api.get(`${OWNERS_API}/profit-distribution`);
      if (res.data?.success) setProfitHistory(res.data.data || []);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    fetchOwners();
    fetchProfitHistory();
  }, [fetchOwners, fetchProfitHistory]);

  const loadOwnerFinance = async (owner: Owner) => {
    setSelectedOwner(owner);
    try {
      const res = await api.get(`${OWNERS_API}/${owner._id}`);
      if (res.data?.success) {
        setFinanceHistory(res.data.data.financeHistory || []);
        setSelectedOwner({ ...owner, ...res.data.data });
      }
    } catch {
      setFinanceHistory([]);
    }
  };

  const openAdd = () => {
    setEditOwner(null);
    setForm({ name: "", phone: "", email: "", cnic: "", address: "", profitSharePercent: "" });
    setDialogOpen(true);
  };

  const openEdit = (o: Owner) => {
    setEditOwner(o);
    setForm({
      name: o.name,
      phone: o.phone || "",
      email: o.email || "",
      cnic: o.cnic || "",
      address: o.address || "",
      profitSharePercent: String(o.profitSharePercent ?? ""),
    });
    setDialogOpen(true);
  };

  const saveOwner = async () => {
    if (!form.name.trim()) {
      toast.error("Owner name zaroori hai");
      return;
    }
    try {
      const payload = {
        ...form,
        profitSharePercent: parseFloat(form.profitSharePercent) || 0,
      };
      if (editOwner) {
        await api.put(`${OWNERS_API}/${editOwner._id}`, payload);
        toast.success("Owner update ho gaya");
      } else {
        await api.post(OWNERS_API, payload);
        toast.success("Owner add ho gaya");
      }
      setDialogOpen(false);
      fetchOwners();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || "Save failed");
    }
  };

  const deleteOwner = async (o: Owner) => {
    if (!window.confirm(`${o.name} deactivate karna hai?`)) return;
    try {
      await api.delete(`${OWNERS_API}/${o._id}`);
      toast.success("Owner deactivate ho gaya");
      if (selectedOwner?._id === o._id) setSelectedOwner(null);
      fetchOwners();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || "Delete failed");
    }
  };

  const submitFinance = async () => {
    if (!selectedOwner) return;
    const amt = parseFloat(financeForm.amount);
    if (!amt || amt <= 0) {
      toast.error("Valid amount enter karen");
      return;
    }
    setFinanceLoading(true);
    try {
      const url =
        financeForm.action === "advance"
          ? `${OWNERS_API}/${selectedOwner._id}/advance`
          : `${OWNERS_API}/${selectedOwner._id}/repayment`;
      const res = await api.post(url, {
        method: financeForm.method,
        amount: amt,
        description: financeForm.description,
      });
      toast.success(res.data?.message || "Done");
      setFinanceForm((p) => ({ ...p, amount: "", description: "" }));
      fetchOwners();
      loadOwnerFinance(selectedOwner);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || "Finance failed");
    } finally {
      setFinanceLoading(false);
    }
  };

  const previewProfit = async () => {
    setProfitLoading(true);
    try {
      const res = await api.get(`${OWNERS_API}/profit-distribution/preview`, {
        params: {
          year: profitYear,
          month: profitMonth,
          reserveAmount: reserveAmount || 0,
        },
      });
      if (res.data?.success) {
        setProfitPreview(res.data.data);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || "Preview failed");
    } finally {
      setProfitLoading(false);
    }
  };

  const saveDraftAndPay = async () => {
    if (!profitPreview) {
      toast.error("Pehle preview karen");
      return;
    }
    if (profitPreview.existingStatus === "paid") {
      toast.error("Is month ka profit pehle distribute ho chuka");
      return;
    }
    if (owners.length > 0 && shareSummary && !shareSummary.isValid) {
      toast.error(`Owner shares total ${shareSummary.totalSharePercent}% — 100% set karen`);
      return;
    }
    if (!window.confirm(`${profitPreview.periodLabel} ka profit distribute karna hai?`)) return;

    setProfitLoading(true);
    try {
      const draftRes = await api.post(`${OWNERS_API}/profit-distribution/draft`, {
        year: profitPreview.periodYear,
        month: profitPreview.periodMonth,
        reserveAmount: profitPreview.reserveAmount,
      });
      const distId = draftRes.data?.data?._id || profitPreview.existingId;
      if (!distId) throw new Error("Draft save failed");

      const payRes = await api.post(`${OWNERS_API}/profit-distribution/${distId}/pay`, {
        method: payMethod,
      });
      toast.success(payRes.data?.message || "Profit distribute ho gaya");
      setProfitPreview(null);
      fetchOwners();
      fetchProfitHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || "Distribution failed");
    } finally {
      setProfitLoading(false);
    }
  };

  const months = [
    { v: "1", l: "January" }, { v: "2", l: "February" }, { v: "3", l: "March" },
    { v: "4", l: "April" }, { v: "5", l: "May" }, { v: "6", l: "June" },
    { v: "7", l: "July" }, { v: "8", l: "August" }, { v: "9", l: "September" },
    { v: "10", l: "October" }, { v: "11", l: "November" }, { v: "12", l: "December" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Crown className="w-7 h-7 text-primary" />
            Owners
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pehle owner add karen — phr Finance se advance/payment — month end par profit distribute
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchOwners} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Add Owner
          </Button>
        </div>
      </div>

      {shareSummary && owners.length > 0 && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            shareSummary.isValid
              ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
              : "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20"
          }`}
        >
          Total profit share: <strong>{shareSummary.totalSharePercent}%</strong>
          {!shareSummary.isValid && " — sab owners ka share mil kar 100% hona chahiye"}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">Owner List</CardTitle>
            <CardDescription>Active business partners / owners</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : owners.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                Koi owner nahi — &quot;Add Owner&quot; se shuru karen
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cms-table-header">
                    <tr>
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">Name</th>
                      <th className="text-right p-3 font-medium">Share %</th>
                      <th className="text-right p-3 font-medium">Advance</th>
                      <th className="text-right p-3 font-medium">Profit Received</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owners.filter((o) => o.isActive !== false).map((o) => (
                      <tr
                        key={o._id}
                        className={`border-t border-border hover:bg-cms-card-hover cursor-pointer ${
                          selectedOwner?._id === o._id ? "bg-primary/5" : ""
                        }`}
                        onClick={() => loadOwnerFinance(o)}
                      >
                        <td className="p-3 text-muted-foreground">{o.ownerCode || "—"}</td>
                        <td className="p-3 font-medium">{o.name}</td>
                        <td className="p-3 text-right">{o.profitSharePercent ?? 0}%</td>
                        <td className="p-3 text-right text-purple-600">{fmt(o.advanceBalance ?? 0)}</td>
                        <td className="p-3 text-right text-green-600">{fmt(o.totalProfitReceived ?? 0)}</td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteOwner(o)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Owner Finance
            </CardTitle>
            <CardDescription>
              {selectedOwner ? selectedOwner.name : "List se owner select karen"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {!selectedOwner ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Advance lena / wapas dena ke liye owner select karen
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm rounded-lg border p-3 bg-secondary/30">
                  <span className="text-muted-foreground">Outstanding advance</span>
                  <span className="font-bold text-right text-purple-700">
                    {fmt(selectedOwner.advanceBalance ?? 0)}
                  </span>
                  <span className="text-muted-foreground">Total profit received</span>
                  <span className="font-bold text-right text-green-700">
                    {fmt(selectedOwner.totalProfitReceived ?? 0)}
                  </span>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={financeForm.action}
                    onValueChange={(v) =>
                      setFinanceForm((p) => ({ ...p, action: v as "advance" | "repayment" }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="advance">Advance Lena (owner ko dena)</SelectItem>
                      <SelectItem value="repayment">Wapas Lena (owner se receive)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={financeForm.method}
                    onValueChange={(v) => setFinanceForm((p) => ({ ...p, method: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drawer">Cash Drawer</SelectItem>
                      <SelectItem value="easypaisa">Easypaisa</SelectItem>
                      <SelectItem value="jazzcash">JazzCash</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={financeForm.amount}
                    onChange={(e) => setFinanceForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    value={financeForm.description}
                    onChange={(e) => setFinanceForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <Button className="w-full" onClick={submitFinance} disabled={financeLoading}>
                  {financeLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm
                </Button>
                {financeHistory.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <History className="w-3 h-3" /> Recent history
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                      {financeHistory.slice(0, 8).map((h, i) => (
                        <div key={h._id || i} className="flex justify-between gap-2">
                          <span className="truncate">{h.description || h.type}</span>
                          <span className={h.type === "repayment" ? "text-green-600" : "text-purple-600"}>
                            {fmt(h.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            Month-End Profit Distribution
          </CardTitle>
          <CardDescription>
            Net profit hisaab se har owner ko un ke share % ke mutabiq profit distribute karen
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input value={profitYear} onChange={(e) => setProfitYear(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={profitMonth} onValueChange={setProfitMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reserve (business mein rakhen)</Label>
              <Input
                type="number"
                value={reserveAmount}
                onChange={(e) => setReserveAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Pay from account</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="drawer">Cash Drawer</SelectItem>
                  <SelectItem value="easypaisa">Easypaisa</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" className="flex-1" onClick={previewProfit} disabled={profitLoading}>
                Preview
              </Button>
              <Button className="flex-1" onClick={saveDraftAndPay} disabled={profitLoading || !profitPreview}>
                Distribute
              </Button>
            </div>
          </div>

          {profitPreview && (
            <div className="rounded-lg border border-border p-4 space-y-3 bg-secondary/20">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="font-semibold">{profitPreview.periodLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Profit</p>
                  <p className="font-semibold text-green-600">{fmt(profitPreview.netProfit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Distributable</p>
                  <p className="font-semibold">{fmt(profitPreview.distributableProfit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold capitalize">{profitPreview.existingStatus || "New"}</p>
                </div>
              </div>
              {profitPreview.shareWarning && (
                <p className="text-amber-600 text-sm">{profitPreview.shareWarning}</p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Owner</th>
                    <th className="text-right py-2">Share %</th>
                    <th className="text-right py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {profitPreview.lines.map((l) => (
                    <tr key={l.ownerId} className="border-b border-border/50">
                      <td className="py-2">{l.ownerName}</td>
                      <td className="py-2 text-right">{l.sharePercent}%</td>
                      <td className="py-2 text-right font-medium text-green-600">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {profitHistory.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3">Distribution History</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cms-table-header">
                    <tr>
                      <th className="text-left p-2">Period</th>
                      <th className="text-right p-2">Net Profit</th>
                      <th className="text-right p-2">Distributed</th>
                      <th className="text-center p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitHistory.map((d) => (
                      <tr key={d._id} className="border-t border-border">
                        <td className="p-2">{d.periodLabel}</td>
                        <td className="p-2 text-right">{fmt(d.netProfit)}</td>
                        <td className="p-2 text-right text-green-600">{fmt(d.distributableProfit)}</td>
                        <td className="p-2 text-center capitalize">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editOwner ? "Edit Owner" : "Add Owner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Profit Share %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.profitSharePercent}
                onChange={(e) => setForm((p) => ({ ...p, profitSharePercent: e.target.value }))}
                placeholder="e.g. 50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>CNIC</Label>
                <Input value={form.cnic} onChange={(e) => setForm((p) => ({ ...p, cnic: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveOwner}>{editOwner ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
