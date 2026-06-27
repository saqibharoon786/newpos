import { useState, useEffect, useRef } from "react";
import { Save, Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import api from "@/lib/api";

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
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [formData, setFormData] = useState({
    description: "",
    purpose: "Office",
    price: "",
    personResponsible: "HR" as const,
    usage: "Company" as const,
    date: "",
    time: "",
    paymentMethod: "drawer",
    category: "General",
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState("12");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedAmPm, setSelectedAmPm] = useState<"AM" | "PM">("PM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const calendarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
      if (timeRef.current && !timeRef.current.contains(event.target as Node)) {
        setShowTimePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      api.get('/api/expense-categories').then((r) => setCategories(r.data.data || [])).catch(() => {});
      const now = new Date();

      if (editData) {
        setFormData({
          description: editData.description || "",
          purpose: editData.purpose || "Car",
          price: editData.price || "",
          personResponsible: editData.personResponsible || "HR",
          usage: editData.usage || "Personal",
          date: editData.date || "",
          time: editData.time || "",
        });

        if (editData.date) {
          const [dd, mm, yyyy] = editData.date.split('/').map(Number);
          if (dd && mm && yyyy) {
            const parsed = new Date(yyyy, mm - 1, dd);
            if (!isNaN(parsed.getTime())) {
              setSelectedDate(parsed);
              setCurrentMonth(parsed.getMonth());
              setCurrentYear(parsed.getFullYear());
            }
          }
        }

        if (editData.time) {
          const match = editData.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1]);
            const m = match[2];
            let ampm = (match[3] || "PM").toUpperCase() as "AM" | "PM";

            if (ampm === "PM" && h < 12) h += 12;
            if (ampm === "AM" && h === 12) h = 0;

            const hour12 = (h % 12) || 12;
            setSelectedHour(hour12.toString().padStart(2, '0'));
            setSelectedMinute(m);
            setSelectedAmPm(ampm);
          }
        }
      } else {
        let hour = now.getHours();
        const minute = String(now.getMinutes()).padStart(2, '0');
        const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        const timeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`;
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const todayStr = `${dd}/${mm}/${yyyy}`;

        setFormData({
          description: "",
          purpose: "Office",
          price: "",
          personResponsible: "HR",
          usage: "Company",
          date: todayStr,
          time: timeStr,
          paymentMethod: "drawer",
          category: "General",
        });

        setSelectedDate(now);
        setCurrentMonth(now.getMonth());
        setCurrentYear(now.getFullYear());
        setSelectedHour(hour12.toString().padStart(2, '0'));
        setSelectedMinute(minute);
        setSelectedAmPm(ampm);
      }

      setError("");
    }
  }, [open, editData]);

  useEffect(() => {
    if (selectedDate) {
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const yyyy = selectedDate.getFullYear();
      setFormData(prev => ({ ...prev, date: `${dd}/${mm}/${yyyy}` }));
    }
  }, [selectedDate]);

  useEffect(() => {
    const timeStr = `${selectedHour}:${selectedMinute} ${selectedAmPm}`;
    setFormData(prev => ({ ...prev, time: timeStr }));
  }, [selectedHour, selectedMinute, selectedAmPm]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setShowCalendar(false);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.description.trim()) return setError("Description likhna zaroori hai");
    if (!formData.price.trim()) return setError("Price dalna zaroori hai");
    if (!formData.date.trim()) return setError("Date select karen");
    if (!formData.time.trim()) return setError("Time select karen");

    setLoading(true);
    setError("");

    try {
      await onSave(formData);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Save nahi ho paya, dobara try karen");
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Category / Purpose</label>
                <div className="relative">
                  <select
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {categories.length ? categories.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    )) : (
                      <>
                        <option value="Electricity">Electricity</option>
                        <option value="Rent">Rent</option>
                        <option value="LPG Gas">LPG Gas</option>
                        <option value="Office">Office</option>
                      </>
                    )}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Payment From</label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 text-sm"
                >
                  <option value="drawer">Cash Drawer</option>
                  <option value="bank">Bank</option>
                  <option value="easypaisa">Easypaisa</option>
                  <option value="jazzcash">JazzCash</option>
                </select>
              </div>
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

            {/* Date & Time – Yeh section ab jump nahi karega */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Date & Time *</label>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={calendarRef}>
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowCalendar(prev => !prev);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.date}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>

                {showCalendar && (
  <div 
    className="absolute z-[999] mt-1 w-80 bg-background border border-border rounded-lg shadow-2xl" // width badhaya hai w-72 se w-80
    style={{ 
      top: '100%',
      left: 0,
      marginTop: '4px',
    }}
  >
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrevMonth} className="p-1 hover:bg-muted rounded">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <div className="flex items-center gap-2">
          {/* ✅ Month Display */}
          <div className="text-sm font-semibold text-foreground">
            {monthNames[currentMonth]}
          </div>
          
          {/* ✅ ADDED: Year Dropdown */}
          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="text-sm font-semibold text-foreground bg-cms-input-bg border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Array.from({ length: 21 }, (_, i) => {
              const year = new Date().getFullYear() - 10 + i;
              return (
                <option key={year} value={year}>
                  {year}
                </option>
              );
            })}
          </select>
        </div>
        
        <button onClick={handleNextMonth} className="p-1 hover:bg-muted rounded">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      
      <button
        onClick={handleToday}
        className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Today
      </button>
    </div>

    <div className="p-4">
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs text-muted-foreground font-medium">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}

        {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, index) => {
          const day = index + 1;
          const isToday = new Date().getDate() === day && 
                          new Date().getMonth() === currentMonth &&
                          new Date().getFullYear() === currentYear;
          const isSelected = selectedDate && 
                            selectedDate.getDate() === day &&
                            selectedDate.getMonth() === currentMonth &&
                            selectedDate.getFullYear() === currentYear;

          return (
            <button
              key={day}
              onClick={() => handleDateSelect(day)}
              className={`
                h-9 flex items-center justify-center text-sm rounded-md transition-colors
                ${isSelected 
                  ? 'bg-primary text-primary-foreground' 
                  : isToday 
                  ? 'bg-blue-100 text-blue-600 font-semibold' 
                  : 'hover:bg-muted text-foreground'
                }
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  </div>
)}
                </div>

                {/* Time picker wahi rahega – agar isme bhi jump ho to bata dena */}
                <div className="relative" ref={timeRef}>
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimePicker(prev => !prev);
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.time}
                      className="w-32 bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer select-none"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>

                  {/* Time picker popup – same structure */}
                  {showTimePicker && (
                    <div className="absolute z-[999] mt-1 w-64 bg-background border border-border rounded-lg shadow-2xl right-0">
                      {/* time picker content same rahega – yahan change ki zarurat nahi */}
                      <div className="p-4">
                        <div className="flex gap-3 mb-4">
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-2">Hour</div>
                            <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                              {hours.map(h => (
                                <button
                                  key={h}
                                  onClick={() => setSelectedHour(h)}
                                  className={`py-1.5 text-sm rounded ${selectedHour === h ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                                >
                                  {h}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-2">Minute</div>
                            <div className="grid grid-cols-2 gap-1">
                              {minutes.map(m => (
                                <button
                                  key={m}
                                  onClick={() => setSelectedMinute(m)}
                                  className={`py-1.5 text-sm rounded ${selectedMinute === m ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex border rounded overflow-hidden">
                          <button
                            onClick={() => setSelectedAmPm("AM")}
                            className={`flex-1 py-2 text-sm ${selectedAmPm === "AM" ? "bg-primary text-white" : "hover:bg-muted"}`}
                          >
                            AM
                          </button>
                          <button
                            onClick={() => setSelectedAmPm("PM")}
                            className={`flex-1 py-2 text-sm ${selectedAmPm === "PM" ? "bg-primary text-white" : "hover:bg-muted"}`}
                          >
                            PM
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

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