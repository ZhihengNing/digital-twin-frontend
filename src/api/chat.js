// src/api/chat.js
import {apiAgentClient} from "@/api/apiClient"; // 你项目里原本怎么引就怎么引

export const baseIP="100.84.26.208"
const baseURL="http://"+baseIP+":52000/"

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


export async function getHistoryLog(){
    try {
        const response = await apiAgentClient.post(
            "/agent/historyLog",
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


/* -----------------------------
 * ✅ 日志流：完全解耦（不需要 message）
 * ----------------------------- */

/**
 * 内部工具：按行读取（兼容纯文本行 & SSE 的 data: 前缀）
 * 不对外暴露
 */
async function streamLinesByFetch({ url, headers, body, signal, onLine }) {
    const res = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "text/event-stream, text/plain, */*",
            "Content-Type": "application/json",
            ...headers
        },
        body: JSON.stringify(body || {}),
        signal
    });

    if (!res.ok) throw new Error(`logStream HTTP ${res.status}`);
    if (!res.body) throw new Error("logStream: response.body is null");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    const emitLine = (lineRaw) => {
        if (!lineRaw) return;
        let line = String(lineRaw).trim();
        if (!line) return;

        if (line.startsWith("data:")) line = line.slice(5).trim();
        if (!line) return;

        if (line.startsWith("event:") || line.startsWith("id:") || line.startsWith("retry:")) return;

        onLine && onLine(line);
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buf += chunk;
        buf = buf.replace(/\r\n/g, "\n");

        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 1);
            emitLine(line);
        }
    }

    const tail = buf.trim();
    if (tail) emitLine(tail);
}

/**
 * ✅ 对外暴露：启动日志流，并自动 emit tool-event（完全不需要 message）
 *
 * @param {Object} params
 * @param {AbortSignal} [params.signal] - 允许外部 abort
 * @param {() => boolean} params.isActive - 判断这条流是否仍有效（避免旧流污染 UI）
 * @param {() => string|null} params.getSessionId - 从调用方取当前 sessionId（用于事件 payload）
 * @param {(evt: any) => void} params.emit - Chat.vue 传 this.$emit 的包装函数
 * @param {string} [params.url] - 默认 /agent/logStream
 */
export async function startAgentLogStream({ signal, isActive, getSessionId, getLogGroupId, emit,
                                              url = baseURL+"agent/logStream" }) {
    const headers = {
        sessionId: window.localStorage.getItem("sessionId"),
        scene: window.localStorage.getItem("scene")
    };

    await streamLinesByFetch({
        url,
        headers,
        body: {},
        signal,
        onLine: (line) => {
            if (!isActive || !isActive()) return;

            emit && emit("tool-event", {
                type: "tool.log",
                ts: Date.now(),
                sessionId: getSessionId ? getSessionId() : null,
                logGroupId: getLogGroupId ? getLogGroupId() : null,  // ✅ 新增
                data: { message: line }
            });
        }
    });
}

/**
 * ✅ 可选：判断一个错误是否为 abort（给 Chat.vue 用来决定要不要提示）
 */
export function isAbortError(e) {
    const msg = String(e?.message || "").toLowerCase();
    return (
        e?.name === "AbortError" ||
        msg.includes("aborted") ||
        msg.includes("canceled") ||
        msg.includes("cancelled")
    );
}


export async function resolveQueryStream(query, options = {}) {
    const signal = options.signal;

    const sessionId = window.localStorage.getItem("sessionId");
    const scene = window.localStorage.getItem("scene");

    const resp = await fetch(`${baseURL}agent/chatStream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json;charset=UTF-8",
            sessionId,
            scene,
            Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: query }),
        signal,
    });

    if (!resp.ok) throw new Error(`请求失败：HTTP ${resp.status} ${resp.statusText}`);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let dataLines = [];

    // ✅ 把 dataLines 拼成最终要追加的文本：
    // - 默认 SSE 多行 data 用 \n 连接
    // - 但对 Markdown 标题做一条“连行修复”： "##\n 建议" -> "## 建议"
    const buildData = (lines) => {
        if (!lines.length) return "";

        // 原始拼接（SSE 规范）
        let text = lines.join("\n");

        // ✅ Markdown 标题连行修复（只修这一类，避免乱改正文）
        // 1) "##\n建议" -> "## 建议"
        // 2) "##\n 建议" -> "## 建议"（保留那个空格为 1 个）
        text = text.replace(/^(#{1,6})\n ?/m, "$1 ");

        return text;
    };

    const flushEvent = () => {
        if (!dataLines.length) return;
        const data = buildData(dataLines);
        dataLines = [];
        if (data) options.onToken?.(data);
    };

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, "\n");

            let idx;
            while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx);
                buffer = buffer.slice(idx + 1);

                // 空行：event 边界
                if (line === "") {
                    flushEvent();
                    continue;
                }

                // 注释行
                if (line.startsWith(":")) continue;

                if (line.startsWith("data:")) {
                    // ✅ 关键：不要剥掉首空格！保留原始内容
                    // SSE 允许 "data:" 后直接跟内容，也允许 "data: " 后跟内容
                    // 我们把 "data:" 后面的部分原样取出（包含可能的首空格）
                    const v = line.slice(5); // 可能以空格开头
                    dataLines.push(v);
                    continue;
                }

                // 兼容：非严格 SSE 的纯文本行
                dataLines.push(line);
            }
        }

        // 最后 flush 一次
        flushEvent();
        options.onDone?.();
    } catch (e) {
        options.onError?.(e);
        throw e;
    } finally {
        try { reader.releaseLock(); } catch (e) {}
    }
}
