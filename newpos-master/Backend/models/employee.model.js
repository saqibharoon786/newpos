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
    // ADDED: CNIC Front Image
    cnicFrontImage: {
        type: String,
        default: ''
    },
    // ADDED: CNIC Back Image
    cnicBackImage: {
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
    /** Outstanding advance owed by employee (synced from financeLedger) */
    advancePayment: {
        type: Number,
        default: 0,
        min: [0, 'Advance payment cannot be negative']
    },
    /** Finance-linked advance, repayment & salary records */
    financeLedger: [
        {
            date: { type: Date, default: Date.now },
            type: {
                type: String,
                enum: ['advance', 'repayment', 'salary_payment'],
                required: true,
            },
            amount: { type: Number, required: true, min: 0 },
            method: {
                type: String,
                enum: ['drawer', 'easypaisa', 'jazzcash', 'bank'],
            },
            description: { type: String, default: '' },
            reference: { type: String, default: '' },
            transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
            grossSalary: { type: Number, default: 0 },
            advanceDeducted: { type: Number, default: 0 },
            netPaid: { type: Number, default: 0 },
        },
    ],
    /** How employee repays advance: self_pay = khud deposit, salary_deduct = salary se cut */
    advanceRecoveryMode: {
        type: String,
        enum: ['self_pay', 'salary_deduct'],
        default: 'salary_deduct',
    },
    /** Monthly amount to deduct from salary when advanceRecoveryMode is salary_deduct */
    monthlyAdvanceDeduction: {
        type: Number,
        default: 0,
        min: [0, 'Monthly deduction cannot be negative'],
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
employeeSchema.virtual('schedule').get(function () {
    return `${this.startTime || '09:00'} - ${this.endTime || '17:00'}`;
});

// Indexes for better query performance (employeeId/email already unique on schema)
employeeSchema.index({ department: 1 });
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ name: 'text', email: 'text', employeeId: 'text' });

// Middleware to trim string fields
employeeSchema.pre('save', function (next) {
    const stringFields = ['name', 'title', 'department', 'email', 'phone', 'address', 'cnic', 'emergencyContact', 'reportingManager', 'responsibilities'];

    stringFields.forEach(field => {
        if (this[field] && typeof this[field] === 'string') {
            this[field] = this[field].trim();
        }
    });

    next();
});

module.exports = mongoose.model('Employee', employeeSchema);