

import type React from "react"

import { useState } from "react"
import { Save, Upload, Calendar, Clock } from "lucide-react"
import axios from "axios"

// Configure axios with correct API endpoints
const API_BASE_URL = "http://localhost:5000/api/purchases"

const API_ENDPOINTS = {
  ADD: `${API_BASE_URL}/add`,
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
        materialColor: selectedMaterialColor,
        vehicleName: formData.vehicleName,
        vehicleType: formData.vehicleType,
        vehicleNumber: formData.vehicleNumber,
        driverName: formData.driverName,
        vehicleColor: selectedVehicleColor,
        deliveryDate: formData.deliveryDate,
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

      const response = await axios.post(API_ENDPOINTS.ADD, formDataToSend)

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
        alert("Network error. Please check if the backend server is running on port 5000.")
      } else {
        alert("Error: " + error.message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
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
      vehicleImage: null,
    })
    setSelectedMaterialColor("#FFFFFF")
    setSelectedVehicleColor("#FFFFFF")
    setImagePreview(null)
    setErrors({})

    if (imagePreview && imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview)
    }
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
          <h1 className="text-3xl font-bold text-white mb-2">Add New Purchase</h1>
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
                  <input
                    type="text"
                    name="purchaseDate"
                    placeholder="mm/dd/yyyy"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                    onFocus={(e) => (e.target.type = "date")}
                    onBlur={(e) => !e.target.value && (e.target.type = "text")}
                    className={`w-full bg-teal-700/50 border ${errors.purchaseDate ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    name="purchaseTime"
                    placeholder="-- : --"
                    value={formData.purchaseTime}
                    onChange={handleInputChange}
                    onFocus={(e) => (e.target.type = "time")}
                    onBlur={(e) => !e.target.value && (e.target.type = "text")}
                    className="w-full bg-teal-700/50 border border-teal-600/50 rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
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
                  <input
                    type="text"
                    name="deliveryDate"
                    placeholder="mm/dd/yyyy"
                    value={formData.deliveryDate}
                    onChange={handleInputChange}
                    onFocus={(e) => (e.target.type = "date")}
                    onBlur={(e) => !e.target.value && (e.target.type = "text")}
                    className={`w-full bg-teal-700/50 border ${errors.deliveryDate ? "border-red-400" : "border-teal-600/50"} rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400`}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
                </div>
                <div className="relative flex-1">
                  <input
                    type="text"
                    name="deliveryTime"
                    placeholder="-- : --"
                    value={formData.deliveryTime}
                    onChange={handleInputChange}
                    onFocus={(e) => (e.target.type = "time")}
                    onBlur={(e) => !e.target.value && (e.target.type = "text")}
                    className="w-full bg-teal-700/50 border border-teal-600/50 rounded-md px-3 py-2.5 pr-10 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
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
