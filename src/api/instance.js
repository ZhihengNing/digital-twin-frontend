import {apiClient} from "@/api/apiClient";



export const getInstance = async (scene,modelId,instanceName) => {
    const data ={
        "scene":scene,
        "modelId":modelId,
        "instanceName":instanceName
    };
    try {
        const response = await apiClient.post("/digitaltwin/getInstance",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
    return null;
};

