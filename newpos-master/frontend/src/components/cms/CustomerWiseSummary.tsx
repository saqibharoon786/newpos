import { useMemo } from "react";
import { Users, Download, FileText, DollarSign, History, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  buildCustomerSummaryFromSales,
  getColorNameFromHex,
  type SaleForSummary,
} from "@/lib/customerSummary";
import { exportAsCsv, exportAsWordTable, toYmd } from "@/lib/exportUtils";

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString();
}

interface CustomerWiseSummaryProps {
  sales: SaleForSummary[];
  title?: string;
  exportFilePrefix?: string;
  showActions?: boolean;
  onPay?: (customerName: string) => void;
  onView?: (customerName: string) => void;
  onDelete?: (customerName: string) => void;
}

export function CustomerWiseSummary({
  sales,
  title = "Customer-wise Summary",
  exportFilePrefix = "Customer_Summary",
  showActions = false,
  onPay,
  onView,
  onDelete,
}: CustomerWiseSummaryProps) {
  const customerSummary = useMemo(
    () => buildCustomerSummaryFromSales(sales),
    [sales]
  );

  const handleExport = (format: "excel" | "word") => {
    if (customerSummary.length === 0) {
      toast({
        title: "No data",
        description: "No customer summary data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Customer",
      "Sales",
      "Total Amount",
      "Total Pay",
      "Remaining",
      "Total Weight (kg)",
      "Total Units",
      "By Type (Paid)",
      "By Type (Weight)",
    ];

    const rows = customerSummary.map((row) => {
      const typePaid = row.qualityPaid
        ? Object.entries(row.qualityPaid)
            .filter(([, amt]) => (amt || 0) > 0)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([k, v]) => `${k}: Rs. ${formatCurrency(Number(v) || 0)}`)
            .join(" | ")
        : "";
      const typeWeight = row.qualityWeight
        ? Object.entries(row.qualityWeight)
            .filter(([, w]) => (w || 0) > 0)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([k, v]) => `${k}: ${Number(v).toLocaleString()} kg`)
            .join(" | ")
        : "";
      return {
        Customer: row.customerName,
        Sales: row.sales,
        "Total Amount": row.totalAmount,
        "Total Pay": row.amountPaid,
        Remaining: row.remainingAmount,
        "Total Weight (kg)": row.weight,
        "Total Units": row.units,
        "By Type (Paid)": typePaid,
        "By Type (Weight)": typeWeight,
      };
    });

    const rangeText = toYmd(new Date());
    if (format === "excel") {
      exportAsCsv(`${exportFilePrefix}_${rangeText}.csv`, headers, rows);
    } else {
      exportAsWordTable(
        `${exportFilePrefix}_${rangeText}.doc`,
        title,
        headers,
        rows
      );
    }
    toast({
      title: "Export complete",
      description: `${rows.length} customers exported.`,
    });
  };

  if (customerSummary.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {title}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport("excel")}
            className="px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport("word")}
            className="px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            Word
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {customerSummary.map((row) => (
          <div
            key={row.customerName}
            className="bg-cms-card rounded-lg p-4 border border-border"
          >
            <div
              className="font-medium text-foreground mb-3 truncate"
              title={row.customerName}
            >
              {row.customerName}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sales</span>
                <span className="font-medium text-foreground">{row.sales}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold text-foreground">
                  Rs. {formatCurrency(row.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Pay</span>
                <span className="font-semibold text-green-600">
                  Rs. {formatCurrency(row.amountPaid)}
                </span>
              </div>
              {row.qualityPaid && Object.keys(row.qualityPaid).length > 0 && (
                <div className="pt-0.5 pl-1">
                  <span className="text-xs text-muted-foreground block mb-0.5">
                    By type:
                  </span>
                  <div className="space-y-0.5">
                    {Object.entries(row.qualityPaid)
                      .filter(([, amt]) => amt > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([q, amt]) => (
                        <div
                          key={q}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="text-foreground">{q}</span>
                          <span className="font-medium text-green-600">
                            Rs. {formatCurrency(amt)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining</span>
                <span
                  className={`font-semibold ${
                    row.remainingAmount > 0 ? "text-red-600" : "text-muted-foreground"
                  }`}
                >
                  Rs. {formatCurrency(row.remainingAmount)}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-xs text-muted-foreground block mb-1">
                  Quality (weight):
                </span>
                {row.qualityWeight && Object.keys(row.qualityWeight).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(row.qualityWeight)
                      .sort((a, b) => b[1] - a[1])
                      .map(([q, w]) => (
                        <div
                          key={q}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="font-medium text-foreground">{q}</span>
                          <span className="font-semibold text-primary">
                            {Number(w).toLocaleString()} kg
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <span className="text-xs text-foreground">—</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground shrink-0">Color:</span>
                {row.colors.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.colors.map((hex) => (
                      <span key={hex} className="inline-flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-full border border-border shrink-0"
                          style={{ backgroundColor: hex }}
                          title={getColorNameFromHex(hex)}
                        />
                        <span className="text-xs text-foreground">
                          {getColorNameFromHex(hex)}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-foreground">—</span>
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                <span>{row.weight} kg</span>
                <span>{row.units} units</span>
              </div>
              {showActions && (onPay || onView || onDelete) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {onPay && (
                    <button
                      type="button"
                      onClick={() => onPay(row.customerName)}
                      disabled={row.remainingAmount <= 0}
                      className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      Pay
                    </button>
                  )}
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(row.customerName)}
                      className="flex-1 px-3 py-1.5 bg-cms-card hover:bg-cms-card-hover border border-border rounded-md text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      View
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(row.customerName)}
                      className="px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive rounded-md text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
