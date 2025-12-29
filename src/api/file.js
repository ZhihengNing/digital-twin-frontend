
import {apiAgentClient} from "@/api/apiClient"; // 你项目里原本怎么引就怎么引


// 1. 获取场景内所有文件：返回 List<DTFile> 或 Result<List<DTFile>>
export async function getAllFilesInScene() {
    try {
        const response = await apiAgentClient.post(
            "/agent/getAllFilesInScene",
            null,
            {
                headers: {
                    scene: window.localStorage.getItem("scene"),
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during getAllFilesInScene:", error);
        return null;
    }
}

// 2. 上传 + 入库（RAG ingest）
//   假设后端是 multipart/form-data 接收一个 file 参数，如果你不是这样实现的，按你自己的后端改
export async function uploadIngestFile(file) {
    try {
        const formData = new FormData();
        formData.append("file", file); // 后端 @RequestParam("file") MultipartFile file

        const response = await apiAgentClient.post(
            "/agent/uploadIngest",
            formData,
            {
                headers: {
                    scene: window.localStorage.getItem("scene"),
                    "Content-Type": "multipart/form-data",
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during uploadIngestFile:", error);
        throw error;
    }
}

export async function delFileInScene(fileId) {
    const data = { id: fileId };
    try {
        const response = await apiAgentClient.post(
            "/agent/delFileInScene",
            data,
            {
                headers: {
                    scene: window.localStorage.getItem("scene"),
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during delFileInScene:", error);
        throw error;
    }
}
