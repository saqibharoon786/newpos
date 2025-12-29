const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: [true, 'Employee ID is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    title: {
        type: String,
        default: '',
        trim: true
    },
    department: {
        type: String,
        default: '',
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true
    },
    startTime: {
        type: String,
        default: '09:00'
    },
    endTime: {
        type: String,
        default: '17:00'
    },
    salary: {
        type: Number,
        required: [true, 'Salary is required'],
        min: [0, 'Salary cannot be negative']
    },
    avatar: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        default: '',
        trim: true
    },
    cnic: {
        type: String,
        unique: true,
        sparse: true, // Allows null values while maintaining uniqueness
        trim: true
    },
    dob: {
        type: Date
    },
    emergencyContact: {
        type: String,
        default: '',
        trim: true
    },
    reportingManager: {
        type: String,
        default: '',
        trim: true
    },
    hireDate: {
        type: Date,
        default: Date.now
    },
    responsibilities: {
        type: String,
        default: '',
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual property for schedule
employeeSchema.virtual('schedule').get(function() {
    return `${this.startTime || '09:00'} - ${this.endTime || '17:00'}`;
});

// Indexes for better query performance
employeeSchema.index({ employeeId: 1 });
employeeSchema.index({ email: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ name: 'text', email: 'text', employeeId: 'text' });

// Middleware to trim string fields
employeeSchema.pre('save', function(next) {
    const stringFields = ['name', 'title', 'department', 'email', 'phone', 'address', 'cnic', 'emergencyContact', 'reportingManager', 'responsibilities'];
    
    stringFields.forEach(field => {
        if (this[field] && typeof this[field] === 'string') {
            this[field] = this[field].trim();
        }
    });
    
    next();
});

module.exports = mongoose.model('Employee', employeeSchema);