import { api } from './apiClient';

export const getDashboardStats = async () => {
    try {
        // For now, return mock stats

        return {
            activePatients: 5,
            reminderCompliance: 87,
            activeAlerts: 2
        };

        // When you have a dashboard endpoint:
        // const response = await api.get('/dashboard/stats');
        // if (response.success) {
        //     return response.data;
        // } else {
        //     throw new Error(response.message);
        // }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        throw error;
    }
};