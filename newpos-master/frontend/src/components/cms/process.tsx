import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Factory, 
  Package, 
  Scale, 
  Filter, 
  Thermometer, 
  Timer, 
  Zap, 
  Droplets, 
  CheckCircle, 
  X, 
  Plus, 
  Search, 
  Eye, 
  History, 
  TrendingUp, 
  AlertCircle,
  ChevronDown,
  Calendar,
  Clock,
  Printer,
  Download,
  Upload,
  RotateCw,
  PackageOpen,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Settings,
  Users,
  User,
  Pencil,
  Trash2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { exportAsCsv, exportAsWordTable, exportAsExcelTable, exportAsPdf, inDateRange, toYmd } from "@/lib/exportUtils";
import {
  PRODUCT_CODES,
  getProductCodeLabel,
  resolveProductCode,
  getBagSizeForCode,
  getProductByCode,
  calcPopWeightFromBags,
  getMaxBagsFromAvailableKg,
  getPopLinePricingFromPurchase,
} from "@/lib/productCodes";
import {
  computeProcessQueueCosts,
  getPricePerKgFromPop,
  getProductionDisplayCost,
} from "@/lib/productionCost";

function normCodeStrict(code?: string): string {
  const c = String(code || "").trim();
  return getProductByCode(c) ? c : "";
}

type PopAvailableLine = {
  lineIndex: number;
  productCode: string;
  materialName: string;
  availableKg: number;
  pricePerKg?: number;
};

function buildPopAvailableLines(
  pop: {
    materials?: Array<{
      name?: string;
      weight?: number | string;
      pricePerKg?: number | string;
      totalAmount?: number | string;
      productCode?: string;
      productionConsumedWeight?: number | string;
    }>;
    weight?: number | string;
    materialName?: string;
    productionConsumedWeight?: number | string;
    codeConsumption?: Record<string, number>;
  },
  fallbackName?: string
): PopAvailableLine[] {
  const mats = pop.materials || [];
  if (mats.length > 0) {
    return mats
      .map((m, idx) => {
        const w = parseFloat(String(m.weight)) || 0;
        const c = parseFloat(String(m.productionConsumedWeight)) || 0;
        const availableKg = Math.max(0, Math.round((w - c) * 10) / 10);
        const code = normCodeStrict(m.productCode);
        if (!code || availableKg <= 0) return null;
        const pricePerKg = parseFloat(String(m.pricePerKg)) || 0;
        const totalAmount = parseFloat(String(m.totalAmount)) || 0;
        return {
          lineIndex: idx,
          productCode: code,
          materialName: String(m.name || "").trim() || fallbackName || "Unknown",
          availableKg,
          pricePerKg:
            pricePerKg > 0
              ? pricePerKg
              : w > 0 && totalAmount > 0
                ? Math.round((totalAmount / w) * 100) / 100
                : undefined,
        };
      })
      .filter((line): line is PopAvailableLine => line != null);
  }

  const originalWeight = parseFloat(String(pop.weight)) || 0;
  const consumed = parseFloat(String(pop.productionConsumedWeight)) || 0;
  const availableKg = Math.max(0, Math.round((originalWeight - consumed) * 10) / 10);
  if (availableKg <= 0) return [];

  const cc = pop.codeConsumption || {};
  const codeFromCc = Object.keys(cc).find((k) => normCodeStrict(k));
  const code = normCodeStrict(codeFromCc) || PRODUCT_CODES[0]?.code || "100";
  return [
    {
      lineIndex: 0,
      productCode: code,
      materialName: String(pop.materialName || fallbackName || "Unknown"),
      availableKg,
    },
  ];
}

// Relative paths — api client uses Vite proxy + CMS auth headers
const PROCESSING_API_URL = "/api/processing";
const PURCHASES_API_URL = "/api/purchases";
const EMPLOYEE_API_URL = "/api/employees";

// Local date as YYYY-MM-DD (avoids timezone shifting e.g. 13 Feb becoming 12 Feb)
const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDateLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Color options (POP se match karein)
const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Blue", color: "bg-blue-600", value: "#2563EB" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
  { name: "Black", color: "bg-black", value: "#000000" },
  { name: "Pink", color: "bg-pink-500", value: "#EC4899" },
  { name: "Purple", color: "bg-purple-500", value: "#A855F7" },
  { name: "Gray", color: "bg-gray-500", value: "#6B7280" },
  { name: "Brown", color: "bg-amber-900", value: "#92400E" },
];

interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  title: string;
  department: string;
  phone: string;
  email?: string;
}

interface ProcessingMaterial {
  _id: string;
  purchaseId: string;
  receiptNo: string;
  materialName: string;
  quality: string;
  color: string;
  originalWeight: number;
  availableWeight: number;
  vendor: string;
  purchaseDate: string;
  purchasePrice?: number;
  pricePerKg?: number;
  productCode?: string;
  /** POP materials[] index — deduction only on this line */
  materialLineIndex?: number;
  /** Aggregated by product code across all POP invoices */
  consumeByCode?: boolean;
  receiptCount?: number;
  lines?: ProcessingMaterial[];
  status: 'pending' | 'in_progress' | 'processed' | 'on_hold';
  batchNo?: string;
}

interface ProcessingStage {
  _id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  temperature?: number; // in Celsius
  pressure?: number; // in PSI
  powerConsumption?: number; // in kWh
  waterUsage?: number; // in liters
  sequence: number;
}

interface ProcessingBatch {
  _id: string;
  batchNo: string;
  materialId: string;
  materialName: string;
  quality: string;
  color: string;
  inputWeight: number;
  totalBags: number;
  bagWeight: number;
  expectedOutput: number;
  actualOutput?: number;
  wastePercentage?: number;
  stages: Array<{
    stageId: string;
    stageName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    operator?: string;
    notes?: string;
  }>;
  employees: Employee[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'on_hold';
  startTime?: string;
  endTime?: string;
  qualityCheck?: {
    passed: boolean;
    inspector: string;
    notes: string;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProductionData {
  _id: string;
  batchId: string;
  batchNo: string;
  materialName: string;
  quality: string;
  color: string;
  outputWeight: number;
  availableWeight?: number;
  wasteWeight: number;
  efficiency: number;
  productionDate: string;
  operator: string;
  shift: 'morning' | 'evening' | 'night';
  machineUsed: string;
  energyConsumed: number;
  waterUsed: number;
  status: 'completed' | 'partial' | 'failed';
  notes?: string;
  totalBags?: number;
  bagWeight?: number;
  weightUsedFromPOP?: number;
  productCode?: string;
  wasteCost?: number;
  laborCostPerKg?: number;
  materialCost?: number;
  laborCost?: number;
  totalProductionCost?: number;
  purchasePrice?: number;
  purchaseWeight?: number;
  vendor?: string;
  receiptNo?: string;
  employees?: { employeeId?: string; name?: string; department?: string }[];
}

function formatProductionEmployees(prod: ProductionData): string {
  const list = prod.employees || [];
  if (!list.length) return prod.operator || "—";
  return list.map((e) => e.name || e.employeeId || "—").filter(Boolean).join(", ");
}

// Stage configuration
const defaultStages: ProcessingStage[] = [
  {
    _id: "stage_1",
    name: "Sorting & Cleaning",
    description: "Raw material sorting and cleaning process",
    duration: 30,
    sequence: 1
  },
  {
    _id: "stage_2",
    name: "Shredding",
    description: "Material shredding into smaller pieces",
    duration: 45,
    powerConsumption: 150,
    sequence: 2
  },
  {
    _id: "stage_3",
    name: "Washing",
    description: "Thorough washing with detergent",
    duration: 60,
    waterUsage: 500,
    sequence: 3
  },
  {
    _id: "stage_4",
    name: "Drying",
    description: "High-temperature drying process",
    duration: 120,
    temperature: 80,
    sequence: 4
  },
  {
    _id: "stage_5",
    name: "Melting & Extrusion",
    description: "Melting and extrusion into pellets",
    duration: 90,
    temperature: 200,
    pressure: 150,
    powerConsumption: 300,
    sequence: 5
  },
  {
    _id: "stage_6",
    name: "Cooling & Cutting",
    description: "Cooling and cutting into final pellets",
    duration: 45,
    sequence: 6
  },
  {
    _id: "stage_7",
    name: "Quality Check",
    description: "Final quality inspection",
    duration: 30,
    sequence: 7
  },
  {
    _id: "stage_8",
    name: "Packaging",
    description: "Packaging for storage/shipment",
    duration: 30,
    sequence: 8
  }
];

// Available machines
const machines = [
  { id: "machine_1", name: "Shredder X-100", status: "available", capacity: 500 },
  { id: "machine_2", name: "Washer Pro", status: "available", capacity: 300 },
  { id: "machine_3", name: "Dryer Master", status: "maintenance", capacity: 400 },
  { id: "machine_4", name: "Extruder Elite", status: "available", capacity: 200 },
  { id: "machine_5", name: "Cutter Max", status: "available", capacity: 600 },
];

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' };
      case 'in_progress':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' };
      case 'processed':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Processed' };
      case 'on_hold':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'On Hold' };
      case 'completed':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' };
      case 'failed':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' };
      case 'available':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Available' };
      case 'maintenance':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Maintenance' };
      case 'active':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' };
      case 'off':
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Off' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 text-xs ${config.bg} ${config.text} rounded-full`}>
      {config.label}
    </span>
  );
};

// Processing Dashboard Summary
const ProcessingDashboard = ({ 
  materials, 
  batches, 
  productionData 
}: { 
  materials: ProcessingMaterial[], 
  batches: ProcessingBatch[], 
  productionData: ProductionData[] 
}) => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  
  const calculateMetrics = () => {
    const pendingMaterials = materials.filter(m => m.status === 'pending').length;
    const inProgressBatches = batches.filter(b => b.status === 'processing').length;
    const completedToday = productionData.filter(p => {
      const today = new Date().toDateString();
      return new Date(p.productionDate).toDateString() === today;
    }).length;
    
    const totalInput = materials.reduce((sum, m) => sum + m.originalWeight, 0);
    const totalOutput = productionData.reduce((sum, p) => sum + p.outputWeight, 0);
    const efficiency = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
    
    const recentProduction = productionData.slice(0, 5);
    
    return {
      pendingMaterials,
      inProgressBatches,
      completedToday,
      totalInput,
      totalOutput,
      efficiency,
      recentProduction
    };
  };
  
  const metrics = calculateMetrics();
  
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Materials</p>
              <p className="text-2xl font-semibold text-foreground">{metrics.pendingMaterials}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-yellow-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Materials in Progress</p>
              <p className="text-2xl font-semibold text-foreground">{metrics.inProgressBatches}</p>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Factory className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today's Output</p>
              <p className="text-2xl font-semibold text-foreground">{metrics.completedToday}</p>
            </div>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </div>
        </div>
        
        <div className="bg-cms-card rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Efficiency</p>
              <p className="text-2xl font-semibold text-foreground">
                {metrics.efficiency.toFixed(1)}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      metrics.efficiency >= 90 ? 'bg-green-500' :
                      metrics.efficiency >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, metrics.efficiency)}%` }}
                  />
                </div>
                <TrendingUp className={`w-4 h-4 ${
                  metrics.efficiency >= 90 ? 'text-green-500' :
                  metrics.efficiency >= 75 ? 'text-yellow-500' : 'text-red-500'
                }`} />
              </div>
            </div>
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Production Pipeline */}
      <div className="bg-cms-card rounded-lg p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Factory className="w-5 h-5 text-primary" />
              Production Pipeline
            </h3>
            <p className="text-sm text-muted-foreground">Real-time processing status</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === 'today' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-cms-card-hover text-muted-foreground'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === 'week' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-cms-card-hover text-muted-foreground'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1 text-xs rounded-md ${
                timeRange === 'month' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-cms-card-hover text-muted-foreground'
              }`}
            >
              This Month
            </button>
          </div>
        </div>
        
        {/* Processing Stages Visualization */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-sm font-medium text-foreground">Processing Stages</h4>
            <div className="text-xs text-muted-foreground">
              {batches.filter(b => b.status === 'processing').length} active materials
            </div>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {defaultStages.map((stage, index) => {
              const activeBatches = batches.filter(b => 
                b.status === 'processing' && 
                b.stages.some(s => s.stageId === stage._id && s.status === 'in_progress')
              ).length;
              
              return (
                <div key={stage._id} className="text-center">
                  <div className={`relative h-16 rounded-lg border flex items-center justify-center ${
                    activeBatches > 0 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-cms-card-hover border-border'
                  }`}>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
                        <span className="text-xs font-semibold text-foreground">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      {activeBatches > 0 && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mx-auto mb-1">
                          {activeBatches}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">{stage.name}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Recent Production */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-4">Recent Production</h4>
          <div className="space-y-3">
            {metrics.recentProduction.length > 0 ? (
              metrics.recentProduction.map((prod) => (
                <div key={prod._id} className="flex items-center justify-between p-3 bg-cms-card-hover rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <PackageOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {prod.batchNo} - {prod.materialName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {prod.quality} • {prod.color}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">
                      {prod.outputWeight} kg
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(prod.productionDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No recent production data
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: get color name from hex for display
const getColorName = (hex: string) => {
  const c = colorOptions.find(o => o.value.toLowerCase() === (hex || "").toLowerCase());
  return c ? c.name : (hex || "Unknown");
};

// Processing Queue Component - grouped by quality + color, with quality/color filters and section total weight
const ProcessingQueue = ({
  materials,
  onStartProcessing,
  onStartProcess,
}: {
  materials: ProcessingMaterial[];
  onStartProcessing: (material: ProcessingMaterial) => void;
  onStartProcess?: (material: ProcessingMaterial, groupTotalWeight?: number, groupMaterials?: ProcessingMaterial[]) => void;
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<ProcessingMaterial | null>(null);
  const [detailsGroupItems, setDetailsGroupItems] = useState<ProcessingMaterial[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'weight' | 'name' | 'code'>('code');
  
  const filteredMaterials = materials
    .filter(material => {
      if ((material.availableWeight ?? 0) <= 0) return false;
      if (filterStatus !== 'all' && material.status !== filterStatus) return false;
      if (filterQuality !== 'all' && material.quality !== filterQuality) return false;
      if (filterColor !== 'all' && (material.color || '#FFFFFF') !== filterColor) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        case 'weight':
          return b.availableWeight - a.availableWeight;
        case 'name':
          return a.materialName.localeCompare(b.materialName);
        case 'code':
          return (a.productCode || '').localeCompare(b.productCode || '');
        default:
          return 0;
      }
    });
  
  const pendingMaterials = materials.filter(m => m.status === 'pending');
  const uniqueQualities = Array.from(new Set(materials.map(m => m.quality).filter(Boolean))).sort();
  const uniqueColors = Array.from(new Set(materials.map(m => m.color || '#FFFFFF')));

  type GroupKey = string;
  const groups = filteredMaterials.reduce<Record<GroupKey, ProcessingMaterial[]>>((acc, m) => {
    const key = m.productCode && m.productCode !== '—' ? m.productCode : `other|${m.quality}|${m.color || '#FFFFFF'}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<GroupKey, ProcessingMaterial[]>);
  const groupEntries = Object.entries(groups) as [string, ProcessingMaterial[]][];
  
  return (
    <div className="bg-cms-card rounded-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Processing Queue
          </h3>
          <p className="text-sm text-muted-foreground">
            {pendingMaterials.length} materials pending processing
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="processed">Processed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Quality:</span>
            <select
              value={filterQuality}
              onChange={(e) => setFilterQuality(e.target.value)}
              className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All</option>
              {uniqueQualities.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            <select
              value={filterColor}
              onChange={(e) => setFilterColor(e.target.value)}
              className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All</option>
              {uniqueColors.map(hex => (
                <option key={hex} value={hex}>{getColorName(hex)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="code">Product Code</option>
              <option value="date">Purchase Date</option>
              <option value="weight">Weight</option>
              <option value="name">Material Name</option>
            </select>
          </div>
        </div>
      </div>
      
      {groupEntries.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No materials found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupEntries.map(([groupKey, groupMaterials]) => {
            const items = Array.isArray(groupMaterials) ? groupMaterials : [];
            const first = items[0];
            if (!first) return null;
            // Expand nested lines if any aggregated row slipped in
            const invoiceLines = items
              .flatMap((m) =>
                m.lines && m.lines.length > 0 ? m.lines : [m]
              )
              .filter((m) => (m.availableWeight ?? 0) > 0)
              .sort(
                (a, b) =>
                  new Date(a.purchaseDate || 0).getTime() -
                  new Date(b.purchaseDate || 0).getTime()
              );
            const quality = first.quality;
            const colorHex = first.color || '#FFFFFF';
            const colorName = getColorName(colorHex);
            const totalWeightKg = invoiceLines.reduce(
              (sum, m) => sum + (m.availableWeight || 0),
              0
            );
            const displayCode = first.productCode && first.productCode !== '—' ? first.productCode : null;
            const codeLabel = displayCode ? getProductCodeLabel(displayCode) : null;
            const uniqueReceipts = new Set(
              invoiceLines.map((m) => m.receiptNo || m.purchaseId)
            ).size;
            return (
              <div
                key={groupKey}
                className="rounded-lg border border-border bg-cms-card-hover hover:border-primary transition-colors p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="w-6 h-6 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: colorHex }}
                      title={colorName}
                    />
                    <div className="min-w-0">
                      <div className="text-2xl font-bold text-primary tracking-wide">
                        {displayCode ? `Code ${displayCode}` : "No code"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        Quality: {quality} • {colorName} color
                        {uniqueReceipts > 0
                          ? ` • ${uniqueReceipts} pending invoice${uniqueReceipts > 1 ? "s" : ""}`
                          : ""}
                      </div>
                      {codeLabel && displayCode && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sab pending invoices ka total — process par FIFO (purani pehle)
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Scale className="w-3.5 h-3.5" />
                          <span className="font-semibold text-primary">
                            Total weight: {Math.round(totalWeightKg * 10) / 10} kg
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  {onStartProcess && invoiceLines.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedMaterial(invoiceLines[0]);
                          setDetailsGroupItems(invoiceLines);
                          setShowDetails(true);
                        }}
                        className="p-2 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="View invoices"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const groupTotalKg = invoiceLines.reduce(
                            (sum, item) => sum + (item.availableWeight || 0),
                            0
                          );
                          onStartProcess(invoiceLines[0], groupTotalKg, invoiceLines);
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Start Process
                      </button>
                    </div>
                  )}
                </div>

                {/* Pending invoices under this code (fully processed hide — availableWeight > 0 only) */}
                {invoiceLines.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Pending POP invoices (oldest first)
                    </p>
                    <div className="space-y-1.5">
                      {invoiceLines.map((inv, idx) => (
                        <div
                          key={inv._id || `${inv.purchaseId}-${inv.materialLineIndex}-${idx}`}
                          className="flex items-center justify-between gap-3 text-sm px-2.5 py-1.5 rounded-md bg-background/60 border border-border/50"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-muted-foreground w-5 shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {inv.receiptNo || "Receipt"}
                                {inv.materialName ? (
                                  <span className="text-muted-foreground font-normal">
                                    {" "}
                                    · {inv.materialName}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {inv.vendor && inv.vendor !== "Unknown" ? `${inv.vendor} · ` : ""}
                                {inv.purchaseDate
                                  ? new Date(inv.purchaseDate).toLocaleDateString()
                                  : ""}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-primary">
                              {inv.availableWeight} kg
                            </div>
                            {inv.pricePerKg != null && inv.pricePerKg > 0 && (
                              <div className="text-[10px] text-muted-foreground">
                                Rs. {inv.pricePerKg}/kg
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Material Details Modal */}
      {showDetails && selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-2xl">
            <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Material Details</p>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                {selectedMaterial.productCode && selectedMaterial.productCode !== '—' && (
                  <p className="text-2xl font-bold text-primary mb-1">Code {selectedMaterial.productCode}</p>
                )}
                <h2 className="text-lg font-semibold text-foreground">
                  {(detailsGroupItems.length > 0 ? detailsGroupItems : [selectedMaterial])
                    .map((m) => m.materialName)
                    .filter((n, i, arr) => arr.indexOf(n) === i)
                    .join(" · ")}
                </h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <StatusBadge status={selectedMaterial.status} />
                  <span>
                    Total available:{" "}
                    <strong className="text-foreground">
                      {(detailsGroupItems.length > 0 ? detailsGroupItems : [selectedMaterial]).reduce(
                        (s, m) => s + (m.availableWeight || 0),
                        0
                      )}{" "}
                      kg
                    </strong>
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Material Information</h3>
                  <div className="space-y-3">
                    {detailsGroupItems.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">Pending invoices (FIFO)</div>
                        <ul className="text-sm text-foreground space-y-1 mt-1">
                          {detailsGroupItems
                            .flatMap((m) =>
                              m.lines && m.lines.length > 0 ? m.lines : [m]
                            )
                            .filter((m) => (m.availableWeight ?? 0) > 0)
                            .sort(
                              (a, b) =>
                                new Date(a.purchaseDate || 0).getTime() -
                                new Date(b.purchaseDate || 0).getTime()
                            )
                            .map((m, idx) => (
                              <li
                                key={m._id || `${m.purchaseId}-${idx}`}
                                className="flex justify-between gap-2 border-b border-border/40 pb-1"
                              >
                                <span>
                                  <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                                  {m.receiptNo || "Receipt"}
                                  {m.materialName ? ` · ${m.materialName}` : ""}
                                </span>
                                <span className="font-medium text-primary shrink-0">
                                  {m.availableWeight} kg
                                  {m.pricePerKg != null && m.pricePerKg > 0
                                    ? ` @ Rs. ${m.pricePerKg}`
                                    : ""}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-muted-foreground">Quality</div>
                      <div className="text-sm text-foreground">{selectedMaterial.quality}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Color</div>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: selectedMaterial.color }}
                        />
                        <span className="text-sm text-foreground">{selectedMaterial.color}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Vendor</div>
                      <div className="text-sm text-foreground">{selectedMaterial.vendor}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Weight Information</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Original Weight</div>
                      <div className="text-lg font-semibold text-foreground">
                        {selectedMaterial.originalWeight} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Available for Processing</div>
                      <div className="text-lg font-semibold text-primary">
                        {selectedMaterial.availableWeight} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Purchase Date</div>
                      <div className="text-sm text-foreground">
                        {new Date(selectedMaterial.purchaseDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Start Processing Modal
const StartProcessingModal = ({
  open,
  onClose,
  material,
  onStartBatch
}: {
  open: boolean;
  onClose: () => void;
  material: ProcessingMaterial | null;
  onStartBatch: (batchData: any) => void;
}) => {
  const [totalWeight, setTotalWeight] = useState<string>("");
  const [totalBags, setTotalBags] = useState<string>("");
  const [bagWeight, setBagWeight] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening' | 'night'>('morning');
  const [productionDate, setProductionDate] = useState<string>(() => getLocalDateString());
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [customStages, setCustomStages] = useState<ProcessingStage[]>(defaultStages);
  
  useEffect(() => {
    if (open && material) {
      // User will enter custom total weight (don't prefill from POP)
      setTotalWeight("");
      setSelectedMachine(machines[0]?.id || "");
      setSelectedColor(material.color || "#FFFFFF");
      setProductionDate(getLocalDateString());
      fetchEmployees();
      
      // Reset bags when opening modal
      setTotalBags("");
      setBagWeight("");
    }
  }, [open, material]);
  
  useEffect(() => {
    // Auto-calculate bag weight when total weight or bags change
    if (totalWeight && totalBags) {
      const weight = parseFloat(totalWeight);
      const bags = parseInt(totalBags);
      if (weight > 0 && bags > 0) {
        setBagWeight((weight / bags).toFixed(1));
      }
    }
  }, [totalWeight, totalBags]);
  
  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await api.get(`${EMPLOYEE_API_URL}/get-all`);
      
      if (response.data.success) {
        const employeesData = response.data.data || [];
        const activeEmployees = employeesData
          .filter((emp: any) => emp.isActive !== false)
          .map((emp: any) => ({
            _id: emp._id,
            employeeId: emp.employeeId,
            name: emp.name,
            title: emp.title,
            department: emp.department,
            phone: emp.phone,
            email: emp.email
          }));
        setEmployees(activeEmployees);
      }
    } catch (error: any) {
      console.error("Failed to fetch employees:", error);
      toast({
        title: "Error",
        description: "Failed to load employees list",
        variant: "destructive",
      });
    } finally {
      setLoadingEmployees(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!material) return;
    
    const weight = parseFloat(totalWeight);
    const bags = parseInt(totalBags);
    
    if (isNaN(weight) || weight <= 0 || weight > material.availableWeight) {
      toast({
        title: "Error",
        description: `Please enter valid weight (max: ${material.availableWeight} kg)`,
        variant: "destructive",
      });
      return;
    }
    
    if (isNaN(bags) || bags <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid number of bags",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedColor) {
      toast({
        title: "Error",
        description: "Please select a color",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedEmployees.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one employee",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedMachine) {
      toast({
        title: "Error",
        description: "Please select a machine",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const batchNo = `BATCH-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const selectedEmployeeObjects = employees.filter(emp => selectedEmployees.includes(emp._id));
      
      const batchData = {
        batchNo,
        materialId: material._id,
        materialName: material.materialName,
        quality: material.quality,
        color: selectedColor,
        inputWeight: weight,
        totalBags: bags,
        bagWeight: parseFloat(bagWeight),
        expectedOutput: weight * 0.9, // 90% efficiency default
        stages: customStages.map(stage => ({
          stageId: stage._id,
          stageName: stage.name,
          status: 'pending',
          sequence: stage.sequence
        })),
        employees: selectedEmployeeObjects,
        status: 'pending',
        machineId: selectedMachine,
        shift: selectedShift,
        productionDate,
        notes,
        startTime: new Date().toISOString()
      };
      
      // Save to API
      const response = await api.post(`${PROCESSING_API_URL}/batches`, batchData);
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: `Processing batch ${batchNo} started!`,
        });
        
        // Update material status
        await api.put(`${PROCESSING_API_URL}/materials/${material._id}`, {
          status: 'in_progress',
          availableWeight: material.availableWeight - weight
        });
        
        onStartBatch(batchData);
        onClose();
        
        // Reset form
        setSelectedEmployees([]);
        setNotes("");
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || "Failed to start processing";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };
  
  if (!open || !material) return null;
  
  const machine = machines.find(m => m.id === selectedMachine);
  const selectedColorObj = colorOptions.find(c => c.value === selectedColor) || colorOptions[0];
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Start Processing</p>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Start New Processing Batch</h2>
            <p className="text-sm text-muted-foreground">
              Material: {material.materialName} ({material.quality})
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column - Material Info */}
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Material Information</h3>
              <div className="space-y-4">
                <div className="bg-cms-card-hover rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Material</div>
                      <div className="text-lg font-semibold text-foreground">{material.materialName}</div>
                    </div>
                    <div 
                      className="w-8 h-8 rounded-full border border-border"
                      style={{ backgroundColor: material.color }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Quality</div>
                      <div className="text-sm text-foreground">{material.quality}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Receipt No.</div>
                      <div className="text-sm text-foreground">{material.receiptNo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Vendor</div>
                      <div className="text-sm text-foreground">{material.vendor}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Available Weight</div>
                      <div className="text-sm font-semibold text-primary">{material.availableWeight} kg</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Total Weight (kg) *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    max={material.availableWeight}
                    value={totalWeight}
                    onChange={(e) => setTotalWeight(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum available: {material.availableWeight} kg
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Production Date *</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Total Bags *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={totalBags}
                    onChange={(e) => setTotalBags(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated weight per bag: {bagWeight} kg
                  </p>
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">Select Color *</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {colorOptions.map((color) => (
                      <label key={color.value} className="flex items-center gap-1.5 cursor-pointer">
                        <div className="relative flex items-center">
                          <input
                            type="radio"
                            name="materialColor"
                            value={color.value}
                            checked={selectedColor === color.value}
                            onChange={() => setSelectedColor(color.value)}
                            className="sr-only"
                          />
                          <div 
                            className={`w-5 h-5 rounded-full ${color.color} border-2 ${
                              selectedColor === color.value 
                                ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' 
                                : 'border-border'
                            }`} 
                          />
                        </div>
                        <span className="text-xs text-foreground">{color.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Column - Processing Settings */}
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Processing Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Machine *</label>
                  <select
                    value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Machine</option>
                    {machines.filter(m => m.status === 'available').map(machine => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} ({machine.capacity} kg capacity)
                      </option>
                    ))}
                  </select>
                  {machine && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-700">Selected:</span>
                        <span className="text-sm font-semibold text-blue-800">{machine.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-blue-600">
                        Capacity: {machine.capacity} kg • Status: <StatusBadge status={machine.status} />
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Shift *</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as any)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="morning">Morning (6AM - 2PM)</option>
                    <option value="evening">Evening (2PM - 10PM)</option>
                    <option value="night">Night (10PM - 6AM)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Select Employees *</label>
                  {loadingEmployees ? (
                    <div className="flex items-center justify-center py-4">
                      <RotateCw className="w-4 h-4 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Loading employees...</span>
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No employees found. Please add employees first.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-cms-card-hover rounded-md border border-border">
                      {employees.map(employee => (
                        <label key={employee._id} className="flex items-center gap-3 p-2 hover:bg-cms-card rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(employee._id)}
                            onChange={() => handleEmployeeToggle(employee._id)}
                            className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                          />
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.department} • {employee.employeeId}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedEmployees.length > 0 && (
                    <div className="mt-2 text-xs text-green-600">
                      {selectedEmployees.length} employee(s) selected
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Notes (Optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any special instructions or notes..."
                    rows={3}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Processing Stages */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Processing Stages</h3>
            <div className="bg-cms-card-hover rounded-lg border border-border p-4">
              <div className="grid grid-cols-8 gap-2 mb-4">
                {customStages.map((stage) => (
                  <div key={stage._id} className="text-center">
                    <div className="h-12 rounded-lg bg-cms-card border border-border flex items-center justify-center">
                      <div className="text-xs text-foreground font-medium">{stage.sequence}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">{stage.name}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Total Estimated Time: {customStages.reduce((sum, stage) => sum + stage.duration, 0)} minutes
              </div>
            </div>
          </div>
          
          {/* Summary Card */}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">Batch Summary</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-blue-700">Material</div>
                <div className="text-sm font-medium text-foreground">{material.materialName}</div>
              </div>
              <div>
                <div className="text-xs text-blue-700">Total Weight</div>
                <div className="text-sm font-semibold text-blue-800">{totalWeight} kg</div>
              </div>
              <div>
                <div className="text-xs text-blue-700">Total Bags</div>
                <div className="text-sm font-semibold text-blue-800">{totalBags} bags</div>
              </div>
              <div>
                <div className="text-xs text-blue-700">Per Bag Weight</div>
                <div className="text-sm font-semibold text-blue-800">{bagWeight} kg/bag</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: selectedColor }}
              />
              <span className="text-xs text-blue-700">Color: {selectedColorObj.name}</span>
              <span className="mx-2">•</span>
              <span className="text-xs text-blue-700">Employees: {selectedEmployees.length}</span>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !totalWeight || !totalBags || !selectedColor || selectedEmployees.length === 0}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  Start Processing
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Start Process Form Modal (same GUI as old production form; optional initialMaterial pre-fills material name from queue row)
const StartProcessFormModal = ({
  open,
  onClose,
  onSaved,
  initialMaterial,
  purchaseId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialMaterial?: {
    materialName: string;
    quality?: string;
    popAvailableWeight?: number;
    color?: string;
    receiptNo?: string;
    vendor?: string;
    purchasePrice?: number;
    purchaseWeight?: number;
    productCode?: string;
    materialLineIndex?: number;
    /** Code-wise process: total stock across all POP invoices */
    consumeByCode?: boolean;
    pricePerKg?: number;
    materialOptions?: {
      materialName: string;
      purchaseId: string;
      receiptNo?: string;
      productCode?: string;
      materialLineIndex?: number;
      availableWeight?: number;
      pricePerKg?: number;
      purchaseDate?: string;
    }[];
  } | null;
  purchaseId?: string | null;
}) => {
  const [materialName, setMaterialName] = useState("");
  const [quality, setQuality] = useState("Standard");
  const [selectedMachine, setSelectedMachine] = useState(machines[0]?.id || "");
  const [totalBags, setTotalBags] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [weightUsedFromPOP, setWeightUsedFromPOP] = useState("");
  const [machineOutputWeight, setMachineOutputWeight] = useState("");
  const [productionDate, setProductionDate] = useState(() => getLocalDateString());
  const [selectedColor, setSelectedColor] = useState("#FFFFFF");
  const [selectedShift, setSelectedShift] = useState<"morning" | "evening" | "night">("morning");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productCode, setProductCode] = useState(PRODUCT_CODES[0]?.code || "");
  const [wasteWeight, setWasteWeight] = useState("");
  const [wasteCost, setWasteCost] = useState("");
  const [laborCostPerKg, setLaborCostPerKg] = useState("");
  const [popPricing, setPopPricing] = useState<{ price: number; weight: number } | null>(null);
  const [popAvailableLines, setPopAvailableLines] = useState<PopAvailableLine[]>([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(purchaseId ?? null);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | undefined>(
    initialMaterial?.materialLineIndex
  );
  /** User manually edited POP kg — bags change par dubara formula se bharega */
  const popWeightManualRef = useRef(false);

  const consumeByCode =
    initialMaterial?.consumeByCode === true ||
    (initialMaterial?.materialOptions?.length ?? 0) > 0 ||
    !!(initialMaterial?.productCode && (initialMaterial?.popAvailableWeight ?? 0) > 0);

  const groupAvailableWeight = useMemo(() => {
    if (initialMaterial?.popAvailableWeight != null && initialMaterial.popAvailableWeight > 0) {
      return initialMaterial.popAvailableWeight;
    }
    if (initialMaterial?.materialOptions?.length) {
      return initialMaterial.materialOptions.reduce(
        (sum, line) => sum + (line.availableWeight ?? 0),
        0
      );
    }
    return 0;
  }, [initialMaterial]);

  /** Weighted avg pricing across all available stock for this code (FIFO pool) */
  const codePoolPricing = useMemo(() => {
    const opts = initialMaterial?.materialOptions || [];
    if (opts.length > 0) {
      let value = 0;
      let weight = 0;
      for (const o of opts) {
        const w = o.availableWeight ?? 0;
        const rate = o.pricePerKg ?? 0;
        if (w > 0 && rate > 0) {
          value += w * rate;
          weight += w;
        }
      }
      if (weight > 0) {
        return { price: value, weight };
      }
    }
    if (
      initialMaterial?.purchasePrice != null &&
      initialMaterial.purchasePrice > 0 &&
      (initialMaterial.purchaseWeight || groupAvailableWeight) > 0
    ) {
      return {
        price: initialMaterial.purchasePrice,
        weight: initialMaterial.purchaseWeight || groupAvailableWeight,
      };
    }
    if (initialMaterial?.pricePerKg && groupAvailableWeight > 0) {
      return {
        price: initialMaterial.pricePerKg * groupAvailableWeight,
        weight: groupAvailableWeight,
      };
    }
    return null;
  }, [initialMaterial, groupAvailableWeight]);

  const popAvailableWeight = consumeByCode
    ? groupAvailableWeight
    : popAvailableLines.find((l) => l.productCode === normCodeStrict(productCode))?.availableKg ??
      initialMaterial?.popAvailableWeight ??
      0;
  const isFromQueue = !!(consumeByCode
    ? productCode && popAvailableWeight > 0
    : selectedReceiptId && popAvailableWeight > 0);

  const productCodeOptions = useMemo(() => {
    if (consumeByCode && initialMaterial?.productCode) {
      const c = normCodeStrict(initialMaterial.productCode);
      return c ? PRODUCT_CODES.filter((p) => p.code === c) : PRODUCT_CODES;
    }
    if (popAvailableLines.length > 0) {
      const codes = new Set(popAvailableLines.map((l) => l.productCode));
      return PRODUCT_CODES.filter((p) => codes.has(p.code));
    }
    if (isFromQueue && initialMaterial?.productCode) {
      const c = normCodeStrict(initialMaterial.productCode);
      return c ? PRODUCT_CODES.filter((p) => p.code === c) : PRODUCT_CODES;
    }
    return PRODUCT_CODES;
  }, [popAvailableLines, isFromQueue, initialMaterial?.productCode, consumeByCode]);

  const purchasePrice = consumeByCode
    ? codePoolPricing?.price ?? popPricing?.price ?? initialMaterial?.purchasePrice ?? 0
    : popPricing?.price ?? initialMaterial?.purchasePrice ?? 0;
  const purchaseWeight = consumeByCode
    ? codePoolPricing?.weight ?? popPricing?.weight ?? initialMaterial?.purchaseWeight ?? 0
    : popPricing?.weight ?? initialMaterial?.purchaseWeight ?? 0;

  /** Machine output = weight put in machine − waste (e.g. 50 used − 5 waste = 45 output) */
  const calcMachineOutputKg = (usedKg: number, wasteKg: number) =>
    Math.max(0, Math.round((usedKg - wasteKg) * 100) / 100);

  const pricePerKg = getPricePerKgFromPop(purchasePrice, purchaseWeight);

  useEffect(() => {
    if (!open || consumeByCode || !selectedReceiptId) {
      if (consumeByCode) {
        setPopPricing(codePoolPricing);
        setPopAvailableLines([]);
      } else if (!selectedReceiptId) {
        setPopPricing(null);
        setPopAvailableLines([]);
      }
      return;
    }
    let cancelled = false;
    api
      .get(`${PURCHASES_API_URL}/${selectedReceiptId}`)
      .then((res) => {
        if (cancelled || !res.data?.success) return;
        const pop = res.data.data;
        const lines = buildPopAvailableLines(pop, initialMaterial?.materialName);
        setPopAvailableLines(lines);
        const pricing = getPopLinePricingFromPurchase(
          pop,
          productCode,
          selectedLineIndex
        );
        setPopPricing({
          price: pricing.purchasePrice,
          weight: pricing.purchaseWeight,
        });
      })
      .catch(() => {
        setPopPricing(null);
        setPopAvailableLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    selectedReceiptId,
    productCode,
    selectedLineIndex,
    initialMaterial?.materialName,
    consumeByCode,
    codePoolPricing,
  ]);

  useEffect(() => {
    if (!open || consumeByCode || popAvailableLines.length === 0) return;
    const currentCode = normCodeStrict(productCode);
    const valid =
      popAvailableLines.find(
        (l) => l.lineIndex === selectedLineIndex && l.productCode === currentCode
      ) || popAvailableLines.find((l) => l.productCode === currentCode);
    if (valid) return;
    const first = popAvailableLines[0];
    setProductCode(first.productCode);
    setSelectedLineIndex(first.lineIndex);
    setMaterialName(first.materialName);
  }, [open, popAvailableLines, productCode, selectedLineIndex, consumeByCode]);

  useEffect(() => {
    if (!open || !isFromQueue) return;
    const used = parseFloat(String(weightUsedFromPOP).trim().replace(",", "."));
    const waste = parseFloat(String(wasteWeight).trim().replace(",", ".")) || 0;
    if (!isNaN(used) && used > 0) {
      const output = calcMachineOutputKg(used, waste);
      setMachineOutputWeight(output > 0 ? String(output) : "0");
    }
  }, [open, isFromQueue, weightUsedFromPOP, wasteWeight]);

  const bagSizeKg = getBagSizeForCode(productCode);

  const maxBagsFromPop = useMemo(() => {
    if (!isFromQueue || !bagSizeKg || popAvailableWeight <= 0) return null;
    return getMaxBagsFromAvailableKg(productCode, popAvailableWeight);
  }, [isFromQueue, bagSizeKg, popAvailableWeight, productCode]);

  const applyPopWeightFromBags = (bags: number) => {
    if (!bagSizeKg || bags <= 0) {
      setWeightUsedFromPOP("");
      return;
    }
    const cappedBags =
      maxBagsFromPop != null && bags > maxBagsFromPop ? maxBagsFromPop : bags;
    let kg = calcPopWeightFromBags(productCode, cappedBags);
    if (popAvailableWeight > 0 && kg > popAvailableWeight) {
      kg = Math.round(popAvailableWeight * 100) / 100;
    }
    setWeightUsedFromPOP(String(kg));
  };

  const handleTotalBagsChange = (raw: string) => {
    popWeightManualRef.current = false;
    if (raw === "" || raw === ".") {
      setTotalBags(raw);
      setWeightUsedFromPOP("");
      return;
    }
    const n = parseFloat(String(raw).trim().replace(",", "."));
    if (isNaN(n)) return;
    if (maxBagsFromPop != null && n > maxBagsFromPop) {
      setTotalBags(String(maxBagsFromPop));
      applyPopWeightFromBags(maxBagsFromPop);
      toast({
        title: "Bags limit",
        description: `Maximum ${maxBagsFromPop} bags (${popAvailableWeight} kg ÷ ${bagSizeKg} kg/bag). Is se zyada allowed nahi.`,
        variant: "destructive",
      });
      return;
    }
    if (n < 0) return;
    setTotalBags(raw);
  };

  const handleWeightUsedFromPOPChange = (raw: string) => {
    popWeightManualRef.current = true;
    const normalized = raw.replace(",", ".");
    if (normalized === "" || normalized === ".") {
      setWeightUsedFromPOP(raw);
      return;
    }
    const kg = parseFloat(normalized);
    if (isNaN(kg)) {
      setWeightUsedFromPOP(raw);
      return;
    }
    if (popAvailableWeight > 0 && kg > popAvailableWeight) {
      setWeightUsedFromPOP(String(popAvailableWeight));
      toast({
        title: "POP limit",
        description: `Maximum ${popAvailableWeight} kg available (Code ${productCode} total).`,
        variant: "destructive",
      });
      return;
    }
    if (kg < 0) return;
    setWeightUsedFromPOP(raw);
  };

  /** Total bags × bag size → POP weight (jab tak user manually edit na kare) */
  useEffect(() => {
    if (!open || !isFromQueue || !bagSizeKg || popWeightManualRef.current) return;
    const bags = parseFloat(String(totalBags).trim().replace(",", "."));
    if (isNaN(bags) || bags <= 0) {
      setWeightUsedFromPOP("");
      return;
    }
    applyPopWeightFromBags(bags);
  }, [open, isFromQueue, totalBags, productCode, bagSizeKg, popAvailableWeight, maxBagsFromPop]);

  const estimatedCosts = useMemo(() => {
    const usedPop = parseFloat(String(weightUsedFromPOP).trim().replace(",", ".")) || 0;
    const output = isFromQueue
      ? parseFloat(String(machineOutputWeight).trim().replace(",", ".")) || parseFloat(String(totalWeight).trim().replace(",", ".")) || 0
      : parseFloat(String(totalWeight).trim().replace(",", ".")) || 0;
    const wasteKg = parseFloat(String(wasteWeight).trim().replace(",", ".")) || 0;
    const labor = parseFloat(String(laborCostPerKg).trim().replace(",", ".")) || 0;
    if (isFromQueue && purchasePrice > 0 && purchaseWeight > 0) {
      return computeProcessQueueCosts({
        purchasePrice,
        purchaseWeight,
        weightUsedFromPOP: usedPop,
        outputWeight: output,
        wasteWeight: wasteKg,
        laborCostPerKg: labor,
      });
    }
    return computeProcessQueueCosts({
      purchasePrice,
      purchaseWeight,
      weightUsedFromPOP: usedPop,
      outputWeight: output,
      wasteWeight: wasteKg,
      laborCostPerKg: labor,
    });
  }, [
    purchasePrice,
    purchaseWeight,
    weightUsedFromPOP,
    machineOutputWeight,
    totalWeight,
    wasteWeight,
    laborCostPerKg,
    isFromQueue,
  ]);

  /** Keep waste cost field in sync with production history formula */
  useEffect(() => {
    if (!open || !isFromQueue || purchasePrice <= 0 || purchaseWeight <= 0) return;
    setWasteCost(estimatedCosts.wasteCost > 0 ? String(estimatedCosts.wasteCost) : "");
  }, [open, isFromQueue, estimatedCosts.wasteCost, purchasePrice, purchaseWeight]);

  const fetchEmployees = async () => {
    try {
      setLoadingEmployees(true);
      const response = await api.get(`${EMPLOYEE_API_URL}/get-all`);
      if (response.data.success) {
        const employeesData = response.data.data || [];
        const activeEmployees = employeesData
          .filter((emp: any) => emp.isActive !== false)
          .map((emp: any) => ({
            _id: emp._id,
            employeeId: emp.employeeId,
            name: emp.name,
            title: emp.title,
            department: emp.department,
            phone: emp.phone,
            email: emp.email,
          }));
        setEmployees(activeEmployees);
      }
    } catch (error: any) {
      console.error("Failed to fetch employees:", error);
      toast({ title: "Error", description: "Failed to load employees", variant: "destructive" });
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (open) {
      popWeightManualRef.current = false;
      setMaterialName(initialMaterial?.materialName ?? "");
      setQuality(initialMaterial?.quality ?? "Standard");
      setSelectedMachine(machines[0]?.id || "");
      setTotalBags("");
      setTotalWeight("");
      setWeightUsedFromPOP("");
      setMachineOutputWeight("");
      setWasteWeight("");
      setProductionDate(getLocalDateString());
      setSelectedColor(initialMaterial?.color || "#FFFFFF");
      setSelectedShift("morning");
      setSelectedEmployees([]);
      setProductCode(
        normCodeStrict(initialMaterial?.productCode) || PRODUCT_CODES[0]?.code || ""
      );
      setWasteCost("");
      setLaborCostPerKg("");
      setPopPricing(null);
      const fifo = initialMaterial?.materialOptions?.length
        ? [...initialMaterial.materialOptions].sort(
            (a, b) =>
              new Date(a.purchaseDate || 0).getTime() - new Date(b.purchaseDate || 0).getTime()
          )
        : [];
      const first = fifo[0];
      setSelectedReceiptId(first?.purchaseId ?? purchaseId ?? null);
      setSelectedLineIndex(first?.materialLineIndex ?? initialMaterial?.materialLineIndex);
      fetchEmployees();
    }
  }, [open, initialMaterial?.materialName, initialMaterial?.quality, initialMaterial?.popAvailableWeight, initialMaterial?.color, initialMaterial?.materialOptions, purchaseId]);

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId) ? prev.filter((id) => id !== employeeId) : [...prev, employeeId]
    );
  };

  const handleSubmit = async () => {
    const bags = parseFloat(String(totalBags).trim().replace(",", "."));
    const weightStr = isFromQueue ? String(machineOutputWeight).trim().replace(",", ".") : String(totalWeight).trim().replace(",", ".");
    const weight = parseFloat(weightStr);
    const usedFromPOP = isFromQueue
      ? parseFloat(String(weightUsedFromPOP).trim().replace(",", "."))
      : 0;
    if (!materialName.trim()) {
      toast({ title: "Error", description: "Please enter material name", variant: "destructive" });
      return;
    }
    if (isNaN(bags) || bags <= 0) {
      toast({ title: "Error", description: "Please enter number of bags", variant: "destructive" });
      return;
    }
    if (isFromQueue && maxBagsFromPop != null && bags > maxBagsFromPop + 0.0001) {
      toast({
        title: "Bags zyada hain",
        description: `Maximum ${maxBagsFromPop} bags (${popAvailableWeight} kg ÷ ${bagSizeKg} kg/bag).`,
        variant: "destructive",
      });
      return;
    }
    const wasteKg = parseFloat(String(wasteWeight).trim().replace(",", ".")) || 0;
    if (isFromQueue) {
      if (isNaN(usedFromPOP) || usedFromPOP <= 0 || usedFromPOP > popAvailableWeight) {
        toast({
          title: "Invalid weight used from POP",
          description: `Enter a value between 0 and ${popAvailableWeight} kg (available from POP).`,
          variant: "destructive",
        });
        return;
      }
      if (wasteKg > usedFromPOP) {
        toast({
          title: "Invalid waste",
          description: `Waste (${wasteKg} kg) cannot be more than weight used from POP (${usedFromPOP} kg).`,
          variant: "destructive",
        });
        return;
      }
    } else {
      if (totalWeight.trim() === "" || isNaN(weight) || weight <= 0) {
        toast({ title: "Error", description: "Please enter machine output / total weight.", variant: "destructive" });
        return;
      }
    }
    let machineOutput = isFromQueue
      ? (machineOutputWeight.trim()
          ? parseFloat(String(machineOutputWeight).trim().replace(",", "."))
          : calcMachineOutputKg(usedFromPOP, wasteKg))
      : weight;
    if (isFromQueue && (isNaN(machineOutput) || machineOutput <= 0) && usedFromPOP > 0) {
      machineOutput = calcMachineOutputKg(usedFromPOP, wasteKg);
    }
    if (isNaN(machineOutput) || machineOutput <= 0) {
      toast({ title: "Error", description: "Machine output weight must be greater than 0.", variant: "destructive" });
      return;
    }
    const costsAtSave = computeProcessQueueCosts({
      purchasePrice,
      purchaseWeight,
      weightUsedFromPOP: usedFromPOP,
      outputWeight: machineOutput,
      wasteWeight: wasteKg,
      laborCostPerKg: parseFloat(String(laborCostPerKg).trim().replace(",", ".")) || 0,
    });
    const autoWasteCostRs =
      isFromQueue && purchasePrice > 0 && purchaseWeight > 0
        ? costsAtSave.wasteCost
        : parseFloat(String(wasteCost).trim().replace(",", ".")) || 0;
    if (!selectedMachine) {
      toast({ title: "Error", description: "Please select a machine", variant: "destructive" });
      return;
    }
    if (selectedEmployees.length === 0) {
      toast({ title: "Error", description: "Please select at least one employee", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedEmployeeObjects = employees.filter((emp) => selectedEmployees.includes(emp._id));
      const employeesPayload = selectedEmployeeObjects.map((e) => ({
        employeeId: e._id,
        name: e.name,
        department: e.department || "",
      }));
      const payload: Record<string, unknown> = {
        materialName: materialName.trim(),
        machine: selectedMachine,
        totalBags:
          isFromQueue && maxBagsFromPop != null && bags > maxBagsFromPop
            ? maxBagsFromPop
            : bags,
        totalWeight: machineOutput,
        productionDate: productionDate || getLocalDateString(),
        quality: quality.trim() || "Standard",
        color: selectedColor,
        shift: selectedShift,
        employees: employeesPayload,
        status: "completed",
        productCode: productCode || undefined,
        bagSize: bagSizeKg || undefined,
        wasteWeight: wasteKg,
        wasteCost: autoWasteCostRs,
        laborCostPerKg: parseFloat(String(laborCostPerKg).trim().replace(",", ".")) || 0,
      };
      const effectivePurchaseId = selectedReceiptId || purchaseId;
      if (consumeByCode) {
        payload.consumeByCode = true;
        // Backend FIFO across all POP invoices for this code — no single receipt pick
      } else if (effectivePurchaseId) {
        payload.purchaseId = effectivePurchaseId;
        if (selectedLineIndex != null && !isNaN(selectedLineIndex)) {
          payload.materialLineIndex = selectedLineIndex;
        } else if (initialMaterial?.materialLineIndex != null) {
          payload.materialLineIndex = initialMaterial.materialLineIndex;
        }
      }
      if (isFromQueue && !isNaN(usedFromPOP)) {
        payload.weightUsedFromPOP = usedFromPOP;
        const selectedCode = normCodeStrict(productCode);
        if (!selectedCode) {
          throw new Error("Product code select karen — sirf Code 100/105/110 se cut hoga");
        }
        payload.productCode = selectedCode;
      }
      const response = await api.post(`${PROCESSING_API_URL}/production`, payload);
      if (response.data.success) {
        toast({
          title: "Success",
          description:
            response.data.message ||
            "Production saved. Code ke overall POP stock se weight minus hua.",
        });
        onSaved();
        onClose();
      } else {
        throw new Error(response.data.message || "Failed to save");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to save production";
      toast({
        title: "Process failed",
        description: msg === "Please login to continue" ? "Please login again — session expired" : msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const machine = machines.find((m) => m.id === selectedMachine);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Start Process</p>
          <button onClick={onClose} className="p-1 hover:bg-cms-card-hover rounded-md transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">Start New Process</h2>
            {isFromQueue && materialName.trim() ? (
              <div className="mt-3 p-4 rounded-lg border-2 border-primary bg-primary/5">
                {initialMaterial?.productCode && initialMaterial.productCode !== '—' && (
                  <p className="text-2xl font-bold text-primary">Code {initialMaterial.productCode}</p>
                )}
                <p className="text-xs font-medium text-primary uppercase tracking-wide mt-1">Processing this material</p>
                <p className="text-xl font-bold text-foreground mt-1">{materialName}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>Quality: <strong className="text-foreground">{quality}</strong></span>
                  {initialMaterial?.vendor && initialMaterial.vendor !== "Multiple" && (
                    <span>Vendor: <strong className="text-foreground">{initialMaterial.vendor}</strong></span>
                  )}
                  <span>
                    POP available (Code {productCode}):{" "}
                    <strong className="text-foreground">{popAvailableWeight} kg</strong>
                    {initialMaterial?.materialOptions && initialMaterial.materialOptions.length > 0
                      ? ` · ${initialMaterial.materialOptions.length} invoice${initialMaterial.materialOptions.length > 1 ? "s" : ""}`
                      : ""}
                  </span>
                  {purchasePrice > 0 && purchaseWeight > 0 && (
                    <span>
                      Avg POP rate:{" "}
                      <strong className="text-foreground">
                        Rs. {getPricePerKgFromPop(purchasePrice, purchaseWeight).toLocaleString()}/kg
                      </strong>
                    </span>
                  )}
                </div>
                {consumeByCode &&
                  initialMaterial?.materialOptions &&
                  initialMaterial.materialOptions.length > 0 && (
                    <div className="mt-3 rounded-md border border-border/60 bg-background/50 p-2.5">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Pending invoices (FIFO — purani pehle; process ke baad khali hide)
                      </p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {initialMaterial.materialOptions.map((opt, idx) => (
                          <div
                            key={`${opt.purchaseId}-${opt.materialLineIndex ?? idx}`}
                            className="flex justify-between gap-2 text-xs"
                          >
                            <span className="truncate text-foreground">
                              #{idx + 1} {opt.receiptNo || "Receipt"}
                              {opt.materialName ? ` · ${opt.materialName}` : ""}
                            </span>
                            <span className="shrink-0 font-semibold text-primary">
                              {opt.availableWeight ?? 0} kg
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Enter material details and production output below.</p>
            )}
          </div>
          <div className="mb-4 p-3 rounded-lg border border-border bg-cms-card/50">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Estimated total cost (same as Production History after save)
            </p>
            {isFromQueue && pricePerKg > 0 && (
              <p className="text-xs text-muted-foreground mb-2">
                POP rate: Rs. {pricePerKg.toLocaleString()}/kg · Material = output kg × rate · Waste = waste kg × rate
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Material</span>
                <p className="font-semibold">Rs. {estimatedCosts.materialCost.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Waste</span>
                <p className="font-semibold text-red-600">Rs. {estimatedCosts.wasteCost.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Labor</span>
                <p className="font-semibold">Rs. {estimatedCosts.laborCost.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total</span>
                <p className="font-bold text-primary">Rs. {estimatedCosts.totalProductionCost.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Left Column - Material Information (same as POP / old form) */}
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Material Information</h3>
              <div className="space-y-4">
                <div className="bg-cms-card-hover rounded-lg p-4 border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">Material</div>
                      <div className="text-lg font-semibold text-foreground">
                        <input
                          type="text"
                          value={materialName}
                          onChange={(e) => setMaterialName(e.target.value)}
                          placeholder="e.g. HDPE, LDPE, steel"
                          className="w-full bg-transparent border-b border-border pb-1 text-foreground focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                    <div
                      className="w-8 h-8 rounded-full border border-border"
                      style={{ backgroundColor: selectedColor }}
                    />
                  </div>
                </div>
                {!consumeByCode && popAvailableLines.length > 1 && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">
                      Available material (POP line)
                    </label>
                    <select
                      value={`${selectedLineIndex ?? 0}|${productCode}`}
                      onChange={(e) => {
                        const [idxRaw, code] = e.target.value.split("|");
                        const line = popAvailableLines.find(
                          (l) =>
                            String(l.lineIndex) === idxRaw && l.productCode === code
                        );
                        if (!line) return;
                        setSelectedLineIndex(line.lineIndex);
                        setProductCode(line.productCode);
                        setMaterialName(line.materialName);
                        setTotalBags("");
                        setWeightUsedFromPOP("");
                        popWeightManualRef.current = false;
                      }}
                      className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {popAvailableLines.map((line) => (
                        <option
                          key={`${line.lineIndex}-${line.productCode}`}
                          value={`${line.lineIndex}|${line.productCode}`}
                        >
                          Code {line.productCode} — {line.materialName} ({line.availableKg} kg)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Product Code *</label>
                  <select
                    value={productCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setProductCode(code);
                      const line = popAvailableLines.find((l) => l.productCode === code);
                      if (line) {
                        setSelectedLineIndex(line.lineIndex);
                        setMaterialName(line.materialName);
                        setTotalBags("");
                        setWeightUsedFromPOP("");
                        popWeightManualRef.current = false;
                      }
                    }}
                    disabled={
                      productCodeOptions.length <= 1 ||
                      !!(initialMaterial?.productCode && initialMaterial.productCode !== '—')
                    }
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-70"
                  >
                    {productCodeOptions.map((p) => (
                      <option key={p.code} value={p.code}>{p.label} — {p.bagSize} kg/bag</option>
                    ))}
                  </select>
                  {isFromQueue && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Code {productCode} ka overall stock use hoga — invoice select karne ki zaroorat nahi.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Total Bags *</label>
                  <input
                    type="number"
                    min={0.01}
                    max={maxBagsFromPop ?? undefined}
                    step={0.01}
                    value={totalBags}
                    onChange={(e) => handleTotalBagsChange(e.target.value)}
                    placeholder={
                      maxBagsFromPop != null ? `max ${maxBagsFromPop}` : "e.g. 3.33"
                    }
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {isFromQueue && bagSizeKg > 0 && (
                    <p className="text-xs text-primary mt-1">
                      Code {productCode}: {bagSizeKg} kg/bag —{" "}
                      <strong>
                        max {maxBagsFromPop ?? "—"} bags
                      </strong>{" "}
                      ({popAvailableWeight} kg available)
                      {totalBags && parseFloat(totalBags) > 0
                        ? ` → ${calcPopWeightFromBags(productCode, parseFloat(totalBags))} kg POP se minus`
                        : ""}
                    </p>
                  )}
                  {isFromQueue && maxBagsFromPop != null && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Example: {popAvailableWeight} kg ÷ {bagSizeKg} kg = {maxBagsFromPop} bags — is se zyada nahi
                    </p>
                  )}
                </div>
                {isFromQueue ? (
                  <>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">POP / Actual weight (kg)</label>
                      <input
                        type="text"
                        readOnly
                        value={popAvailableWeight}
                        className="w-full bg-cms-card-hover border border-border rounded-md px-3 py-2.5 text-sm text-foreground cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Available from POP for this material. Remaining after use will stay in queue.</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <label className="block text-xs text-muted-foreground">
                          Weight used from POP (kg) * — bags × {bagSizeKg || "?"} kg (editable)
                        </label>
                        {popWeightManualRef.current && totalBags && parseFloat(totalBags) > 0 ? (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline shrink-0"
                            onClick={() => {
                              popWeightManualRef.current = false;
                              applyPopWeightFromBags(parseFloat(totalBags));
                            }}
                          >
                            Formula se sync
                          </button>
                        ) : null}
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={weightUsedFromPOP}
                        onChange={(e) => handleWeightUsedFromPOPChange(e.target.value)}
                        placeholder={
                          bagSizeKg && totalBags
                            ? String(
                                calcPopWeightFromBags(
                                  productCode,
                                  parseFloat(totalBags) || 0
                                )
                              )
                            : `max ${popAvailableWeight}`
                        }
                        className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Pehle bags se auto ({bagSizeKg} kg/bag). Decimal case mein kg yahan adjust kar
                        sakte hain (max {popAvailableWeight} kg). Baqi POP ≈{" "}
                        {Math.max(
                          0,
                          Math.round(
                            (popAvailableWeight - (parseFloat(weightUsedFromPOP) || 0)) * 100
                          ) / 100
                        )}{" "}
                        kg
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">Waste Weight (kg)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={wasteWeight}
                        onChange={(e) => setWasteWeight(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Scrap / loss during process (deducted from weight used).</p>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">Machine output weight (kg) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        readOnly
                        value={machineOutputWeight}
                        placeholder="Auto: Used − Waste"
                        className="w-full bg-cms-card-hover border border-primary/40 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground cursor-default"
                      />
                      <p className="text-xs text-primary mt-1">
                        Auto-calculated: POP used ({weightUsedFromPOP || "0"} kg) − waste ({wasteWeight || "0"} kg) ={" "}
                        <strong>{machineOutputWeight || "0"} kg</strong> finished product
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Total Weight Produced (kg) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={totalWeight}
                      onChange={(e) => setTotalWeight(e.target.value)}
                      placeholder="e.g. 8000, 5000 — custom weight (no limit)"
                      className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Custom weight only — not from POP. Any value (e.g. 8000) is saved to Production List.</p>
                  </div>
                )}
                {!isFromQueue && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Waste Weight (kg)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={wasteWeight}
                      onChange={(e) => setWasteWeight(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Waste Cost (Rs.)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly={isFromQueue && pricePerKg > 0}
                    value={wasteCost}
                    onChange={(e) => setWasteCost(e.target.value)}
                    placeholder={isFromQueue && pricePerKg > 0 ? "Auto from POP price" : "e.g. 5000"}
                    className={`w-full border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
                      isFromQueue && pricePerKg > 0
                        ? "bg-cms-card-hover font-semibold cursor-default"
                        : "bg-cms-card"
                    }`}
                  />
                  {isFromQueue && pricePerKg > 0 && (
                    <p className="text-xs text-primary mt-1">
                      {wasteWeight || "0"} kg × Rs. {pricePerKg.toLocaleString()}/kg ={" "}
                      <strong>Rs. {estimatedCosts.wasteCost.toLocaleString()}</strong> (matches history)
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Labor Cost per Kg (Rs.)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={laborCostPerKg}
                    onChange={(e) => setLaborCostPerKg(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Production Date *</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-2">Color</label>
                  <div className="flex flex-wrap items-center gap-3">
                    {colorOptions.map((color) => (
                      <label key={color.value} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="startProcessColor"
                          value={color.value}
                          checked={selectedColor === color.value}
                          onChange={() => setSelectedColor(color.value)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded-full ${color.color} border-2 ${
                            selectedColor === color.value ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "border-border"
                          }`}
                        />
                        <span className="text-xs text-foreground">{color.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Right Column - Processing Settings (machine, shift, employees - same as old form) */}
            <div>
              <h3 className="text-base font-semibold text-foreground mb-4">Processing Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Machine *</label>
                  <select
                    value={selectedMachine}
                    onChange={(e) => setSelectedMachine(e.target.value)}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Machine</option>
                    {machines.filter((m) => m.status === "available").map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.capacity} kg capacity)</option>
                    ))}
                    {machines.filter((m) => m.status !== "available").length > 0 &&
                      machines.filter((m) => m.status !== "available").map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                  </select>
                  {machine && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-700 dark:text-blue-300">Selected:</span>
                        <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">{machine.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                        Capacity: {machine.capacity} kg • <StatusBadge status={machine.status} />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Shift *</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value as "morning" | "evening" | "night")}
                    className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="morning">Morning (6AM - 2PM)</option>
                    <option value="evening">Evening (2PM - 10PM)</option>
                    <option value="night">Night (10PM - 6AM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Select Employees *</label>
                  {loadingEmployees ? (
                    <div className="flex items-center justify-center py-4">
                      <RotateCw className="w-4 h-4 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Loading employees...</span>
                    </div>
                  ) : employees.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">No employees found. Add employees first.</div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-cms-card-hover rounded-md border border-border">
                      {employees.map((employee) => (
                        <label
                          key={employee._id}
                          className="flex items-center gap-3 p-2 hover:bg-cms-card rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(employee._id)}
                            onChange={() => handleEmployeeToggle(employee._id)}
                            className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                          />
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.department} • {employee.employeeId}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedEmployees.length > 0 && (
                    <div className="mt-2 text-xs text-green-600">{selectedEmployees.length} employee(s) selected</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !materialName.trim() ||
                !totalBags ||
                selectedEmployees.length === 0 ||
                (isFromQueue &&
                  maxBagsFromPop != null &&
                  parseFloat(String(totalBags).replace(",", ".")) > maxBagsFromPop + 0.0001) ||
                (isFromQueue
                  ? !weightUsedFromPOP.trim() ||
                    parseFloat(String(weightUsedFromPOP).replace(",", ".")) <= 0 ||
                    parseFloat(String(weightUsedFromPOP).replace(",", ".")) > popAvailableWeight ||
                    !machineOutputWeight.trim() ||
                    parseFloat(String(machineOutputWeight).replace(",", ".")) <= 0
                  : !totalWeight.trim() || parseFloat(String(totalWeight).replace(",", ".")) <= 0)
              }
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Production Modal
const EditProductionModal = ({
  production,
  open,
  onClose,
  onSaved,
}: {
  production: ProductionData | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [materialName, setMaterialName] = useState("");
  const [quality, setQuality] = useState("Standard");
  const [selectedMachine, setSelectedMachine] = useState(machines[0]?.id || "");
  const [totalBags, setTotalBags] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [availableWeight, setAvailableWeight] = useState("");
  const [weightUsedFromPOP, setWeightUsedFromPOP] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [selectedShift, setSelectedShift] = useState<"morning" | "evening" | "night">("morning");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && production) {
      setMaterialName(production.materialName || "");
      setQuality(production.quality || "Standard");
      setSelectedMachine(production.machineUsed || machines[0]?.id || "");
      setTotalBags(String(production.totalBags || ""));
      setTotalWeight(String(production.outputWeight || ""));
      setAvailableWeight(String(production.availableWeight ?? production.outputWeight ?? ""));
      setWeightUsedFromPOP(String(production.weightUsedFromPOP ?? "0"));
      setProductionDate(production.productionDate ? formatDateLocal(new Date(production.productionDate)) : "");
      setSelectedShift((production.shift as "morning" | "evening" | "night") || "morning");
    }
  }, [open, production]);

  const handleSubmit = async () => {
    if (!production) return;
    const bags = parseInt(totalBags, 10);
    const weight = parseFloat(totalWeight.replace(",", "."));
    const avail = parseFloat(availableWeight.replace(",", "."));
    if (!materialName.trim()) {
      toast({ title: "Error", description: "Material name is required", variant: "destructive" });
      return;
    }
    if (isNaN(bags) || bags <= 0) {
      toast({ title: "Error", description: "Valid number of bags required", variant: "destructive" });
      return;
    }
    if (isNaN(weight) || weight <= 0) {
      toast({ title: "Error", description: "Valid total weight required", variant: "destructive" });
      return;
    }
    if (isNaN(avail) || avail < 0) {
      toast({ title: "Error", description: "Valid available weight required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        materialName: materialName.trim(),
        quality: quality.trim() || "Standard",
        machine: selectedMachine,
        totalBags: bags,
        totalWeight: weight,
        availableWeight: avail,
        weightUsedFromPOP: parseFloat(weightUsedFromPOP.replace(",", ".")) || 0,
        productionDate: productionDate || getLocalDateString(),
        shift: selectedShift,
      };
      await api.put(`${PROCESSING_API_URL}/production/${production._id}`, payload);
      toast({ title: "Success", description: "Production record updated." });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.response?.data?.message || err.message || "Failed to update",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !production) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">Edit Production</p>
          <button onClick={onClose} className="p-1 hover:bg-cms-card-hover rounded-md transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Material Name *</label>
            <input type="text" value={materialName} onChange={(e) => setMaterialName(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Quality</label>
            <input type="text" value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Machine</label>
            <select value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Total Bags *</label>
              <input type="number" min={1} value={totalBags} onChange={(e) => setTotalBags(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Total Weight (kg) *</label>
              <input type="text" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Weight Used from POP (kg)</label>
            <input type="text" value={weightUsedFromPOP} onChange={(e) => setWeightUsedFromPOP(e.target.value)} placeholder="e.g. 500" className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Available Weight (kg) *</label>
            <input type="text" value={availableWeight} onChange={(e) => setAvailableWeight(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Production Date</label>
            <input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Shift</label>
            <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value as any)} className="w-full bg-cms-card border border-border rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="morning">Mornings</option>
              <option value="evening">Evening</option>
              <option value="night">Nights</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border rounded-md text-sm font-medium">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !materialName.trim() || !totalBags || !totalWeight} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50">
            {isSubmitting ? <RotateCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Saves
          </button>
        </div>
      </div>
    </div>
  );
};

// Production History Component
const ProductionHistory = ({ productionData, onRefresh }: { productionData: ProductionData[]; onRefresh: () => void }) => {
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterShift, setFilterShift] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProduction, setSelectedProduction] = useState<ProductionData | null>(null);
  const [editingProduction, setEditingProduction] = useState<ProductionData | null>(null);

  const handleDelete = async (prod: ProductionData) => {
    if (!window.confirm(`Delete production ${prod.batchNo}? This cannot be undone.`)) return;
    try {
      await api.delete(`${PROCESSING_API_URL}/production/${prod._id}`);
      toast({
        title: "Success",
        description: res.data?.message || "Production record deleted.",
      });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.response?.data?.message || err.response?.data?.error || "Failed to delete", variant: "destructive" });
    }
  };
  
  const filteredData = productionData.filter(prod => {
    if (filterDate && new Date(prod.productionDate).toDateString() !== new Date(filterDate).toDateString()) {
      return false;
    }
    if (filterShift !== 'all' && prod.shift !== filterShift) {
      return false;
    }
    if (filterStatus !== 'all' && prod.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const exportData = filteredData.filter((prod) =>
    inDateRange(prod.productionDate, exportStartDate || undefined, exportEndDate || undefined)
  );

  const handleExportHistory = (format: "excel" | "word" | "pdf") => {
    if (exportData.length === 0) {
      toast({
        title: "No data",
        description: "No production records found for selected date range.",
        variant: "destructive",
      });
      return;
    }
    const headers = [
      "Date",
      "Batch No",
      "Material",
      "Quality",
      "Employees",
      "Shift",
      "Total Output (kg)",
      "Sold (kg)",
      "Remaining (kg)",
      "Total Bags",
      "Efficiency (%)",
      "Status",
    ];
    const rows = exportData.map((prod) => {
      const total = prod.outputWeight ?? 0;
      const remaining = prod.availableWeight ?? total;
      const sold = Math.round((total - remaining) * 100) / 100;
      return {
        "Date": new Date(prod.productionDate).toLocaleDateString(),
        "Batch No": prod.batchNo,
        "Material": prod.materialName,
        "Quality": prod.quality || "N/A",
        "Employees": formatProductionEmployees(prod),
        "Shift": prod.shift,
        "Total Output (kg)": total,
        "Sold (kg)": sold,
        "Remaining (kg)": remaining,
        "Total Bags": prod.totalBags || 0,
        "Efficiency (%)": prod.efficiency || 0,
        "Status": prod.status,
      };
    });
    const rangeText =
      exportStartDate || exportEndDate
        ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}`
        : toYmd(new Date());
    if (format === "excel") {
      exportAsExcelTable(`Process_History_${rangeText}.xls`, "Production History", headers, rows);
    } else if (format === "pdf") {
      const body = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${headers.map((h) => `<td>${r[h as keyof typeof r] ?? ""}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
      exportAsPdf("Production History", body);
    } else {
      exportAsWordTable(`Process_History_${rangeText}.doc`, "Process Production History", headers, rows);
    }
    toast({
      title: "Export complete",
      description: `${rows.length} process records exported.`,
    });
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDate, filterShift, filterStatus]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Color-wise weight summary (same style as POP): total produced, sold, remaining per color + quality breakdown
  const colorSummary = React.useMemo(() => {
    const byColor: Record<string, {
      totalWeight: number;
      soldWeight: number;
      remainingWeight: number;
      qualities: Record<string, { totalWeight: number; soldWeight: number; remainingWeight: number }>;
    }> = {};
    productionData.forEach((prod) => {
      const colorHex = prod.color || "#FFFFFF";
      const colorName = getColorName(colorHex);
      const quality = prod.quality || "Unknown";
      const total = prod.outputWeight ?? 0;
      const remaining = prod.availableWeight ?? total ?? 0;
      const sold = total - remaining;
      if (!byColor[colorName]) {
        byColor[colorName] = {
          totalWeight: 0,
          soldWeight: 0,
          remainingWeight: 0,
          qualities: {},
        };
      }
      byColor[colorName].totalWeight += total;
      byColor[colorName].soldWeight += sold;
      byColor[colorName].remainingWeight += remaining;
      if (!byColor[colorName].qualities[quality]) {
        byColor[colorName].qualities[quality] = { totalWeight: 0, soldWeight: 0, remainingWeight: 0 };
      }
      byColor[colorName].qualities[quality].totalWeight += total;
      byColor[colorName].qualities[quality].soldWeight += sold;
      byColor[colorName].qualities[quality].remainingWeight += remaining;
    });
    return byColor;
  }, [productionData]);

  // Weight-wise summary: by material (total produced, sold, remaining per material)
  const weightSummary = React.useMemo(() => {
    const byMaterial: Record<string, {
      totalWeight: number;
      soldWeight: number;
      remainingWeight: number;
      colors: Record<string, { totalWeight: number; soldWeight: number; remainingWeight: number }>;
      qualities: Record<string, { totalWeight: number; soldWeight: number; remainingWeight: number }>;
    }> = {};
    productionData.forEach((prod) => {
      const material = prod.materialName || "Unknown";
      const colorName = getColorName(prod.color || "#FFFFFF");
      const quality = prod.quality || "Unknown";
      const total = prod.outputWeight ?? 0;
      const remaining = prod.availableWeight ?? total ?? 0;
      const sold = total - remaining;
      if (!byMaterial[material]) {
        byMaterial[material] = {
          totalWeight: 0,
          soldWeight: 0,
          remainingWeight: 0,
          colors: {},
          qualities: {},
        };
      }
      byMaterial[material].totalWeight += total;
      byMaterial[material].soldWeight += sold;
      byMaterial[material].remainingWeight += remaining;
      if (!byMaterial[material].colors[colorName]) {
        byMaterial[material].colors[colorName] = { totalWeight: 0, soldWeight: 0, remainingWeight: 0 };
      }
      byMaterial[material].colors[colorName].totalWeight += total;
      byMaterial[material].colors[colorName].soldWeight += sold;
      byMaterial[material].colors[colorName].remainingWeight += remaining;

      if (!byMaterial[material].qualities[quality]) {
        byMaterial[material].qualities[quality] = { totalWeight: 0, soldWeight: 0, remainingWeight: 0 };
      }
      byMaterial[material].qualities[quality].totalWeight += total;
      byMaterial[material].qualities[quality].soldWeight += sold;
      byMaterial[material].qualities[quality].remainingWeight += remaining;
    });
    return byMaterial;
  }, [productionData]);

  const exportColorSummaryRows = Object.entries(colorSummary)
    .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
    .map(([colorName, data]) => ({
      "Color": colorName,
      "Total Produced (kg)": Math.round((data.totalWeight || 0) * 100) / 100,
      "Sold (kg)": Math.round((data.soldWeight || 0) * 100) / 100,
      "Remaining (kg)": Math.round((data.remainingWeight || 0) * 100) / 100,
      "By Quality": Object.entries(data.qualities || {})
        .sort((a, b) => (b[1].totalWeight || 0) - (a[1].totalWeight || 0))
        .map(([q, qd]) => `${q}: ${Math.round((qd.remainingWeight || 0) * 100) / 100} / ${Math.round((qd.totalWeight || 0) * 100) / 100} kg`)
        .join(" | "),
    }));

  const exportWeightSummaryRows = Object.entries(weightSummary)
    .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
    .map(([materialName, data]) => ({
      "Material": materialName,
      "Total Produced (kg)": Math.round((data.totalWeight || 0) * 100) / 100,
      "Sold (kg)": Math.round((data.soldWeight || 0) * 100) / 100,
      "Remaining (kg)": Math.round((data.remainingWeight || 0) * 100) / 100,
      "By Color": Object.entries(data.colors || {})
        .sort((a, b) => (b[1].totalWeight || 0) - (a[1].totalWeight || 0))
        .map(([c, cd]) => `${c}: ${Math.round((cd.remainingWeight || 0) * 100) / 100} / ${Math.round((cd.totalWeight || 0) * 100) / 100} kg`)
        .join(" | "),
      "By Quality": Object.entries(data.qualities || {})
        .sort((a, b) => (b[1].totalWeight || 0) - (a[1].totalWeight || 0))
        .map(([q, qd]) => `${q}: ${Math.round((qd.remainingWeight || 0) * 100) / 100} / ${Math.round((qd.totalWeight || 0) * 100) / 100} kg`)
        .join(" | "),
    }));

  const handleExportColorSummary = (format: "excel" | "word") => {
    if (exportColorSummaryRows.length === 0) {
      toast({ title: "No data", description: "No color summary to export.", variant: "destructive" });
      return;
    }
    const headers = ["Color", "Total Produced (kg)", "Sold (kg)", "Remaining (kg)", "By Quality"];
    const suffix = exportStartDate || exportEndDate ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}` : toYmd(new Date());
    if (format === "excel") {
      exportAsCsv(`Process_Color_Summary_${suffix}.csv`, headers, exportColorSummaryRows);
    } else {
      exportAsWordTable(`Process_Color_Summary_${suffix}.doc`, "Process Color-wise Summary", headers, exportColorSummaryRows);
    }
    toast({ title: "Export complete", description: `${exportColorSummaryRows.length} colors exported.` });
  };

  const handleExportWeightSummary = (format: "excel" | "word") => {
    if (exportWeightSummaryRows.length === 0) {
      toast({ title: "No data", description: "No weight summary to export.", variant: "destructive" });
      return;
    }
    const headers = ["Material", "Total Produced (kg)", "Sold (kg)", "Remaining (kg)", "By Color", "By Quality"];
    const suffix = exportStartDate || exportEndDate ? `${exportStartDate || "start"}_to_${exportEndDate || "today"}` : toYmd(new Date());
    if (format === "excel") {
      exportAsCsv(`Process_Weight_Summary_${suffix}.csv`, headers, exportWeightSummaryRows);
    } else {
      exportAsWordTable(`Process_Weight_Summary_${suffix}.doc`, "Process Weight-wise Summary", headers, exportWeightSummaryRows);
    }
    toast({ title: "Export complete", description: `${exportWeightSummaryRows.length} materials exported.` });
  };

  const getColorHex = (colorName: string) => {
    const c = colorOptions.find(o => o.name.toLowerCase() === colorName.toLowerCase());
    return c ? c.value : "#CCCCCC";
  };

  return (
    <div className="bg-cms-card rounded-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Production History
          </h3>
          <p className="text-sm text-muted-foreground">
            {productionData.length} production records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="date"
            value={exportStartDate}
            onChange={(e) => setExportStartDate(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="Export start date"
          />
          <input
            type="date"
            value={exportEndDate}
            onChange={(e) => setExportEndDate(e.target.value)}
            className="bg-cms-card-hover border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="Export end date"
          />
          <button
            onClick={() => handleExportHistory("excel")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
          >
            <Download className="w-3 h-3" />
            Excel
          </button>
          <button
            onClick={() => handleExportHistory("pdf")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
          >
            <Download className="w-3 h-3" />
            PDF
          </button>
          <button
            onClick={() => handleExportHistory("word")}
            className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
          >
            <Download className="w-3 h-3" />
            Word
          </button>
        </div>
      </div>

      {/* Color-wise Weight Summary */}
      {Object.keys(colorSummary).length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-blue-500" />
              Color-wise Weight Summary
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExportColorSummary("excel")}
                className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
              >
                <Download className="w-3 h-3" />
                Excel
              </button>
              <button
                onClick={() => handleExportColorSummary("word")}
                className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
              >
                <Download className="w-3 h-3" />
                Word
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(colorSummary)
              .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
              .map(([colorName, data]) => {
                const colorHex = getColorHex(colorName);
                const total = Math.round(data.totalWeight * 10) / 10;
                const sold = Math.round(data.soldWeight * 10) / 10;
                const remaining = Math.round(data.remainingWeight * 10) / 10;
                return (
                  <div key={colorName} className="bg-cms-table-header rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: colorHex }}
                        />
                        <span className="text-sm font-medium text-foreground capitalize">{colorName}</span>
                      </div>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {total.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Produced:</span>
                        <span className="font-medium text-foreground">{total.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Sold:</span>
                        <span className="font-medium text-green-600">{sold.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-medium text-primary">{remaining.toLocaleString()} kg</span>
                      </div>
                    </div>
                    {Object.keys(data.qualities).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">Breakdown by Quality:</div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {Object.entries(data.qualities)
                            .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                            .map(([quality, qData]) => (
                              <div key={quality} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                                  <span className="text-foreground">{quality}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-primary">{Math.round(qData.remainingWeight * 10) / 10} kg</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-foreground">{Math.round(qData.totalWeight * 10) / 10} kg</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Weight-wise Summary (by Material) */}
      {Object.keys(weightSummary).length > 0 && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Weight-wise Summary (by Material)
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleExportWeightSummary("excel")}
                className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
              >
                <Download className="w-3 h-3" />
                Excel
              </button>
              <button
                onClick={() => handleExportWeightSummary("word")}
                className="px-3 py-1.5 bg-cms-card-hover border border-border text-foreground rounded-md text-xs font-medium flex items-center gap-1 transition-colors hover:bg-secondary"
              >
                <Download className="w-3 h-3" />
                Word
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(weightSummary)
              .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
              .map(([materialName, data]) => {
                const total = Math.round(data.totalWeight * 10) / 10;
                const sold = Math.round(data.soldWeight * 10) / 10;
                const remaining = Math.round(data.remainingWeight * 10) / 10;
                return (
                  <div key={materialName} className="bg-cms-table-header rounded-lg p-3 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{materialName}</span>
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                        {total.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Produced:</span>
                        <span className="font-medium text-foreground">{total.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Sold:</span>
                        <span className="font-medium text-green-600">{sold.toLocaleString()} kg</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-medium text-primary">{remaining.toLocaleString()} kg</span>
                      </div>
                    </div>
                    {Object.keys(data.colors).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">Breakdown by Color:</div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {Object.entries(data.colors)
                            .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                            .map(([colorName, cData]) => (
                              <div key={colorName} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full border border-border"
                                    style={{ backgroundColor: getColorHex(colorName) }}
                                  />
                                  <span className="text-foreground">{colorName}</span>
                                </div>
                                <div className="flex gap-3">
                                  <span className="text-primary">{Math.round(cData.remainingWeight * 10) / 10} kg</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-foreground">{Math.round(cData.totalWeight * 10) / 10} kg</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    {Object.keys(data.qualities).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="text-xs text-muted-foreground mb-2">Breakdown by Quality:</div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {Object.entries(data.qualities)
                            .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
                            .map(([quality, qData]) => (
                              <div key={quality} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-primary/50" />
                                  <span className="text-foreground">{quality}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-primary">{Math.round(qData.remainingWeight * 10) / 10} kg</span>
                                  <span className="text-muted-foreground">/</span>
                                  <span className="text-foreground">{Math.round(qData.totalWeight * 10) / 10} kg</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {filteredData.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No production records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-cms-table-header">
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Batch No.</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Material</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total (kg)</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Sold (kg)</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Remaining (kg)</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Bags</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Efficiency</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Total Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Employees</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Shift</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Raw Weight</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((prod) => (
                <tr key={prod._id} className="border-t border-border hover:bg-cms-card-hover transition-colors">
                  <td className="px-4 py-3 text-sm text-foreground font-medium">
                    {prod.batchNo}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: prod.color }}
                      />
                      <div>
                        <div>{prod.materialName}</div>
                        <div className="text-xs text-muted-foreground">
                          {prod.quality}
                          {prod.vendor ? ` · ${prod.vendor}` : ""}
                        </div>
                        {prod.receiptNo && (
                          <div className="text-xs text-muted-foreground">Receipt: {prod.receiptNo}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">
                    {prod.outputWeight} kg
                    {prod.wasteWeight > 0 && (
                      <div className="text-xs text-red-600">Waste: {prod.wasteWeight} kg</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">
                    {Math.round((prod.outputWeight ?? 0) - (prod.availableWeight ?? prod.outputWeight ?? 0))} kg
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-primary">
                    {(prod.availableWeight ?? prod.outputWeight ?? 0)} kg
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {prod.totalBags || 0} bags
                    <div className="text-xs text-muted-foreground">
                      {prod.bagWeight || 0} kg/bag
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {prod.efficiency}%
                      </div>
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${
                            prod.efficiency >= 90 ? 'bg-green-500' :
                            prod.efficiency >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, prod.efficiency)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">
                    {(() => {
                      const mat = prod.materialCost || 0;
                      const waste = prod.wasteCost || 0;
                      const laborPart = prod.laborCost ?? 0;
                      const total = getProductionDisplayCost({
                        totalProductionCost: prod.totalProductionCost,
                        materialCost: mat,
                        wasteCost: waste,
                        laborCost: laborPart,
                        laborCostPerKg: prod.laborCostPerKg,
                        outputWeight: prod.outputWeight,
                        weightUsedFromPOP: prod.weightUsedFromPOP,
                        wasteWeight: prod.wasteWeight,
                        purchasePrice: prod.purchasePrice,
                        purchaseWeight: prod.purchaseWeight,
                      });
                      return total > 0 ? (
                        <div>
                          <div>Rs. {total.toLocaleString()}</div>
                          <div className="text-xs font-normal text-muted-foreground">
                            {mat > 0 && `Mat. Rs. ${mat.toLocaleString()}`}
                            {waste > 0 && `${mat > 0 ? " + " : ""}Waste Rs. ${waste.toLocaleString()}`}
                            {laborPart > 0.01 && ` + Labor Rs. ${Math.round(laborPart).toLocaleString()}`}
                          </div>
                        </div>
                      ) : (
                        "—"
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[180px]">
                    {formatProductionEmployees(prod)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground capitalize">
                    {prod.shift}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(prod.productionDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={prod.status} />
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">
                    {prod.weightUsedFromPOP || 0} kg
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedProduction(prod)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingProduction(prod)}
                        className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(prod)}
                        className="p-1.5 hover:bg-destructive/20 rounded transition-colors text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {(filteredData.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-border bg-cms-card">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages || 1}
              </span>
              {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                      currentPage === pageNum ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 1 && totalPages > 5 && currentPage < totalPages - 2 && (
                <span className="text-muted-foreground px-2">...</span>
              )}
              {totalPages > 1 && totalPages > 5 && currentPage < totalPages - 2 && (
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${
                    currentPage === totalPages ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Production Details Modal */}
      {selectedProduction && (
        <ProductionDetailsModal
          production={selectedProduction}
          onClose={() => setSelectedProduction(null)}
        />
      )}
      {/* Edit Production Modal */}
      <EditProductionModal
        production={editingProduction}
        open={!!editingProduction}
        onClose={() => setEditingProduction(null)}
        onSaved={() => { onRefresh(); setEditingProduction(null); }}
      />
    </div>
  );
};

// Production Details Modal Component
const ProductionDetailsModal = ({ 
  production,
  onClose
}: {
  production: ProductionData,
  onClose: () => void
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-2xl">
        <div className="bg-cms-table-header px-6 py-3 border-b border-border flex justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Production Details</p>
            <h2 className="text-lg font-bold text-foreground">{production.batchNo}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cms-card-hover rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Production Info</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Material</div>
                  <div className="text-sm text-foreground">{production.materialName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Quality & Color</div>
                  <div className="text-sm text-foreground flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: production.color }}
                    />
                    <span>{production.quality} • {production.color}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Machine Used</div>
                  <div className="text-sm text-foreground">{production.machineUsed}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Operator</div>
                  <div className="text-sm text-foreground">{production.operator}</div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Output Metrics</h4>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Output Weight</div>
                  <div className="text-lg font-semibold text-green-600">
                    {production.outputWeight} kg
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Bags</div>
                  <div className="text-sm font-semibold text-primary">
                    {production.totalBags || 0} bags
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Per Bag Weight</div>
                  <div className="text-sm text-foreground">
                    {production.bagWeight || 0} kg/bag
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Waste</div>
                  <div className="text-sm font-semibold text-red-600">
                    {production.wasteWeight} kg
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Efficiency</div>
                  <div className="text-lg font-semibold text-primary">
                    {production.efficiency}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <StatusBadge status={production.status} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <h4 className="text-sm font-medium text-foreground mb-3">Resource Usage</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-cms-card-hover rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Energy</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {production.energyConsumed} kWh
                </div>
              </div>
              <div className="bg-cms-card-hover rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Water</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {production.waterUsed} L
                </div>
              </div>
              <div className="bg-cms-card-hover rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Shift</span>
                </div>
                <div className="text-sm font-semibold text-foreground capitalize">
                  {production.shift}
                </div>
              </div>
            </div>
          </div>
          
          {production.notes && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-foreground mb-2">Notes</h4>
              <div className="bg-cms-card-hover rounded-lg p-3 text-sm text-muted-foreground">
                {production.notes}
              </div>
            </div>
          )}
          
          <div className="flex justify-end pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cms-card hover:bg-cms-card-hover border border-border text-foreground rounded-md text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Processing Module Component
export function ProcessingModule() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'history'>('dashboard');
  const [materials, setMaterials] = useState<ProcessingMaterial[]>([]);
  const [batches, setBatches] = useState<ProcessingBatch[]>([]);
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<ProcessingMaterial | null>(null);
  const [showStartProcessingModal, setShowStartProcessingModal] = useState(false);
  const [showStartProcessFormModal, setShowStartProcessFormModal] = useState(false);
  const [materialForStartProcess, setMaterialForStartProcess] = useState<ProcessingMaterial | null>(null);
  const [groupTotalWeight, setGroupTotalWeight] = useState<number | null>(null);
  const [groupMaterials, setGroupMaterials] = useState<ProcessingMaterial[] | null>(null);

  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all production records for client-side pagination (backend defaults to limit=10, so request high limit)
      const productionResponse = await api.get(`${PROCESSING_API_URL}/production`, {
        params: { page: 1, limit: 10000 },
      });
      if (productionResponse.data.success) {
        setProductionData(productionResponse.data.data || []);
      }

      const queueResponse = await api.get(`${PROCESSING_API_URL}/queue`);
      if (queueResponse.data.success) {
        setMaterials(
          (queueResponse.data.data || []).filter(
            (m: ProcessingMaterial) => (m.availableWeight ?? 0) > 0
          )
        );
      }
      
      // Fetch active batches for dashboard
      const batchesResponse = await api.get(`${PROCESSING_API_URL}/batches`);
      if (batchesResponse.data.success) {
        setBatches(batchesResponse.data.data || []);
      }
      
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || "Failed to load processing data";
      toast({
        title: "Error",
        description: msg === "Please login to continue" ? "Please login again — session expired" : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleStartProcessing = (material: ProcessingMaterial) => {
    setSelectedMaterial(material);
    setShowStartProcessingModal(true);
  };
  
  const handleStartBatch = async (batchData: any) => {
    try {
      // Add batch to active batches
      const newBatch: ProcessingBatch = {
        _id: `batch_${Date.now()}`,
        batchNo: batchData.batchNo,
        materialId: batchData.materialId,
        materialName: batchData.materialName,
        quality: batchData.quality,
        color: batchData.color,
        inputWeight: batchData.inputWeight,
        totalBags: batchData.totalBags,
        bagWeight: batchData.bagWeight,
        expectedOutput: batchData.expectedOutput,
        stages: batchData.stages,
        employees: batchData.employees,
        status: 'processing',
        startTime: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setBatches(prev => [...prev, newBatch]);
      
      // Update material in queue
      setMaterials(prev => prev.map(m => 
        m._id === batchData.materialId 
          ? { ...m, status: 'in_progress', availableWeight: m.availableWeight - batchData.inputWeight }
          : m
      ));
      
      toast({
        title: "Success",
        description: `Batch ${batchData.batchNo} started successfully!`,
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start batch",
        variant: "destructive",
      });
    }
  };
  
  return (
    <div className="flex-1 min-w-0 p-3 sm:p-4 md:p-6 overflow-auto animate-fade-in">
      {/* Header */}
      <div className="bg-cms-table-header rounded-lg px-4 py-3 mb-6 flex items-center justify-between border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-8 h-6 bg-primary rounded-sm flex items-center justify-center">
            <Factory className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="w-8 h-6 border-2 border-primary rounded-sm flex items-center justify-center">
            <div className="w-4 h-0.5 bg-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Factory Processing Module</h1>
        </div>
        <button
          onClick={() => setShowStartProcessFormModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Start Process
        </button>
      </div>
      
      {/* Tabs */}
      <div className="mb-6">
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'queue'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="w-4 h-4" />
            Processing Queue
            {materials.filter(m => m.status === 'pending').length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                {materials.filter(m => m.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-4 h-4" />
            Production History
          </button>
        </div>
      </div>
      
      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <RotateCw className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading processing data...</span>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <ProcessingDashboard 
              materials={materials} 
              batches={batches} 
              productionData={productionData} 
            />
          )}
          
          {/* Processing Queue Tab */}
          {activeTab === 'queue' && (
            <ProcessingQueue
              materials={materials}
              onStartProcessing={handleStartProcessing}
              onStartProcess={(material, groupTotalKg, groupItems) => {
                setMaterialForStartProcess(material);
                setGroupTotalWeight(groupTotalKg ?? null);
                setGroupMaterials(groupItems ?? [material]);
                setShowStartProcessFormModal(true);
              }}
            />
          )}
          
          {/* Production History Tab */}
          {activeTab === 'history' && (
            <ProductionHistory
              productionData={productionData}
              onRefresh={fetchData}
            />
          )}
        </>
      )}
      
      {/* Start Process Form Modal: from header (no prefill) or from queue row (material name + quality pre-filled). Saved records show only in Production List. */}
      <StartProcessFormModal
        open={showStartProcessFormModal}
        onClose={() => {
          setShowStartProcessFormModal(false);
          setMaterialForStartProcess(null);
          setGroupTotalWeight(null);
          setGroupMaterials(null);
        }}
        onSaved={async () => {
          await fetchData();
          setMaterialForStartProcess(null);
          setGroupTotalWeight(null);
          setGroupMaterials(null);
        }}
        initialMaterial={
          materialForStartProcess
            ? {
                materialName: materialForStartProcess.materialName,
                quality: materialForStartProcess.quality,
                popAvailableWeight: (() => {
                  const lines = (groupMaterials || [materialForStartProcess])
                    .flatMap((m) =>
                      m.lines && m.lines.length > 0 ? m.lines : [m]
                    )
                    .filter(
                      (m) =>
                        (m.availableWeight ?? 0) > 0 &&
                        (!normCodeStrict(materialForStartProcess.productCode) ||
                          m.productCode === materialForStartProcess.productCode)
                    );
                  const sum = lines.reduce((s, m) => s + (m.availableWeight || 0), 0);
                  return sum > 0
                    ? Math.round(sum * 10) / 10
                    : groupTotalWeight ?? materialForStartProcess.availableWeight;
                })(),
                color: materialForStartProcess.color,
                receiptNo: materialForStartProcess.receiptNo,
                vendor: materialForStartProcess.vendor,
                purchasePrice: materialForStartProcess.purchasePrice,
                purchaseWeight:
                  materialForStartProcess.availableWeight ||
                  materialForStartProcess.originalWeight,
                productCode: materialForStartProcess.productCode,
                materialLineIndex: materialForStartProcess.materialLineIndex,
                consumeByCode: true,
                pricePerKg: materialForStartProcess.pricePerKg,
                materialOptions: (() => {
                  const code = normCodeStrict(materialForStartProcess.productCode);
                  const sourceLines = (groupMaterials || [materialForStartProcess]).flatMap(
                    (m) => (m.lines && m.lines.length > 0 ? m.lines : [m])
                  );
                  return sourceLines
                    .filter(
                      (m) =>
                        (m.availableWeight ?? 0) > 0 &&
                        (!code || m.productCode === code)
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.purchaseDate || 0).getTime() -
                        new Date(b.purchaseDate || 0).getTime()
                    )
                    .map((m) => {
                      const ow = m.originalWeight || m.availableWeight || 0;
                      const pp = m.purchasePrice || 0;
                      return {
                        materialName: m.materialName || "Unknown",
                        purchaseId: m.purchaseId,
                        receiptNo: m.receiptNo,
                        productCode: m.productCode,
                        materialLineIndex: m.materialLineIndex,
                        availableWeight: m.availableWeight,
                        pricePerKg:
                          m.pricePerKg != null && m.pricePerKg > 0
                            ? m.pricePerKg
                            : ow > 0 && pp > 0
                              ? Math.round((pp / ow) * 100) / 100
                              : undefined,
                        purchaseDate: m.purchaseDate,
                      };
                    });
                })(),
              }
            : null
        }
        purchaseId={null}
      />
      {/* Start Processing Modal (legacy: from queue material) */}
      <StartProcessingModal
        open={showStartProcessingModal}
        onClose={() => {
          setShowStartProcessingModal(false);
          setSelectedMaterial(null);
        }}
        material={selectedMaterial}
        onStartBatch={handleStartBatch}
      />
    </div>
  );
}

export default ProcessingModule;