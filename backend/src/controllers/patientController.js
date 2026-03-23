/**
 * Patient controller – CRUD for patients, caregiver–patient assignment,
 * invite sending (passwordless activate link), archive/unarchive with audit.
 * All routes enforce ownership: caregivers see only assigned patients; patients only themselves.
 */
const crypto = require('crypto');
const { User, Patient } = require('../models');
const { sendPatientInviteEmail } = require('../utils/emailService');
const { hashEmail } = require('../utils/encryption');

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// --- Medical history helpers ---
// The API and UI can send medical history as a JSON object (preferred) or a string (legacy).
// chronicConditions may be an array of { diagnosis, dateDiagnosed } or an old string; we support
// both so existing data and new structured forms both work. buildConditionsSummary produces a
// single display string for lists and details.
function parseMedicalHistory(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[object Object]') return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return {};
}

function serialiseMedicalHistory(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : null;
  }

  // Object: store as JSON
  try {
    const json = JSON.stringify(raw);
    return json && json !== '{}' ? json : null;
  } catch {
    return null;
  }
}

function buildConditionsSummary(historyObj, fallback) {
  const history = historyObj && typeof historyObj === 'object' ? historyObj : {};

  // Diagnosis (string)
  if (history.diagnosis && String(history.diagnosis).trim()) {
    return String(history.diagnosis).trim();
  }

  // Chronic conditions: can be array of { diagnosis } or legacy string
  const cc = history.chronicConditions;
  if (cc != null) {
    if (Array.isArray(cc) && cc.length > 0) {
      const parts = cc
        .map((c) => c && (c.diagnosis != null ? String(c.diagnosis).trim() : ''))
        .filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    if (typeof cc === 'string' && cc.trim()) return cc.trim();
  }

  if (history.pastConditions && String(history.pastConditions).trim()) {
    return String(history.pastConditions).trim();
  }

  const fb = fallback ? String(fallback).trim() : '';
  if (fb && fb !== '[object Object]') return fb;

  return null;
}


const patientController = {
  /** Single patient by id; 403 if caregiver not assigned or patient accessing another */
  getPatientDetails: async (req, res) => {
    try {
      const patientId = parseInt(req.params.patientId, 10);

      if (Number.isNaN(patientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid patient id',
        });
      }

      if (req.user.userType === 'patient') {
        // Patients can only access their own data
        if (req.user.userId !== patientId) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to patient data'
          });
        }
      } else if (req.user.userType === 'caregiver') {
        // Caregivers can only access assigned patients
        const caregiver = await User.findByPk(req.user.userId);
        const assignedPatients = await caregiver.getPatients();
        const patientIds = assignedPatients.map(p => p.id);

        if (!patientIds.includes(patientId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Patient not assigned to you.'
          });
        }
      }

      // Fetch patient details
      const patient = await User.findByPk(patientId, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Patient,
            required: false,
          },
        ],
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (patient.isArchived && req.user.userType === 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Cannot access archived patient'
        });
      }

      res.json({
        success: true,
        data: { patient }
      });
    } catch (error) {
      console.error('Get patient details error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching patient details'
      });
    }
  },

  createPatient: async (req, res) => {
    try {
      let {
        email, password, name, dateOfBirth, emergencyContact, medicalConditions, medicalHistory,
        address, gender, phoneNumber,
        preferredCommunication, accessibilityNeeds, careNotes,
        emergencyContactName, emergencyContactRelationship, emergencyContactPhone,
        reminderNotificationChannel,
      } = req.body;

      const historyObj = parseMedicalHistory(medicalHistory);
      const historyJson = serialiseMedicalHistory(historyObj);
      const conditionsSummary = buildConditionsSummary(historyObj, medicalConditions);

      //  normalise email (fixes duplicate email case issues)
      const normalizedEmail = String(email || "").trim().toLowerCase();

      // Check if patient already exists (case-insensitive once normalised)
      const existingPatient = await User.findOne({ where: { emailHash: hashEmail(normalizedEmail) } });

      if (existingPatient) {
        return res.status(409).json({
          success: false,
          message: 'A patient with this email already exists'
        });
      }

      // Patient accounts are passwordless; use a random password if none provided (never shown to user)
      const patientPassword = (password && String(password).trim())
        ? String(password).trim()
        : crypto.randomBytes(24).toString('hex');
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteTokenExpires = new Date(Date.now() + INVITE_EXPIRY_MS);

      const patientUser = await User.create({
        email: normalizedEmail,
        password: patientPassword,
        name,
        userType: 'patient',
        isEmailVerified: false,
        inviteToken,
        inviteTokenExpires
      });

      // Only the patient sets reminder channel in the app; new patients default to 'none'
      const reminderChannel = 'none';
      // Create patient profile
      const patientProfile = await Patient.create({
        userId: patientUser.id,
        dateOfBirth: dateOfBirth || null,
        emergencyContact: emergencyContact ?? null,
        medicalConditions: conditionsSummary,
        medicalHistory: historyJson,
        address: address != null ? String(address).trim() || null : null,
        gender: gender != null ? String(gender).trim() || null : null,
        phoneNumber: phoneNumber != null ? String(phoneNumber).trim() || null : null,
        preferredCommunication: preferredCommunication != null ? String(preferredCommunication).trim() || null : null,
        careNotes: careNotes != null ? String(careNotes).trim() || null : null,
        emergencyContactName: emergencyContactName != null ? String(emergencyContactName).trim() || null : null,
        emergencyContactRelationship: emergencyContactRelationship != null ? String(emergencyContactRelationship).trim() || null : null,
        emergencyContactPhone: emergencyContactPhone != null ? String(emergencyContactPhone).trim() || null : null,
        reminderNotificationChannel: reminderChannel,
      });

      // Auto-assign to the creating caregiver
      const caregiver = await User.findByPk(req.user.userId);
      await caregiver.addPatient(patientUser);

      const emailResult = await sendPatientInviteEmail(patientUser.email, patientUser.name, inviteToken);
      if (!emailResult.sent && emailResult.error) {
        console.error('Patient invite email failed:', emailResult.error);
      }

      const responsePayload = {
        success: true,
        message: 'Patient created. An invite email has been sent for them to activate their account.',
        data: {
          patient: {
            id: patientUser.id,
            email: patientUser.email,
            name: patientUser.name,
            userType: patientUser.userType,
            profile: patientProfile
          }
        }
      };
      if (emailResult.inviteLink) {
        responsePayload.data.inviteLink = emailResult.inviteLink;
      }
      return res.status(201).json(responsePayload);
    } catch (error) {
      console.error('CREATE PATIENT ERROR DETAILS:', error);

      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          message: 'A patient with this email already exists'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error creating patient profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // GET /api/patients - Get all patients for current caregiver
  getAllPatients: async (req, res) => {
    try {
      const caregiver = await User.findByPk(req.user.userId, {
        include: [
          {
            model: User,
            as: 'patients',
            where: { isArchived: false },
            required: false,
            attributes: { exclude: ['password'] },
            include: [
              {
                model: Patient,
              },
            ],
          },
        ],
      });

      if (!caregiver) {
        return res.status(404).json({
          success: false,
          message: 'Caregiver not found'
        });
      }

      const patients = caregiver.patients || [];

      if (patients.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No active patients assigned',
          data: { patients: [] },
        });
      }

      res.json({
        success: true,
        data: { patients },
      });
    } catch (error) {
      console.error('Get all patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching patients',
      });
    }
  },

  // POST /api/patients/:id/send-invite - Resend invite email (caregiver only)
  sendInvite: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id, 10);
      if (Number.isNaN(patientId)) {
        return res.status(400).json({ success: false, message: 'Invalid patient id' });
      }
      const caregiver = await User.findByPk(req.user.userId);
      const assignedPatients = await caregiver.getPatients();
      const patientIds = assignedPatients.map((p) => p.id);
      if (!patientIds.includes(patientId)) {
        return res.status(403).json({
          success: false,
          message: 'Patient not assigned to you',
        });
      }
      const patientUser = await User.findByPk(patientId);
      if (!patientUser || patientUser.userType !== 'patient') {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }
      if (patientUser.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot send invite for an archived patient',
        });
      }
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteTokenExpires = new Date(Date.now() + INVITE_EXPIRY_MS);
      await patientUser.update({ inviteToken, inviteTokenExpires });
      const emailResult = await sendPatientInviteEmail(patientUser.email, patientUser.name, inviteToken);
      if (!emailResult.sent && emailResult.error) {
        console.error('Resend invite email failed:', emailResult.error);
        // Fallback: return link so caregiver can copy/share manually (e.g. when SMTP fails)
        if (emailResult.inviteLink) {
          return res.json({
            success: true,
            message: 'Email could not be sent, but here is the activation link. Copy and share it with the patient:',
            data: { inviteLink: emailResult.inviteLink },
          });
        }
        return res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'development'
            ? `Failed to send invite email: ${emailResult.error}`
            : 'Failed to send invite email. Please try again later.',
        });
      }
      res.json({
        success: true,
        message: 'Invite email sent. The patient can use the link to activate their account.',
        ...(emailResult.inviteLink && { data: { inviteLink: emailResult.inviteLink } }),
      });
    } catch (error) {
      console.error('Send invite error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send invite',
      });
    }
  },

  // PUT /api/patients/:id - Update patient information
  updatePatient: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id, 10);

      const patientUser = await User.findByPk(patientId, {
        include: [Patient],
        attributes: { exclude: ['password'] },
      });

      if (!patientUser) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      // Check if patient is archived
      if (patientUser.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update an archived patient',
        });
      }

      // Ownership validation
      if (req.user.userType === 'patient' && req.user.userId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to patient data',
        });
      }

      if (req.user.userType === 'caregiver') {
        const caregiver = await User.findByPk(req.user.userId);
        const assignedPatients = await caregiver.getPatients();
        const patientIds = assignedPatients.map((p) => p.id);

        if (!patientIds.includes(patientId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Patient not assigned to you.',
          });
        }
      }

      const {
        email: emailRaw,
        name, dateOfBirth, emergencyContact, medicalConditions, medicalHistory,
        address, gender, phoneNumber,
        preferredCommunication, accessibilityNeeds, careNotes,
        emergencyContactName, emergencyContactRelationship, emergencyContactPhone,
        locationConsent,
        reminderNotificationChannel,
      } = req.body;

      const patientProfile = patientUser.Patient;

      // Allow caregiver to fix patient email (e.g. typo). If patient has pending invite, resend to new email.
      if (emailRaw !== undefined && emailRaw !== null) {
        const newEmail = String(emailRaw).trim().toLowerCase();
        if (!newEmail) {
          return res.status(400).json({ success: false, message: 'Email cannot be empty.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          return res.status(400).json({ success: false, message: 'Invalid email format.' });
        }
        const existing = await User.findOne({ where: { emailHash: hashEmail(newEmail) } });
        if (existing && existing.id !== patientId) {
          return res.status(409).json({ success: false, message: 'Another patient or user already has this email.' });
        }
        const hadInvitePending = !!(patientUser.inviteToken && patientUser.inviteTokenExpires > new Date());
        await patientUser.update({ email: newEmail });
        if (hadInvitePending) {
          const inviteToken = crypto.randomBytes(32).toString('hex');
          const inviteTokenExpires = new Date(Date.now() + INVITE_EXPIRY_MS);
          await patientUser.update({ inviteToken, inviteTokenExpires });
          const emailResult = await sendPatientInviteEmail(patientUser.email, patientUser.name, inviteToken);
          if (!emailResult.sent && emailResult.error) {
            console.error('Invite email after email update failed:', emailResult.error);
          }
        }
      }

      const historyProvided = medicalHistory !== undefined;
      let historyObj = historyProvided ? parseMedicalHistory(medicalHistory) : null;

      // Preserve existing chronicConditions if client omitted or sent null (avoids wiping on partial payloads)
      if (historyObj && patientProfile?.medicalHistory) {
        const incoming = historyObj.chronicConditions;
        if (incoming === undefined || incoming === null) {
          const existing = parseMedicalHistory(patientProfile.medicalHistory);
          if (Array.isArray(existing.chronicConditions) && existing.chronicConditions.length > 0) {
            historyObj = { ...historyObj, chronicConditions: existing.chronicConditions };
          }
        }
      }

      const historyJson =
          historyProvided && historyObj ? serialiseMedicalHistory(historyObj) : undefined;

      const conditionsSummary = (() => {
        if (historyProvided) {
          return buildConditionsSummary(
              historyObj,
              medicalConditions !== undefined ? medicalConditions : patientProfile?.medicalConditions,
          );
        }
        if (medicalConditions !== undefined) {
          return buildConditionsSummary(null, medicalConditions);
        }
        return undefined;
      })();

      if (name) {
        await patientUser.update({ name });
      }

      if (patientProfile) {
        const updates = {};

        if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth || null;
        if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact || null;
        if (conditionsSummary !== undefined) updates.medicalConditions = conditionsSummary;
        if (historyJson !== undefined) updates.medicalHistory = historyJson;

        if (address !== undefined) updates.address = address != null ? String(address).trim() || null : null;
        if (gender !== undefined) updates.gender = gender != null ? String(gender).trim() || null : null;
        if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber != null ? String(phoneNumber).trim() || null : null;
        if (preferredCommunication !== undefined) updates.preferredCommunication = preferredCommunication != null ? String(preferredCommunication).trim() || null : null;
        if (accessibilityNeeds !== undefined) updates.accessibilityNeeds = accessibilityNeeds != null ? (typeof accessibilityNeeds === 'string' ? accessibilityNeeds : JSON.stringify(accessibilityNeeds)) : null;
        if (careNotes !== undefined) updates.careNotes = careNotes != null ? String(careNotes).trim() || null : null;
        if (emergencyContactName !== undefined) updates.emergencyContactName = emergencyContactName != null ? String(emergencyContactName).trim() || null : null;
        if (emergencyContactRelationship !== undefined) updates.emergencyContactRelationship = emergencyContactRelationship != null ? String(emergencyContactRelationship).trim() || null : null;
        if (emergencyContactPhone !== undefined) updates.emergencyContactPhone = emergencyContactPhone != null ? String(emergencyContactPhone).trim() || null : null;
        // locationConsent is set only by the patient (via patient app); caregivers cannot change it
        if (locationConsent !== undefined && req.user.userType === 'patient' && req.user.userId === patientId) {
          updates.locationConsent = Boolean(locationConsent);
        }
        // Only the patient can set reminder notification channel (in the patient app Profile)
        if (reminderNotificationChannel !== undefined && req.user.userType === 'patient' && req.user.userId === patientId) {
          const ch = String(reminderNotificationChannel).toLowerCase();
          if (ch === 'email' || ch === 'push' || ch === 'none') {
            updates.reminderNotificationChannel = ch;
          }
        }

        if (Object.keys(updates).length) {
          await patientProfile.update(updates);
        }
      }

      // Fetch updated patient data
      const updatedPatient = await User.findByPk(patientId, {
        include: [Patient],
        attributes: { exclude: ['password'] },
      });

      res.json({
        success: true,
        message: 'Patient updated successfully',
        data: { patient: updatedPatient },
      });
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating patient',
      });
    }
  },

  removePatientAssignment: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id, 10);
      const patient = await User.findByPk(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      // Only caregivers can archive patients
      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can archive patients',
        });
      }

      // Check if caregiver owns this patient
      const caregiver = await User.findByPk(req.user.userId);
      const assignedPatients = await caregiver.getPatients();
      const patientIds = assignedPatients.map((p) => p.id);

      if (!patientIds.includes(patientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient not assigned to you.',
        });
      }

      // For MVP: Just remove the assignment
      await caregiver.removePatient(patient);

      res.json({
        success: true,
        message: 'Patient removed from your care',
      });
    } catch (error) {
      console.error('Archive patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error archiving patient',
      });
    }
  },

  restorePatientAssignment: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id, 10);
      const patient = await User.findByPk(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can restore patients',
        });
      }

      // Reassign to current caregiver
      const caregiver = await User.findByPk(req.user.userId);
      await caregiver.addPatient(patient);

      res.json({
        success: true,
        message: 'Patient reassigned to your care',
      });
    } catch (error) {
      console.error('Restore patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error restoring patient',
      });
    }
  },

  // Assign patient to caregiver
  assignPatient: async (req, res) => {
    try {
      const { patientEmail } = req.body;

      // Find patient by email
      const patient = await User.findOne({
        where: {
          email: patientEmail,
          userType: 'patient',
        },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      // Get current caregiver
      const caregiver = await User.findByPk(req.user.userId);

      // Check if already assigned
      const assignedPatients = await caregiver.getPatients();
      const alreadyAssigned = assignedPatients.some((p) => p.id === patient.id);

      if (alreadyAssigned) {
        return res.status(409).json({
          success: false,
          message: 'Patient is already assigned to this caregiver',
        });
      }

      // Assign patient using Sequelize's built-in method
      await caregiver.addPatient(patient);

      res.status(201).json({
        success: true,
        message: 'Patient assigned successfully',
      });
    } catch (error) {
      console.error('Assign patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning patient',
      });
    }
  },

  // --- archive / unarchive + reporting (left mostly as-is) -----------------

  archivePatient: async (req, res) => {
    try {
      console.log(' ARCHIVE REQUEST - Patient ID:', req.params.id);
      console.log(' Request body:', req.body);

      const patientId = parseInt(req.params.id, 10);
      const { archiveReason, notes } = req.body;

      const patient = await User.findByPk(patientId);

      if (!patient) {
        console.log(' Patient not found');
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      console.log(' Patient found - Current is_archived:', patient.isArchived);

      if (patient.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Patient is already archived',
        });
      }

      if (req.user.userType !== 'caregiver') {
        console.log(' Not a caregiver');
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can archive patients',
        });
      }

      const caregiver = await User.findByPk(req.user.userId);
      const assignedPatients = await caregiver.getPatients();
      const patientIds = assignedPatients.map((p) => p.id);

      console.log(' Caregiver assigned patients:', patientIds);

      if (!patientIds.includes(patientId)) {
        console.log(' Patient not assigned to caregiver');
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient not assigned to you.',
        });
      }

      const validReasons = ['discharged', 'transferred', 'deceased', 'inactive', 'other'];
      if (!archiveReason || !validReasons.includes(archiveReason)) {
        return res.status(400).json({
          success: false,
          message: 'Valid archive reason required',
          validReasons,
        });
      }

      console.log(' Archiving patient with reason:', archiveReason);

      const updateData = {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: req.user.userId,
        archiveReason,
        archiveNotes: notes || null,
        updatedAt: new Date(),
      };

      console.log(' Update data:', updateData);

      const updatedPatient = await patient.update(updateData);

      console.log(' After update - is_archived:', updatedPatient.isArchived);
      console.log(' After update - archivedAt:', updatedPatient.archivedAt);
      console.log(' After update - archive_reason:', updatedPatient.archiveReason);

      res.json({
        success: true,
        message: `Patient archived successfully (Reason: ${archiveReason})`,
        data: {
          patientId: patient.id,
          archivedAt: updatedPatient.archivedAt,
          archiveReason: updatedPatient.archiveReason,
          archivedBy: updatedPatient.archivedBy,
        },
      });
    } catch (error) {
      console.error(' Archive error:', error);
      console.error(' Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Error archiving patient',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },

  // Enhanced Unarchive function
  unarchivePatient: async (req, res) => {
    try {
      console.log(' UNARCHIVE REQUEST - Patient ID:', req.params.id);

      const patientId = parseInt(req.params.id, 10);
      const { notes } = req.body;

      const patient = await User.findByPk(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }

      if (!patient.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Patient is not archived',
        });
      }

      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can unarchive patients',
        });
      }

      const archiveHistory = {
        previouslyArchivedAt: patient.archivedAt,
        archiveReason: patient.archiveReason,
        archivedBy: patient.archivedBy,
      };

      console.log(' Unarchiving patient...');

      const updateData = {
        isArchived: false,
        archivedAt: null,
        archiveReason: null,
        archiveNotes: null,
        archivedBy: null,
        unarchivedAt: new Date(),
        unarchivedBy: req.user.userId,
        unarchiveNotes: notes || null,
        updatedAt: new Date(),
      };

      const updatedPatient = await patient.update(updateData);

      const caregiver = await User.findByPk(req.user.userId);
      await caregiver.addPatient(patient);

      console.log(' Patient unarchived and reassigned');

      res.json({
        success: true,
        message: 'Patient unarchived and reassigned to your care',
        data: {
          patientId: patient.id,
          unarchivedAt: updatedPatient.unarchivedAt,
          unarchivedBy: updatedPatient.unarchivedBy,
          previousArchive: archiveHistory,
        },
      });
    } catch (error) {
      console.error('Unarchive patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error unarchiving patient',
      });
    }
  },

  // Enhanced GET archived patients with filters
  getArchivedPatients: async (req, res) => {
    try {
      const { reason, startDate, endDate } = req.query;

      const caregiver = await User.findByPk(req.user.userId, {
        include: [
          {
            model: User,
            as: 'patients',
            where: { isArchived: true },
            required: false,
            attributes: { exclude: ['password'] },
            include: [
              {
                model: Patient,
              },
            ],
          },
        ],
      });

      if (!caregiver) {
        return res.status(404).json({
          success: false,
          message: 'Caregiver not found',
        });
      }

      let patients = caregiver.patients || [];

      if (patients.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No archived patients found',
          data: { patients: [] },
        });
      }

      if (reason) patients = patients.filter((p) => p.archiveReason === reason);

      if (startDate) {
        const start = new Date(startDate);
        patients = patients.filter((p) => new Date(p.archivedAt) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        patients = patients.filter((p) => new Date(p.archivedAt) <= end);
      }

      return res.status(200).json({
        success: true,
        data: {
          patients,
          stats: {
            total: patients.length,
            byReason: patients.reduce((acc, p) => {
              acc[p.archiveReason] = (acc[p.archiveReason] || 0) + 1;
              return acc;
            }, {}),
          },
        },
      });
    } catch (error) {
      console.error('Get archived patients error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching archived patients',
      });
    }
  },

  // Get archive audit log (comprehensive history)
  getArchiveAuditLog: async (req, res) => {
    try {
      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      const patients = await User.findAll({
        where: {
          userType: 'patient',
        },
        attributes: [
          'id',
          'email',
          'name',
          'isArchived',
          'archivedAt',
          'archiveReason',
          'archivedBy',
          'unarchivedAt',
          'unarchivedBy',
          'createdAt',
          'updatedAt',
        ],
        order: [['archivedAt', 'DESC']],
      });

      const caregiver = await User.findByPk(req.user.userId);
      const assignedPatients = await caregiver.getPatients();
      const assignedPatientIds = assignedPatients.map((p) => p.id);

      const filteredPatients = patients.filter((p) => assignedPatientIds.includes(p.id));

      res.json({
        success: true,
        data: {
          auditLog: filteredPatients.map((p) => ({
            patientId: p.id,
            patientName: p.name,
            isArchived: p.isArchived,
            archivedAt: p.archivedAt,
            archiveReason: p.archiveReason,
            archivedBy: p.archivedBy,
            unarchivedAt: p.unarchivedAt,
            unarchivedBy: p.unarchivedBy,
            lastUpdated: p.updatedAt,
          })),
          summary: {
            totalPatients: filteredPatients.length,
            archivedCount: filteredPatients.filter((p) => p.isArchived).length,
            activeCount: filteredPatients.filter((p) => !p.isArchived).length,
          },
        },
      });
    } catch (error) {
      console.error('Get archive audit log error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching archive audit log',
      });
    }
  },
};

module.exports = patientController;