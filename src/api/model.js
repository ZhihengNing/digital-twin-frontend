import {apiClient} from "@/api/apiClient";



export const getModelById = async (id) => {
    const data={
        "modelId":id
    }
    try {
        const response = await apiClient.post("/digitaltwin/getModel",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
};