const yup = require('yup');
/**
 * Validation schema for user registration.
 * Ensures email, password, name and userType all meet the expected format.
 */
const customEmailValidator = yup
    .string()
    .transform((value) => (value ? value.trim().toLowerCase() : value))
    .test('is-email', 'Please enter a valid email address', (value) => {
        if (!value) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    })
    .required('Email is required');

const registerSchema = yup.object({
    email: customEmailValidator,
    password: yup.string()
        .min(8, 'Password must be at least 8 characters long')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
        )
        .required('Password is required'),
    name: yup.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .required('Name is required'),
    userType: yup.string()
        .oneOf(['caregiver', 'patient'], 'User type must be either caregiver or patient')
        .required('User type is required')
});

const loginSchema = yup.object({
    email: customEmailValidator,
    password: yup.string().required('Password is required')
});

/**
 * Multi-contact validator:
 * Each line must be like: "Name - 07..." (allows -, :, — etc.)
 */
function validateEmergencyContacts(value) {
    if (value == null) return "Emergency contact is required.";
    const v = String(value).trim();
    if (!v) return "Emergency contact is required.";

    // Split by lines: one contact per line
    const lines = v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return "Emergency contact is required.";

    if (lines.length > 10) return "Too many contacts (max 10).";

    for (const line of lines) {
        // allow separators: -, —, :, etc.
        const parts = line.split(/[:\-–—]/);
        if (parts.length < 2) return "Each contact must be in 'Name - Number' format.";

        const name = parts[0].trim();
        const phone = parts.slice(1).join("-").trim();

        if (name.length < 2) return "Contact name is too short.";
        if (name.length > 50) return "Contact name is too long.";

        // phone-ish: digits + + - spaces ()
        if (!/^[0-9+\-\s()]+$/.test(phone)) return "Phone number contains invalid characters.";
        // must include at least 7 digits
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 7) return "Phone number must contain at least 7 digits.";
        if (digits.length > 20) return "Phone number is too long.";
    }

    // optional overall length guard
    if (v.length > 500) return "Emergency contacts too long (max 500 characters).";

    return null;
}


const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.validate(req.body, {
                abortEarly: false,
                stripUnknown: true
            });
            next();
        } catch (error) {
            console.log('Yup validation error details:', {
                message: error.message,
                errors: error.errors,
                inner: error.inner
            });

            let errorMessages = [];

            // Check if error has inner errors (Yup's structure)
            if (error.inner && error.inner.length > 0) {
                errorMessages = error.inner.map(err => {
                    // Extract the custom message if available
                    return err.message || err.errors?.[0] || 'Validation failed';
                });
            } else if (error.errors) {
                errorMessages = error.errors;
            } else {
                errorMessages = [error.message];
            }

            // Clean up any remaining Yup default messages
            const cleanedErrors = errorMessages.map(msg => {
                if (msg.includes('isEmail') || msg.includes('email must be a valid email')) {
                    return 'Please enter a valid email address';
                }
                if (msg.includes('password must match')) {
                    return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)';
                }
                return msg;
            });

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: cleanedErrors
            });
        }
    };
};

const patientRegistrationSchema = yup.object({
    email: customEmailValidator,
    password: yup.string()
        .min(8, 'Password must be at least 8 characters long')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'
        )
        .required('Password is required'),
    name: yup.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .required('Name is required'),
    // changed dob so its required
    dateOfBirth: yup
        .date()
        .nullable()
        .typeError("Enter a valid date of birth")
        .required("Date of birth is required")
        .max(new Date(), "Date of birth cannot be in the future")
        .min(new Date("1900-01-01"), "Date of birth must be after 01/01/1900"),

    // multi-line emergency contact validation
    emergencyContact: yup
        .string()
        .required("Emergency contact is required")
        .test("emergency-contacts", function (value) {
            const msg = validateEmergencyContacts(value);
            return msg ? this.createError({ message: msg }) : true;
        }),
    medicalConditions: yup.string().max(500, 'Medical conditions description too long')
});

const reminderSchema = yup.object({
    patientId: yup.number().required('Patient ID is required'),
    title: yup.string().required('Title is required'),
    message: yup.string().required('Message is required'),
    reminderType: yup.string()
        .oneOf(['medication', 'appointment', 'general'], 'Reminder type must be medication, appointment, or general')
        .required('Reminder type is required'),
    scheduledTime: yup.date().required('Scheduled time is required'),
    recurrence: yup.string()
        .oneOf(['once', 'daily', 'weekly'], 'Recurrence must be once, daily, or weekly')
        .default('once')
});

module.exports = {
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema),
    validatePatientRegistration: validate(patientRegistrationSchema),
    validateReminder: validate(reminderSchema)
};