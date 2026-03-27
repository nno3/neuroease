/**
 * Request validation middleware using Yup – register, login, reminder, patient registration.
 * Validators run before controllers; 400 with message on failure.
 */
const yup = require('yup');

/** Upper, lower, digit, any non-alphanumeric; 8–128 chars. Allows # and other common symbols. */
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
const PASSWORD_STRENGTH_MESSAGE =
    'Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. ! @ # $ %)';

/** Shared email validator: trim, lowercase, format check */
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
        .matches(PASSWORD_STRENGTH_REGEX, PASSWORD_STRENGTH_MESSAGE)
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
                    return PASSWORD_STRENGTH_MESSAGE;
                }
                return msg;
            });

            const primaryMessage = cleanedErrors[0] || 'Validation failed';
            return res.status(400).json({
                success: false,
                message: primaryMessage,
                errors: cleanedErrors
            });
        }
    };
};

const patientRegistrationSchema = yup.object({
    email: customEmailValidator,
    name: yup.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .matches(
            /^[A-Za-zÀ-ÿ\s\-'.]+$/,
            'Name must contain only letters, spaces, hyphens, apostrophes, and periods'
        )
        .required('Name is required'),
    dateOfBirth: yup
        .date()
        .nullable()
        .typeError("Enter a valid date of birth")
        .required("Date of birth is required")
        .max(new Date(), "Date of birth cannot be in the future")
        .min(new Date("1900-01-01"), "Date of birth must be after 01/01/1900"),

    emergencyContact: yup.string().max(500, 'Emergency contact too long').nullable(),

    emergencyContactName: yup.string().max(255, 'Emergency contact name too long').nullable(),
    emergencyContactRelationship: yup.string().max(100, 'Relationship too long').nullable(),
    emergencyContactPhone: yup.string().max(50, 'Emergency contact phone too long').nullable(),

    preferredCommunication: yup.string().max(50, 'Preferred communication too long').nullable(),
    careNotes: yup.string().max(2000, 'Care notes too long').nullable(),

    address: yup
        .string()
        .required("Address is required")
        .min(2, "Address must be at least 2 characters")
        .max(500, "Address too long"),

    gender: yup.string().max(50, 'Gender too long').nullable(),

    medicalHistory: yup.object().shape({
        diagnosis: yup.string().max(255, 'Diagnosis too long').nullable(),
        diagnosisDate: yup.string().max(30, 'Diagnosis date too long').nullable(),
        stageSeverity: yup.string().max(100, 'Stage too long').nullable(),
        primaryConsultant: yup.string().max(255, 'Primary consultant too long').nullable(),
        currentMedications: yup.string().max(1000, 'Current medications too long').nullable(),
        medications: yup.array().of(
            yup.object().shape({
                name: yup.string().required('Medication name is required').max(200, 'Medication name too long'),
                dosage: yup.string().max(100, 'Dosage too long').nullable(),
                frequency: yup.string().max(100, 'Frequency too long').nullable(),
            })
        ).nullable(),
        chronicConditions: yup.mixed().test('chronic-conditions', 'Invalid chronic conditions', function (value) {
            if (value == null) return true;
            if (typeof value === 'string') return value.length <= 2000;
            if (Array.isArray(value)) {
                return value.every(item =>
                    item && typeof item === 'object' &&
                    (item.diagnosis == null || typeof item.diagnosis === 'string') &&
                    (item.diagnosedDate == null || typeof item.diagnosedDate === 'string') &&
                    (item.dateNotApplicable == null || typeof item.dateNotApplicable === 'boolean')
                );
            }
            return false;
        }).nullable(),
        surgicalHistory: yup.string().max(1000, 'Surgical history too long').nullable(),
        hospitalizations: yup.string().max(1000, 'Hospitalizations too long').nullable(),
        previousMedications: yup.string().max(1000, 'Previous medications too long').nullable(),
        allergies: yup.string().max(1000, 'Allergies too long').nullable(),
        familyHistory: yup.string().max(1000, 'Family history too long').nullable(),
        lifestyleFactors: yup.string().max(1000, 'Lifestyle factors too long').nullable(),
        immunizations: yup.string().max(1000, 'Immunizations too long').nullable(),
    }).default(undefined).nullable(),

    medicalConditions: yup.string().max(2000, 'Medical conditions description too long').nullable(),
})
    .test("emergency-contact-required", "Emergency contact is required: provide Contact Name and Contact Phone, or legacy emergency contact text", function (obj) {
        const name = String(obj?.emergencyContactName ?? "").trim();
        const phone = String(obj?.emergencyContactPhone ?? "").trim();
        const digits = phone.replace(/\D/g, "");
        const legacy = String(obj?.emergencyContact ?? "").trim();
        if (name.length >= 2 && digits.length >= 7) return true;
        if (legacy) {
            const msg = validateEmergencyContacts(legacy);
            return !msg;
        }
        return false;
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