import {apiClient} from "@/api/apiClient";



export const getModelById = async (scene,id) => {
    const data={
        "scene":scene,
        "modelId":id
    }
    try {
        const response = await apiClient.post("/digitaltwin/getModel",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
    return null;
};


export async function getModelsByScene(scene){
    const data={
        "scene":scene
    }
    try {
        const response = await apiClient.post("/digitaltwin/getModelByScene",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}