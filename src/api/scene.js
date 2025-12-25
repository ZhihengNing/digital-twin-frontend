import {apiClient} from "@/api/apiClient";


export async function listScenes() {
    try {
        const response = await apiClient.post("/digitaltwin/getAllScenes");
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}


export async function createScene(scene) {
    const data={
        "scene":scene
    }
    try {
        const response = await apiClient.post("/digitaltwin/createScene",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}


export async function deleteScene(scene) {
    const data={
        "scene":scene
    }
    try {
        const response = await apiClient.post("/digitaltwin/delScene",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}

