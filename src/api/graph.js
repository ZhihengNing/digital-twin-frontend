import {apiClient} from "@/api/apiClient";


export const getAllGraph = async (scene) => {
    const data = {
        "scene": scene
    }
    // return {
    //     categories: [{ name: "设备" }, { name: "人员" }, { name: "地点" }],
    //     nodes: [
    //         { id: "d1", name: "空调机组-A", category: 0, brand: "XX", status: "RUNNING", value: 6 },
    //         { id: "p1", name: "运维-张三", category: 1, phone: "138xxxx", value: 2 },
    //         { id: "l1", name: "机房-3F", category: 2, value: 1 }
    //     ],
    //     relations: [
    //         { source: "p1", target: "d1", name: "负责" },
    //         { source: "d1", target: "l1", name: "位于" }
    //     ]
    // };

    try {
        const response = await apiClient.post("/digitaltwin/getAllGraph", data);
        if (response && response.data) {
            const raw = response.data.data

            const models = [...new Set(raw.nodes.map(n => n.$metadata.$modelId))]

            const categoryIndexMap = new Map(models.map((m, i) => [m, i]))

            return {
                categories: models.map(name => ({ name })),
                nodes: raw.nodes.map(n => ({
                    id: n.$metadata.$name,
                    name: n.$metadata.$name,
                    category: categoryIndexMap.get(n.$metadata.$modelId)
                })),
                relations: raw.relations.map(r => ({
                    source: r.$sourceName,
                    target: r.$targetName,
                    name: r.$relationName
                }))
            }

        }
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
    return null;
};