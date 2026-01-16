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
    dateOfBirth: yup.date().nullable(),
    emergencyContact: yup
        .string()
        .trim()
        .min(6, 'Emergency contact is too short')
        .max(30, 'Emergency contact is too long (max 30 characters)')
        .matches(/[0-9]/, 'Emergency contact must include a phone number')
        .required('Emergency contact is required'),
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