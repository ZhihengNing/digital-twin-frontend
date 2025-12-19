import apiClient from "@/api/apiClient";


// ✅ 调后端：输入 query，返回 query（若后端空则回退原值）
export async function resolveQuery(query) {
    const data = {
        "message": query
    };
    try {
        const response = await apiClient.post("/agent/chat", data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}