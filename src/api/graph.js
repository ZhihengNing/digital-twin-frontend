import apiClient from "@/api/apiClient";



export const getAllGraph = async (scene) => {
    const data={
        "scene":scene
    }
    return {
        categories: [{ name: "设备" }, { name: "人员" }, { name: "地点" }],
        nodes: [
            { id: "d1", name: "空调机组-A", category: 0, brand: "XX", status: "RUNNING", value: 6 },
            { id: "p1", name: "运维-张三", category: 1, phone: "138xxxx", value: 2 },
            { id: "l1", name: "机房-3F", category: 2, value: 1 }
        ],
        relations: [
            { source: "p1", target: "d1", name: "负责" },
            { source: "d1", target: "l1", name: "位于" }
        ]
    };
    try {
        const response = await apiClient.post("digitaltwin/getAllGraph",data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
};