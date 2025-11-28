const { User } = require('../models');

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
      const patient = await User.findByPk(patientId, {
        attributes: { exclude: ['password'] }
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
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
  }
};

module.exports = patientController;