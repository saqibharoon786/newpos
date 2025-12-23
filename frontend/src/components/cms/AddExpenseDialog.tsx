import { useState, useEffect, useRef } from "react";
import { Save, Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
    purpose: "Car" as const,
    price: "",
    personResponsible: "HR" as const,
    usage: "Personal" as const,
    date: "",
    time: "",
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

  // Close dropdowns when clicking outside
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

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (editData) {
        // Populate form with edit data
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

        // Parse date from editData
        if (editData.date) {
          const dateParts = editData.date.split('/');
          if (dateParts.length === 3) {
            const date = new Date(
              parseInt(dateParts[2]),
              parseInt(dateParts[0]) - 1,
              parseInt(dateParts[1])
            );
            if (!isNaN(date.getTime())) {
              setSelectedDate(date);
              setCurrentMonth(date.getMonth());
              setCurrentYear(date.getFullYear());
            }
          }
        }

        // Parse time from editData
        if (editData.time) {
          const timeMatch = editData.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = timeMatch[2];
            const ampm = timeMatch[3]?.toUpperCase() || "PM";
            
            // Convert to 12-hour format for display
            if (ampm === 'PM' && hour > 12) hour -= 12;
            if (ampm === 'AM' && hour === 0) hour = 12;
            
            setSelectedHour(hour.toString().padStart(2, '0'));
            setSelectedMinute(minute);
            setSelectedAmPm(ampm as "AM" | "PM");
          }
        }
      } else {
        // Reset form for new entry
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
        setSelectedDate(null);
        setSelectedHour("12");
        setSelectedMinute("00");
        setSelectedAmPm("PM");
        const now = new Date();
        setCurrentMonth(now.getMonth());
        setCurrentYear(now.getFullYear());
      }
      setError("");
    }
  }, [open, editData]);

  // Update form data when selected date changes
  useEffect(() => {
    if (selectedDate) {
      const formattedDate = `${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}/${selectedDate.getDate().toString().padStart(2, '0')}/${selectedDate.getFullYear()}`;
      setFormData(prev => ({ ...prev, date: formattedDate }));
    }
  }, [selectedDate]);

  // Update form data when time changes
  useEffect(() => {
    let hour24 = parseInt(selectedHour);
    if (selectedAmPm === 'PM' && hour24 < 12) hour24 += 12;
    if (selectedAmPm === 'AM' && hour24 === 12) hour24 = 0;
    
    const formattedTime = `${hour24.toString().padStart(2, '0')}:${selectedMinute} ${selectedAmPm}`;
    setFormData(prev => ({ ...prev, time: formattedTime }));
  }, [selectedHour, selectedMinute, selectedAmPm]);

  // Calendar functions
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
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

  // Generate calendar days
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);
  const today = new Date();

  // Time options
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = ['00', '15', '30', '45'];

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
      onOpenChange(false);
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
                {/* Calendar Input */}
                <div className="relative flex-1" ref={calendarRef}>
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => setShowCalendar(!showCalendar)}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="mm/dd/yyyy"
                      value={formData.date}
                      className="w-full bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  
                  {/* Calendar Popup */}
                  {showCalendar && (
                    <div className="absolute z-50 mt-1 w-72 bg-background border border-border rounded-lg shadow-lg">
                      {/* Calendar Header */}
                      <div className="p-4 border-b border-border">
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={handlePrevMonth}
                            className="p-1 hover:bg-cms-input-bg rounded"
                          >
                            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                          </button>
                          <div className="text-sm font-semibold text-foreground">
                            {monthNames[currentMonth]} {currentYear}
                          </div>
                          <button
                            onClick={handleNextMonth}
                            className="p-1 hover:bg-cms-input-bg rounded"
                          >
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </button>
                        </div>
                        
                        {/* Today Button */}
                        <button
                          onClick={handleToday}
                          className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          Today
                        </button>
                      </div>

                      {/* Calendar Body */}
                      <div className="p-4">
                        {/* Day Headers */}
                        <div className="grid grid-cols-7 mb-2">
                          {dayNames.map(day => (
                            <div key={day} className="text-center text-xs text-muted-foreground font-medium">
                              {day}
                            </div>
                          ))}
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {/* Empty cells for days before first day of month */}
                          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                            <div key={`empty-${index}`} className="h-9" />
                          ))}

                          {/* Days of the month */}
                          {Array.from({ length: daysInMonth }).map((_, index) => {
                            const day = index + 1;
                            const isToday = today.getDate() === day && 
                                            today.getMonth() === currentMonth &&
                                            today.getFullYear() === currentYear;
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
                                    : 'hover:bg-cms-input-bg text-foreground'
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

                {/* Time Input */}
                <div className="relative" ref={timeRef}>
                  <div 
                    className="relative cursor-pointer"
                    onClick={() => setShowTimePicker(!showTimePicker)}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.time}
                      className="w-32 bg-cms-input-bg border border-border rounded-md px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Time Picker Popup */}
                  {showTimePicker && (
                    <div className="absolute z-50 mt-1 w-64 bg-background border border-border rounded-lg shadow-lg right-0">
                      <div className="p-4">
                        {/* Time Selection */}
                        <div className="flex items-start justify-between mb-4">
                          {/* Hours */}
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-2">Hour</div>
                            <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                              {hours.map(hour => (
                                <button
                                  key={hour}
                                  onClick={() => setSelectedHour(hour)}
                                  className={`py-2 text-sm rounded transition-colors ${
                                    selectedHour === hour 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'hover:bg-cms-input-bg text-foreground'
                                  }`}
                                >
                                  {hour}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Minutes */}
                          <div className="flex-1 ml-2">
                            <div className="text-xs text-muted-foreground mb-2">Minute</div>
                            <div className="grid grid-cols-2 gap-1">
                              {minutes.map(minute => (
                                <button
                                  key={minute}
                                  onClick={() => setSelectedMinute(minute)}
                                  className={`py-2 text-sm rounded transition-colors ${
                                    selectedMinute === minute 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'hover:bg-cms-input-bg text-foreground'
                                  }`}
                                >
                                  {minute}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* AM/PM Selector */}
                        <div className="flex border border-border rounded-md overflow-hidden">
                          <button
                            onClick={() => setSelectedAmPm('AM')}
                            className={`flex-1 py-2 text-sm transition-colors ${
                              selectedAmPm === 'AM' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-cms-input-bg text-foreground'
                            }`}
                          >
                            AM
                          </button>
                          <button
                            onClick={() => setSelectedAmPm('PM')}
                            className={`flex-1 py-2 text-sm transition-colors ${
                              selectedAmPm === 'PM' 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-cms-input-bg text-foreground'
                            }`}
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