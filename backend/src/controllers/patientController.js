const { User, Patient } = require('../models');
const { validatePatientRegistration } = require('../middleware/validation');

const patientController = {
  // Get patient details (with ownership check)
  getPatientDetails: async (req, res) => {
    try {
      const patientId = parseInt(req.params.patientId);

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
      // Fetch patient details (include Patient profile)
      const patient = await User.findByPk(patientId, {
        attributes: { exclude: ['password'] },
        include: [
          {
            model: Patient,
            attributes: ['dateOfBirth', 'emergencyContact', 'medicalConditions', 'createdAt', 'updatedAt'],
            required: false
          }
        ]
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
      console.log('CREATE PATIENT REQUEST:', req.body);
      const { email, password, name, dateOfBirth, emergencyContact, medicalConditions } = req.body;

      // Check if patient already exists
      const existingPatient = await User.findOne({ where: { email } });
      console.log('Existing patient check:', existingPatient);

      if (existingPatient) {
        return res.status(409).json({
          success: false,
          message: 'A patient with this email already exists'
        });
      }

      // Create patient user account
      console.log('Creating patient user...');
      const patientUser = await User.create({
        email,
        password,
        name,
        userType: 'patient'
      });
      console.log('Patient user created:', patientUser.id);

      // Create patient profile with medical details
      console.log('Creating patient profile...');
      const patientProfile = await Patient.create({
        userId: patientUser.id,
        dateOfBirth,
        emergencyContact,
        medicalConditions
      });
      console.log('Patient profile created:', patientProfile.id);

      // Auto-assign to the creating caregiver
      console.log('Auto-assigning to caregiver:', req.user.userId);
      const caregiver = await User.findByPk(req.user.userId);
      await caregiver.addPatient(patientUser);
      console.log('Assignment complete');

      res.status(201).json({
        success: true,
        message: 'Patient registered and assigned successfully',
        data: {
          patient: {
            id: patientUser.id,
            email: patientUser.email,
            name: patientUser.name,
            userType: patientUser.userType,
            profile: patientProfile
          }
        }
      });
    } catch (error) {
      console.error('CREATE PATIENT ERROR DETAILS:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        console.error('Validation errors:', validationErrors);
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

      res.status(500).json({
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
        include: [{
          model: User,
          as: 'patients',
          where: { isArchived: false },
          required: false,
          attributes: { exclude: ['password'] },
          include: [{
            model: Patient,
            attributes: ['dateOfBirth', 'emergencyContact', 'medicalConditions', 'createdAt']
          }]
        }]
      });

      if (!caregiver) {
        return res.status(404).json({
          success: false,
          message: "Caregiver not found"
        });
      }

      const patients = caregiver.patients || [];

      if (patients.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No active patients assigned",
          data: { patients: [] }
        });
      }

      res.json({
        success: true,
        data: { patients }
      });

    } catch (error) {
      console.error("Get all patients error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching patients"
      });
    }
  },


  // PUT /api/patients/:id - Update patient information
  updatePatient: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);

      // Use your existing ownership check logic
      const patientUser = await User.findByPk(patientId, {
        include: [Patient],
        attributes: { exclude: ['password'] }
      });

      if (!patientUser) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Check if patient is archived
      if (patientUser.isArchived) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update an archived patient'
        });
      }

      // Ownership validation (reuse your existing logic)
      if (req.user.userType === 'patient' && req.user.userId !== patientId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to patient data'
        });
      }

      if (req.user.userType === 'caregiver') {
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

      // Update patient data
      const { name, dateOfBirth, emergencyContact, medicalConditions } = req.body;

      if (name) await patientUser.update({ name });
      if (patientUser.Patient) {
        await patientUser.Patient.update({
          dateOfBirth: dateOfBirth || patientUser.Patient.dateOfBirth,
          emergencyContact: emergencyContact || patientUser.Patient.emergencyContact,
          medicalConditions: medicalConditions || patientUser.Patient.medicalConditions
        });
      }

      // Fetch updated patient data
      const updatedPatient = await User.findByPk(patientId, {
        include: [Patient],
        attributes: { exclude: ['password'] }
      });

      res.json({
        success: true,
        message: 'Patient updated successfully',
        data: { patient: updatedPatient }
      });
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating patient'
      });
    }
  },


  removePatientAssignment: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const patient = await User.findByPk(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Only caregivers can archive patients
      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can archive patients'
        });
      }

      // Check if caregiver owns this patient
      const caregiver = await User.findByPk(req.user.userId);
      const assignedPatients = await caregiver.getPatients();
      const patientIds = assignedPatients.map(p => p.id);

      if (!patientIds.includes(patientId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient not assigned to you.'
        });
      }

      // For MVP: Just remove the assignment
      await caregiver.removePatient(patient);

      res.json({
        success: true,
        message: 'Patient removed from your care'
      });
    } catch (error) {
      console.error('Archive patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error archiving patient'
      });
    }
  },

  restorePatientAssignment: async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const patient = await User.findByPk(patientId);

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (req.user.userType !== 'caregiver') {
        return res.status(403).json({
          success: false,
          message: 'Only caregivers can restore patients'
        });
      }

      // Reassign to current caregiver
      const caregiver = await User.findByPk(req.user.userId);
      await caregiver.addPatient(patient);

      res.json({
        success: true,
        message: 'Patient reassigned to your care'
      });
    } catch (error) {
      console.error('Restore patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error restoring patient'
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
          userType: 'patient'
        }
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Get current caregiver
      const caregiver = await User.findByPk(req.user.userId);

      // Check if already assigned
      const assignedPatients = await caregiver.getPatients();
      const alreadyAssigned = assignedPatients.some(p => p.id === patient.id);

      if (alreadyAssigned) {
        return res.status(409).json({
          success: false,
          message: 'Patient is already assigned to this caregiver'
        });
      }

      // Assign patient using Sequelize's built-in method
      await caregiver.addPatient(patient);

      res.status(201).json({
        success: true,
        message: 'Patient assigned successfully'
      });
    } catch (error) {
      console.error('Assign patient error:', error);
      res.status(500).json({
        success: false,
        message: 'Error assigning patient'
      });
    }
  },
      archivePatient: async (req, res) => {
        try {
          console.log('🔍 ARCHIVE REQUEST - Patient ID:', req.params.id);
          console.log('🔍 Request body:', req.body);

          const patientId = parseInt(req.params.id);
          const { archiveReason, notes } = req.body; // New fields

          const patient = await User.findByPk(patientId);

          if (!patient) {
            console.log(' Patient not found');
            return res.status(404).json({
              success: false,
              message: 'Patient not found'
            });
          }

          console.log('🔍 Patient found - Current is_archived:', patient.isArchived);

          // Check if already archived
          if (patient.isArchived) {
            return res.status(400).json({
              success: false,
              message: 'Patient is already archived'
            });
          }

          // Only caregivers can archive patients
          if (req.user.userType !== 'caregiver') {
            console.log(' Not a caregiver');
            return res.status(403).json({
              success: false,
              message: 'Only caregivers can archive patients'
            });
          }

          // Check if caregiver is assigned to this patient
          const caregiver = await User.findByPk(req.user.userId);
          const assignedPatients = await caregiver.getPatients();
          const patientIds = assignedPatients.map(p => p.id);

          console.log('🔍 Caregiver assigned patients:', patientIds);

          if (!patientIds.includes(patientId)) {
            console.log(' Patient not assigned to caregiver');
            return res.status(403).json({
              success: false,
              message: 'Access denied. Patient not assigned to you.'
            });
          }

          // Validate archive reason
          const validReasons = ['discharged', 'transferred', 'deceased', 'inactive', 'other'];
          if (!archiveReason || !validReasons.includes(archiveReason)) {
            return res.status(400).json({
              success: false,
              message: 'Valid archive reason required',
              validReasons: validReasons
            });
          }

          // Archive the patient with enhanced data
          console.log('🔄 Archiving patient with reason:', archiveReason);

          const updateData = {
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: req.user.userId,      // Who archived
            archiveReason: archiveReason,     // Why archived
            archiveNotes: notes || null,      // Additional notes
            updatedAt: new Date()
          };

          console.log('🔄 Update data:', updateData);

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
              archivedBy: updatedPatient.archivedBy
            }
          });
        } catch (error) {
          console.error(' Archive error:', error);
          console.error(' Error stack:', error.stack);
          res.status(500).json({
            success: false,
            message: 'Error archiving patient',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      },

      // Enhanced Unarchive function
      unarchivePatient: async (req, res) => {
        try {
          console.log(' UNARCHIVE REQUEST - Patient ID:', req.params.id);

          const patientId = parseInt(req.params.id);
          const { notes } = req.body; // Optional unarchive notes

          const patient = await User.findByPk(patientId);

          if (!patient) {
            return res.status(404).json({
              success: false,
              message: 'Patient not found'
            });
          }

          // Check if patient is actually archived
          if (!patient.isArchived) {
            return res.status(400).json({
              success: false,
              message: 'Patient is not archived'
            });
          }

          // Only caregivers can unarchive patients
          if (req.user.userType !== 'caregiver') {
            return res.status(403).json({
              success: false,
              message: 'Only caregivers can unarchive patients'
            });
          }

          // Get archive history before unarchiving
          const archiveHistory = {
            previouslyArchivedAt: patient.archivedAt,
            archiveReason: patient.archiveReason,
            archivedBy: patient.archivedBy
          };

          // Unarchive the patient
          console.log(' Unarchiving patient...');

          const updateData = {
            isArchived: false,
            archivedAt: null,
            archiveReason: null,
            archiveNotes: null,
            archivedBy: null,
            unarchivedAt: new Date(),        // When unarchived
            unarchivedBy: req.user.userId,   // Who unarchived
            unarchiveNotes: notes || null,   // Why unarchived
            updatedAt: new Date()
          };

          const updatedPatient = await patient.update(updateData);

          // Auto-reassign to the caregiver who unarchived
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
              previousArchive: archiveHistory
            }
          });
        } catch (error) {
          console.error('Unarchive patient error:', error);
          res.status(500).json({
            success: false,
            message: 'Error unarchiving patient'
          });
        }
      },

      // Enhanced GET archived patients with filters
  getArchivedPatients: async (req, res) => {
    try {
      const { reason, startDate, endDate } = req.query;

      const caregiver = await User.findByPk(req.user.userId, {
        include: [{
          model: User,
          as: 'patients',
          where: { isArchived: true },
          required: false,   // <-- FIX: ensures caregiver still returns
          attributes: {
            exclude: ['password'],
            include: [
              'archivedAt',
              'archiveReason',
              'archiveNotes',
              'archivedBy',
              'unarchivedAt',
              'unarchivedBy'
            ]
          },
          include: [{
            model: Patient,
            attributes: ['dateOfBirth', 'emergencyContact', 'medicalConditions', 'createdAt']
          }]
        }]
      });

      // caregiver null check
      if (!caregiver) {
        return res.status(404).json({
          success: false,
          message: "Caregiver not found"
        });
      }

      let patients = caregiver.patients || [];

      // If no archived patients
      if (patients.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No archived patients found",
          data: { patients: [] }
        });
      }

      // Apply optional filters
      if (reason) patients = patients.filter(p => p.archiveReason === reason);

      if (startDate) {
        const start = new Date(startDate);
        patients = patients.filter(p => new Date(p.archivedAt) >= start);
      }

      if (endDate) {
        const end = new Date(endDate);
        patients = patients.filter(p => new Date(p.archivedAt) <= end);
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
            }, {})
          }
        }
      });

    } catch (error) {
      console.error("Get archived patients error:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching archived patients"
      });
    }
  },


  // Get archive audit log (comprehensive history)
      getArchiveAuditLog: async (req, res) => {
        try {
          // Only admins or caregivers can see full audit log
          if (req.user.userType !== 'caregiver') {
            return res.status(403).json({
              success: false,
              message: 'Access denied'
            });
          }

          // Get all patients with archive history
          const patients = await User.findAll({
            where: {
              userType: 'patient'
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
              'updatedAt'
            ],
            order: [['archivedAt', 'DESC']]
          });

          // Filter to only patients assigned to this caregiver
          const caregiver = await User.findByPk(req.user.userId);
          const assignedPatients = await caregiver.getPatients();
          const assignedPatientIds = assignedPatients.map(p => p.id);

          const filteredPatients = patients.filter(p => assignedPatientIds.includes(p.id));

          res.json({
            success: true,
            data: {
              auditLog: filteredPatients.map(p => ({
                patientId: p.id,
                patientName: p.name,
                isArchived: p.isArchived,
                archivedAt: p.archivedAt,
                archiveReason: p.archiveReason,
                archivedBy: p.archivedBy,
                unarchivedAt: p.unarchivedAt,
                unarchivedBy: p.unarchivedBy,
                lastUpdated: p.updatedAt
              })),
              summary: {
                totalPatients: filteredPatients.length,
                archivedCount: filteredPatients.filter(p => p.isArchived).length,
                activeCount: filteredPatients.filter(p => !p.isArchived).length
              }
            }
          });
        } catch (error) {
          console.error('Get archive audit log error:', error);
          res.status(500).json({
            success: false,
            message: 'Error fetching archive audit log'
          });
        }

  },
};

module.exports = patientController;