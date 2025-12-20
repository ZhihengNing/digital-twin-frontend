// src/api/chat.js
import {apiAgentClient} from "@/api/apiClient"; // 你项目里原本怎么引就怎么引

export async function resolveQuery(query, options) {
    const data = { message: query };

    try {
        const response = await apiAgentClient.post(
            "/agent/chat",
            data,
            {
                headers: {
                    sessionId: window.localStorage.getItem("sessionId"),
                    scene: window.localStorage.getItem("scene")
                },
                // ✅ 关键：axios 1.x 支持 AbortController.signal
                signal: options?.signal
            }
        );
        return response.data;
    } catch (error) {
        // 被终止不当作“错误日志”刷屏
        const msg = String(error?.message || "").toLowerCase();
        const isAbort =
            error?.name === "AbortError" ||
            msg.includes("aborted") ||
            msg.includes("canceled") ||
            msg.includes("cancelled");

        if (!isAbort) {
            console.error("Error during resolveQuery:", error);
        }
        throw error; // ✅ 抛给 UI 做“终止/失败”区分
    }
}

export async function getHistoryMessages() {
    try {
        const response = await apiAgentClient.post(
            "/agent/history",
            null,
            {
                headers: {
                    sessionId: window.localStorage.getItem("sessionId"),
                    scene: window.localStorage.getItem("scene")
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during getHistoryMessages:", error);
    }
    return null;
}

export async function getAllSessions() {
    try {
        const response = await apiAgentClient.post(
            "/agent/sessions",
            null,
            {
                headers: {
                    scene: window.localStorage.getItem("scene")
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during getAllSessions:", error);
    }
    return null;
}

export async function delSession() {
    try {
        const response = await apiAgentClient.post(
            "/agent/delSessions",
            null,
            {
                headers: {
                    scene: window.localStorage.getItem("scene"),
                    sessionId: window.localStorage.getItem("sessionId")
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Error during delSession:", error);
    }
    return null;
}
