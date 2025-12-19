import apiClient from "@/api/apiClient";



export const getAllGraph = async (data) => {
    try {
        const response = await apiClient.post("agent/getAll",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
        throw error;
    }
};