// Import Yup for schema-based validation of request bodies
/**Yup was adopted as a schema-based validation library to enforce consistent and robust
 * input validation on the backend. Instead of scattering manual if checks throughout*/
const yup = require('yup');
/**
 * Validation schema for user registration.
 * Ensures email, password, name and userType all meet the expected format.
 */
const registerSchema = yup.object({
    email: yup.string().email('Please enter a valid email address').required('Email is required'),
    password: yup.string()
        .min(8, 'Password must be at least 8 characters long')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one number'
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

/**
 * Validation schema for user login.
 * Only checks presence/format of email and password.
 */
const loginSchema = yup.object({
    email: yup.string().email().required(),
    password: yup.string().required()
});

/**
 * Generic validation middleware factory.
 * Takes a Yup schema and returns an Express middleware that:
 *  - Validates req.body against the schema
 *  - If valid, calls next()
 *  - If invalid, returns 400 with a list of error messages
 */
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.validate(req.body, { abortEarly: false });    // abortEarly: false => collect all validation errors, not just the first one
            next();
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: error.errors
            });
        }
    };
};

const patientRegistrationSchema = yup.object({
    email: yup.string().email('Please enter a valid email address').required('Email is required'),
    password: yup.string()
        .min(8, 'Password must be at least 8 characters long')
        .matches(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        )
        .required('Password is required'),
    name: yup.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name cannot exceed 50 characters')
        .required('Name is required'),
    dateOfBirth: yup.date().nullable(),
    emergencyContact: yup.string().max(20, 'Emergency contact too long'),
    medicalConditions: yup.string().max(500, 'Medical conditions description too long')
});

// Reminder Validation
const reminderSchema = yup.object({
    patientId: yup.number().required('Patient ID is required'),
    title: yup.string().required('Title is required'),
    message: yup.string().required('Message is required'),
    reminderType: yup.string().oneOf(['medication', 'appointment', 'general']).required('Reminder type is required'),
    scheduledTime: yup.date().required('Scheduled time is required'),
    recurrence: yup.string().oneOf(['once', 'daily', 'weekly']).default('once')
});


// Export concrete middlewares for registration and login routes
module.exports = {
    validateRegister: validate(registerSchema),
    validateLogin: validate(loginSchema),
    validatePatientRegistration: validate(patientRegistrationSchema),
    validateReminder: validate(reminderSchema)

};