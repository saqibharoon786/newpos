import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Save, Upload, Calendar, Clock, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import axios from "axios"

// Configure axios with environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"

// Use the environment variable to construct API endpoints
const PURCHASES_API_URL = `${API_BASE_URL}/api/purchases`
const API_ENDPOINTS = {
  ADD: `${PURCHASES_API_URL}/add`,
}

const colorOptions = [
  { name: "White", color: "bg-white", value: "#FFFFFF" },
  { name: "Yellow", color: "bg-yellow-400", value: "#FACC15" },
  { name: "Red", color: "bg-red-500", value: "#EF4444" },
  { name: "Orange", color: "bg-orange-500", value: "#F97316" },
  { name: "Green", color: "bg-green-500", value: "#22C55E" },
]

export default function AddPurchasePage() {
  const [formData, setFormData] = useState({
    materialName: "",
    vendor: "",
    price: "",
    weight: "",
    quality: "",
    purchaseDate: "",
    purchaseTime: "",
    materialColor: "#FFFFFF",
    vehicleName: "",
    vehicleType: "",
    vehicleNumber: "",
    driverName: "",
    vehicleColor: "#FFFFFF",
    deliveryDate: "",
    deliveryTime: "",
    receiptNo: "",
    vehicleImage: null as File | null,
  })

  const [selectedMaterialColor, setSelectedMaterialColor] = useState("#FFFFFF")
  const [selectedVehicleColor, setSelectedVehicleColor] = useState("#FFFFFF")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Date picker states
  const [showPurchaseCalendar, setShowPurchaseCalendar] = useState(false)
  const [showPurchaseTimePicker, setShowPurchaseTimePicker] = useState(false)
  const [showDeliveryCalendar, setShowDeliveryCalendar] = useState(false)
  const [showDeliveryTimePicker, setShowDeliveryTimePicker] = useState(false)
  
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedPurchaseDate, setSelectedPurchaseDate] = useState<Date | null>(null)
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<Date | null>(null)
  
  const [selectedPurchaseHour, setSelectedPurchaseHour] = useState("12")
  const [selectedPurchaseMinute, setSelectedPurchaseMinute] = useState("00")
  const [selectedPurchaseAmPm, setSelectedPurchaseAmPm] = useState<"AM" | "PM">("PM")
  
  const [selectedDeliveryHour, setSelectedDeliveryHour] = useState("12")
  const [selectedDeliveryMinute, setSelectedDeliveryMinute] = useState("00")
  const [selectedDeliveryAmPm, setSelectedDeliveryAmPm] = useState<"AM" | "PM">("PM")

  const purchaseCalendarRef = useRef<HTMLDivElement>(null)
  const purchaseTimeRef = useRef<HTMLDivElement>(null)
  const deliveryCalendarRef = useRef<HTMLDivElement>(null)
  const deliveryTimeRef = useRef<HTMLDivElement>(null)

  // Year dropdown states
  const [showYearDropdown, setShowYearDropdown] = useState(false)
  const years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (purchaseCalendarRef.current && !purchaseCalendarRef.current.contains(event.target as Node)) {
        setShowPurchaseCalendar(false)
        setShowYearDropdown(false)
      }
      if (purchaseTimeRef.current && !purchaseTimeRef.current.contains(event.target as Node)) {
        setShowPurchaseTimePicker(false)
      }
      if (deliveryCalendarRef.current && !deliveryCalendarRef.current.contains(event.target as Node)) {
        setShowDeliveryCalendar(false)
        setShowYearDropdown(false)
      }
      if (deliveryTimeRef.current && !deliveryTimeRef.current.contains(event.target as Node)) {
        setShowDeliveryTimePicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Initialize purchase date and time
  useEffect(() => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const dateStr = `${dd}/${mm}/${yyyy}`

    let hour = now.getHours()
    const minute = String(now.getMinutes()).padStart(2, '0')
    const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12

    const timeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`

    setFormData(prev => ({
      ...prev,
      purchaseDate: dateStr,
      purchaseTime: timeStr,
      deliveryDate: dateStr,
      deliveryTime: timeStr
    }))

    setSelectedPurchaseDate(now)
    setSelectedDeliveryDate(now)
    setSelectedPurchaseHour(hour12.toString().padStart(2, '0'))
    setSelectedPurchaseMinute(minute)
    setSelectedPurchaseAmPm(ampm)
    setSelectedDeliveryHour(hour12.toString().padStart(2, '0'))
    setSelectedDeliveryMinute(minute)
    setSelectedDeliveryAmPm(ampm)
  }, [])

  // Update form data when purchase date changes
  useEffect(() => {
    if (selectedPurchaseDate) {
      const dd = String(selectedPurchaseDate.getDate()).padStart(2, '0')
      const mm = String(selectedPurchaseDate.getMonth() + 1).padStart(2, '0')
      const yyyy = selectedPurchaseDate.getFullYear()
      setFormData(prev => ({ ...prev, purchaseDate: `${dd}/${mm}/${yyyy}` }))
    }
  }, [selectedPurchaseDate])

  // Update form data when delivery date changes
  useEffect(() => {
    if (selectedDeliveryDate) {
      const dd = String(selectedDeliveryDate.getDate()).padStart(2, '0')
      const mm = String(selectedDeliveryDate.getMonth() + 1).padStart(2, '0')
      const yyyy = selectedDeliveryDate.getFullYear()
      setFormData(prev => ({ ...prev, deliveryDate: `${dd}/${mm}/${yyyy}` }))
    }
  }, [selectedDeliveryDate])

  // Update form data when purchase time changes
  useEffect(() => {
    let h = parseInt(selectedPurchaseHour)
    if (selectedPurchaseAmPm === "PM" && h < 12) h += 12
    if (selectedPurchaseAmPm === "AM" && h === 12) h = 0

    const timeStr = `${h.toString().padStart(2, '0')}:${selectedPurchaseMinute} ${selectedPurchaseAmPm}`
    setFormData(prev => ({ ...prev, purchaseTime: timeStr }))
  }, [selectedPurchaseHour, selectedPurchaseMinute, selectedPurchaseAmPm])

  // Update form data when delivery time changes
  useEffect(() => {
    let h = parseInt(selectedDeliveryHour)
    if (selectedDeliveryAmPm === "PM" && h < 12) h += 12
    if (selectedDeliveryAmPm === "AM" && h === 12) h = 0

    const timeStr = `${h.toString().padStart(2, '0')}:${selectedDeliveryMinute} ${selectedDeliveryAmPm}`
    setFormData(prev => ({ ...prev, deliveryTime: timeStr }))
  }, [selectedDeliveryHour, selectedDeliveryMinute, selectedDeliveryAmPm])

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(y => y - 1)
    } else {
      setCurrentMonth(m => m - 1)
    }
    setShowYearDropdown(false)
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(y => y + 1)
    } else {
      setCurrentMonth(m => m + 1)
    }
    setShowYearDropdown(false)
  }

  const handleYearSelect = (year: number) => {
    setCurrentYear(year)
    setShowYearDropdown(false)
  }

  const handleDateSelect = (day: number, type: 'purchase' | 'delivery') => {
    const date = new Date(currentYear, currentMonth, day)
    if (type === 'purchase') {
      setSelectedPurchaseDate(date)
      setShowPurchaseCalendar(false)
    } else {
      setSelectedDeliveryDate(date)
      setShowDeliveryCalendar(false)
    }
    setShowYearDropdown(false)
  }

  const handleToday = (type: 'purchase' | 'delivery') => {
    const today = new Date()
    if (type === 'purchase') {
      setSelectedPurchaseDate(today)
    } else {
      setSelectedDeliveryDate(today)
    }
    setCurrentMonth(today.getMonth())
    setCurrentYear(today.getFullYear())
    if (type === 'purchase') {
      setShowPurchaseCalendar(false)
    } else {
      setShowDeliveryCalendar(false)
    }
    setShowYearDropdown(false)
  }

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const minutes = ['00', '15', '30', '45']

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.materialName.trim()) newErrors.materialName = "Material name is required"
    if (!formData.vendor.trim()) newErrors.vendor = "Vendor is required"
    if (!formData.price || Number.parseFloat(formData.price) <= 0) newErrors.price = "Valid price is required"
    if (!formData.weight || Number.parseFloat(formData.weight) <= 0) newErrors.weight = "Valid weight is required"
    if (!formData.quality) newErrors.quality = "Quality is required"
    if (!formData.purchaseDate) newErrors.purchaseDate = "Purchase date is required"
    if (!formData.vehicleName.trim()) newErrors.vehicleName = "Vehicle name is required"
    if (!formData.vehicleType.trim()) newErrors.vehicleType = "Vehicle type is required"
    if (!formData.vehicleNumber.trim()) newErrors.vehicleNumber = "Vehicle number is required"
    if (!formData.driverName.trim()) newErrors.driverName = "Driver name is required"
    if (!formData.deliveryDate) newErrors.deliveryDate = "Delivery date is required"
    if (!formData.receiptNo.trim()) newErrors.receiptNo = "Receipt number is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleQualityChange = (quality: string) => {
    setFormData((prev) => ({ ...prev, quality }))
    if (errors.quality) {
      setErrors((prev) => ({ ...prev, quality: "" }))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size should be less than 5MB")
        return
      }

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file")
        return
      }

      setFormData((prev) => ({ ...prev, vehicleImage: file }))
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const formDataToSend = new FormData()

      const fields = {
        materialName: formData.materialName,
        vendor: formData.vendor,
        price: formData.price,
        weight: formData.weight,
        quality: formData.quality,
        purchaseDate: formData.purchaseDate,
        purchaseTime: formData.purchaseTime,
        materialColor: selectedMaterialColor,
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: selectedVehicleColor,
        deliveryDate: formData.deliveryDate,
        deliveryTime: formData.deliveryTime,
        receiptNo: formData.receiptNo,
      }

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formDataToSend.append(key, String(value))
        }
      })

      if (formData.vehicleImage) {
        formDataToSend.append("vehicleImage", formData.vehicleImage)
      }

      const response = await axios.post(API_ENDPOINTS.ADD, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (response.data.success) {
        alert("Purchase added successfully!")
        resetForm()
      } else {
        throw new Error(response.data.message || "Failed to save purchase")
      }
    } catch (error: any) {
      console.error("Error saving purchase:", error)

      if (error.response) {
        const errorMessage = error.response.data?.message || "Failed to save purchase"
        const errors = error.response.data?.errors

        if (errors && Array.isArray(errors)) {
          alert(`Validation errors:\n${errors.join("\n")}`)
        } else if (errors && typeof errors === "object") {
          const errorList = Object.values(errors).flat().join("\n")
          alert(`Validation errors:\n${errorList}`)
        } else {
          alert(`Error: ${errorMessage}`)
        }
      } else if (error.request) {
        alert(`Network error. Please check if the backend server is running at ${API_BASE_URL}.`)
      } else {
        alert("Error: " + error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const dateStr = `${dd}/${mm}/${yyyy}`

    let hour = now.getHours()
    const minute = String(now.getMinutes()).padStart(2, '0')
    const ampm: "AM" | "PM" = hour >= 12 ? "PM" : "AM"
    const hour12 = hour % 12 || 12
    const timeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${ampm}`

    setFormData({
      materialName: "",
      vendor: "",
      price: "",
      weight: "",
      quality: "",
      purchaseDate: dateStr,
      purchaseTime: timeStr,
      materialColor: "#FFFFFF",
      vehicleName: "",
      vehicleType: "",
      vehicleNumber: "",
      driverName: "",
      vehicleColor: "#FFFFFF",
      deliveryDate: dateStr,
      deliveryTime: timeStr,
      receiptNo: "",
      vehicleImage: null,
    })
    
    setSelectedMaterialColor("#FFFFFF")
    setSelectedVehicleColor("#FFFFFF")
    setSelectedPurchaseDate(now)
    setSelectedDeliveryDate(now)
    setSelectedPurchaseHour(hour12.toString().padStart(2, '0'))
    setSelectedPurchaseMinute(minute)
    setSelectedPurchaseAmPm(ampm)
    setSelectedDeliveryHour(hour12.toString().padStart(2, '0'))
    setSelectedDeliveryMinute(minute)
    setSelectedDeliveryAmPm(ampm)
    
    setImagePreview(null)
    setErrors({})
    setShowYearDropdown(false)

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview)
    }
  }

  // Render calendar popup
  const renderCalendar = (type: 'purchase' | 'delivery') => {
    const showCalendar = type === 'purchase' ? showPurchaseCalendar : showDeliveryCalendar
    const calendarRef = type === 'purchase' ? purchaseCalendarRef : deliveryCalendarRef

    return showCalendar && (
      <div 
        ref={calendarRef}
        className="absolute z-[999] mt-1 w-80 bg-white border border-teal-600/50 rounded-lg shadow-2xl"
        style={{ 
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '4px',
        }}
      >
        <div className="p-4 border-b border-teal-600/50">
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={handlePrevMonth} 
              className="p-1 hover:bg-teal-100 rounded"
            >
              <ChevronLeft className="w-5 h-5 text-teal-700" />
            </button>
            
            <div className="flex items-center gap-1 relative">
              <div className="text-sm font-semibold text-teal-900 min-w-[100px] text-center">
                {monthNames[currentMonth]}
              </div>
              <button 
                onClick={() => setShowYearDropdown(!showYearDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-teal-900 hover:bg-teal-100 rounded"
              >
                {currentYear}
                <ChevronDown className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showYearDropdown && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-32 max-h-48 overflow-y-auto bg-white border border-teal-600/50 rounded-md shadow-lg z-10">
                  {years.map(year => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-teal-50 ${year === currentYear ? 'bg-teal-100 text-teal-700 font-semibold' : 'text-teal-900'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={handleNextMonth} 
              className="p-1 hover:bg-teal-100 rounded"
            >
              <ChevronRight className="w-5 h-5 text-teal-700" />
            </button>
          </div>
          <button
            onClick={() => handleToday(type)}
            className="w-full py-2 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700"
          >
            Today
          </button>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs text-teal-700 font-medium">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9" />
            ))}

            {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, index) => {
              const day = index + 1
              const isToday = new Date().getDate() === day && 
                              new Date().getMonth() === currentMonth &&
                              new Date().getFullYear() === currentYear
              const selectedDate = type === 'purchase' ? selectedPurchaseDate : selectedDeliveryDate
              const isSelected = selectedDate && 
                                selectedDate.getDate() === day &&
                                selectedDate.getMonth() === currentMonth &&
                                selectedDate.getFullYear() === currentYear

              return (
                <button
                  key={day}
                  onClick={() => handleDateSelect(day, type)}
                  className={`
                    h-9 flex items-center justify-center text-sm rounded-md transition-colors
                    ${isSelected 
                      ? 'bg-teal-600 text-white' 
                      : isToday 
                      ? 'bg-teal-100 text-teal-700 font-semibold' 
                      : 'hover:bg-teal-50 text-teal-900'
                    }
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Render time picker popup
  const renderTimePicker = (type: 'purchase' | 'delivery') => {
    const showTimePicker = type === 'purchase' ? showPurchaseTimePicker : showDeliveryTimePicker
    const timeRef = type === 'purchase' ? purchaseTimeRef : deliveryTimeRef
    const selectedHour = type === 'purchase' ? selectedPurchaseHour : selectedDeliveryHour
    const selectedMinute = type === 'purchase' ? selectedPurchaseMinute : selectedDeliveryMinute
    const selectedAmPm = type === 'purchase' ? selectedPurchaseAmPm : selectedDeliveryAmPm
    const setSelectedHour = type === 'purchase' ? setSelectedPurchaseHour : setSelectedDeliveryHour
    const setSelectedMinute = type === 'purchase' ? setSelectedPurchaseMinute : setSelectedDeliveryMinute
    const setSelectedAmPm = type === 'purchase' ? setSelectedPurchaseAmPm : setSelectedDeliveryAmPm

    return showTimePicker && (
      <div 
        ref={timeRef}
        className="absolute z-[999] mt-1 w-64 bg-white border border-teal-600/50 rounded-lg shadow-2xl right-0"
      >
        <div className="p-4">
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="text-xs text-teal-700 mb-2">Hour</div>
              <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto">
                {hours.map(h => (
                  <button
                    key={h}
                    onClick={() => setSelectedHour(h)}
                    className={`py-1.5 text-sm rounded ${selectedHour === h ? 'bg-teal-600 text-white' : 'hover:bg-teal-50 text-teal-900'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-xs text-teal-700 mb-2">Minute</div>
              <div className="grid grid-cols-2 gap-1">
                {minutes.map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedMinute(m)}
                    className={`py-1.5 text-sm rounded ${selectedMinute === m ? 'bg-teal-600 text-white' : 'hover:bg-teal-50 text-teal-900'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex border border-teal-600/50 rounded overflow-hidden">
            <button
              onClick={() => setSelectedAmPm("AM")}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "AM" ? "bg-teal-600 text-white" : "hover:bg-teal-50 text-teal-900"}`}
            >
              AM
            </button>
            <button
              onClick={() => setSelectedAmPm("PM")}
              className={`flex-1 py-2 text-sm ${selectedAmPm === "PM" ? "bg-teal-600 text-white" : "hover:bg-teal-50 text-teal-900"}`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800">
      {/* Header with breadcrumb */}
      <div className="bg-teal-800/60 px-6 py-3 border-b border-teal-700/50">
        <p className="text-xs text-white/80">Point Of Purchase / Add Purchase</p>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Title Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Add New Purchasesss</h1>
          <p className="text-sm text-white/80">Enter the details for the new asset purchase and delivery</p>
        </div>

        {/* Product Details Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Product Details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Material Name</label>
              <input
                type="text"
                name="materialName"
                placeholder="e.g Steel Beams"
                value={formData.materialName}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.materialName ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.materialName && <p className="text-xs text-red-300 mt-1">{errors.materialName}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Vendor</label>
              <input
                type="text"
                name="vendor"
                placeholder="e.g Acme Lnc."
                value={formData.vendor}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.vendor ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.vendor && <p className="text-xs text-red-300 mt-1">{errors.vendor}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Price( Rupees)</label>
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                placeholder="e.g 10,000"
                value={formData.price}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.price ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.price && <p className="text-xs text-red-300 mt-1">{errors.price}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Weight</label>
              <input
                type="number"
                name="weight"
                min="0"
                step="0.1"
                placeholder="e.g 500"
                value={formData.weight}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.weight ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.weight && <p className="text-xs text-red-300 mt-1">{errors.weight}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Quality</label>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    name="quality"
                    checked={formData.quality === "PP750"}
                    onChange={() => handleQualityChange("PP750")}
                    className="w-4 h-4 rounded border-teal-500 bg-teal-700/50 text-teal-400 focus:ring-teal-400 focus:ring-offset-0"
                  />
                  PP750
                </label>
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input
                    type="checkbox"
                    name="quality"
                    checked={formData.quality === "PP1000"}
                    onChange={() => handleQualityChange("PP1000")}
                    className="w-4 h-4 rounded border-teal-500 bg-teal-700/50 text-teal-400 focus:ring-teal-400 focus:ring-offset-0"
                  />
                  PP1000
                </label>
              </div>
              {errors.quality && <p className="text-xs text-red-300 mt-1">{errors.quality}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Purchase Date & Time</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowPurchaseCalendar(prev => !prev)
                      setShowPurchaseTimePicker(false)
                      setShowYearDropdown(false)
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.purchaseDate}
                      className={`w-full bg-teal-700/50 border ${errors.purchaseDate ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer select-none`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                  </div>
                  {renderCalendar('purchase')}
                </div>
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowPurchaseTimePicker(prev => !prev)
                      setShowPurchaseCalendar(false)
                      setShowYearDropdown(false)
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.purchaseTime}
                      className="w-full bg-teal-700/50 border border-teal-600/50 rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer select-none"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                  </div>
                  {renderTimePicker('purchase')}
                </div>
              </div>
              {errors.purchaseDate && <p className="text-xs text-red-300 mt-1">{errors.purchaseDate}</p>}
            </div>
          </div>

          {/* Material Color */}
          <div className="mb-4">
            <label className="block text-xs text-white/90 mb-2">Material Color</label>
            <div className="flex items-center gap-3">
              {colorOptions.map((color) => (
                <label
                  key={color.value}
                  className="flex items-center gap-2 cursor-pointer bg-teal-700/40 px-3 py-2 rounded-full border border-teal-600/50"
                >
                  <input
                    type="radio"
                    name="materialColor"
                    value={color.value}
                    checked={selectedMaterialColor === color.value}
                    onChange={() => setSelectedMaterialColor(color.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-6 h-6 rounded-full ${color.color} border-2 ${selectedMaterialColor === color.value ? "ring-2 ring-white ring-offset-2 ring-offset-teal-700" : "border-white/30"}`}
                  />
                  <span className="text-xs text-white font-medium">{color.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Delivery Vehicle Details Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Delivery Vehicle Details</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Vehicle Name</label>
              <input
                type="text"
                name="vehicleName"
                placeholder="e.g Heavy Truck"
                value={formData.vehicleName}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.vehicleName ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.vehicleName && <p className="text-xs text-red-300 mt-1">{errors.vehicleName}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Vehicle Type</label>
              <input
                type="text"
                name="vehicleType"
                placeholder="e.g Truck"
                value={formData.vehicleType}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.vehicleType ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.vehicleType && <p className="text-xs text-red-300 mt-1">{errors.vehicleType}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Vehicle Number</label>
              <input
                type="text"
                name="vehicleNumber"
                placeholder="e.g MS-12_Ab"
                value={formData.vehicleNumber}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.vehicleNumber ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.vehicleNumber && <p className="text-xs text-red-300 mt-1">{errors.vehicleNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Driver Name</label>
              <input
                type="text"
                name="driverName"
                placeholder="e.g Smith"
                value={formData.driverName}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.driverName ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.driverName && <p className="text-xs text-red-300 mt-1">{errors.driverName}</p>}
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Vehicle Color</label>
              <div className="flex items-center gap-2 bg-teal-700/50 border border-teal-600/50 rounded-md px-3 py-2">
                <div
                  className="w-6 h-6 rounded border-2 border-white/50"
                  style={{ backgroundColor: selectedVehicleColor }}
                />
                <input
                  type="text"
                  value={selectedVehicleColor}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-white focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Delivery Date & Time</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowDeliveryCalendar(prev => !prev)
                      setShowDeliveryTimePicker(false)
                      setShowYearDropdown(false)
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="dd/mm/yyyy"
                      value={formData.deliveryDate}
                      className={`w-full bg-teal-700/50 border ${errors.deliveryDate ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer select-none`}
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                  </div>
                  {renderCalendar('delivery')}
                </div>
                <div className="relative flex-1">
                  <div 
                    className="relative cursor-pointer select-none touch-manipulation"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowDeliveryTimePicker(prev => !prev)
                      setShowDeliveryCalendar(false)
                      setShowYearDropdown(false)
                    }}
                  >
                    <input
                      type="text"
                      readOnly
                      placeholder="-- : --"
                      value={formData.deliveryTime}
                      className="w-full bg-teal-700/50 border border-teal-600/50 rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer select-none"
                    />
                    <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                  </div>
                  {renderTimePicker('delivery')}
                </div>
              </div>
              {errors.deliveryDate && <p className="text-xs text-red-300 mt-1">{errors.deliveryDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-white/90 mb-1.5">Receipt No.</label>
              <input
                type="text"
                name="receiptNo"
                placeholder="e.g AB1232"
                value={formData.receiptNo}
                onChange={handleInputChange}
                className={`w-full bg-teal-700/50 border ${errors.receiptNo ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
              />
              {errors.receiptNo && <p className="text-xs text-red-300 mt-1">{errors.receiptNo}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-white/90 mb-1.5">Vehicle Image Upload</label>
              <label className="flex items-center gap-2 px-4 py-2.5 bg-teal-700/50 border border-teal-600/50 rounded-md cursor-pointer hover:bg-teal-700/70 transition-colors">
                <Upload className="w-4 h-4 text-white" />
                <span className="text-sm text-white">Choose file...</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
              {imagePreview && (
                <div className="mt-2 relative w-24 h-24 border-2 border-teal-500 rounded-md overflow-hidden">
                  <img
                    src={imagePreview || "/placeholder.svg"}
                    alt="Vehicle preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={resetForm}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}