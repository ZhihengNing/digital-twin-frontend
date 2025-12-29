

/**
 * 把后端“流式输出的文本日志”按行解析出来（兼容 SSE 的 data: 前缀，也兼容纯文本）
 * @param {Object} opts
 * @param {string} opts.url          流式日志接口地址
 * @param {string} [opts.method]     默认 POST
 * @param {Object} [opts.headers]    请求头（sessionId/scene 等）
 * @param {Object} [opts.body]       POST body（JSON）
 * @param {AbortSignal} [opts.signal] 终止信号
 * @param {(line:string)=>void} opts.onLine 每拿到一条“完整日志行”回调
 * @param {(rawChunk:string)=>void} [opts.onChunk] 可选：调试用，拿到原始chunk
 */
export async function streamLogLines({
                                         url,
                                         method = "POST",
                                         headers = {},
                                         body = null,
                                         signal,
                                         onLine,
                                         onChunk
                                     }) {
    const res = await fetch(url, {
        method,
        headers: {
            Accept: "text/event-stream, text/plain, */*",
            "Content-Type": "application/json",
            ...headers
        },
        body: body ? JSON.stringify(body) : null,
        signal
    });

    if (!res.ok) {
        throw new Error(`streamLogLines HTTP ${res.status}`);
    }

    if (!res.body) {
        throw new Error("streamLogLines: response.body is null (no streaming support?)");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buf = "";
    const emitLine = (line) => {
        if (!line) return;
        // 兼容 SSE：data: xxx
        if (line.startsWith("data:")) line = line.slice(5).trim();
        // 过滤 SSE 里可能出现的 event/id/retry
        if (line.startsWith("event:") || line.startsWith("id:") || line.startsWith("retry:")) return;
        onLine && onLine(line);
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        onChunk && onChunk(chunk);

        buf += chunk;

        // 兼容两类分隔：
        // 1) 纯文本：\n
        // 2) SSE：\n\n
        // 我们按“行”处理：先把 \r\n 统一成 \n，再 split
        buf = buf.replace(/\r\n/g, "\n");

        let nlIndex;
        while ((nlIndex = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nlIndex).trim();
            buf = buf.slice(nlIndex + 1);
            emitLine(line);
        }
    }

    // flush
    const tail = buf.trim();
    if (tail) emitLine(tail);
}

/**
 * 开启“日志流”（返回一个 stop 函数 + 一个 promise 表示流结束）
 * 方便你在 Chat.vue 里：发送时 start，终止时 stop
 */
export function startLogStream({
                                   url,
                                   headers,
                                   body,
                                   onLine
                               }) {
    const ctl = new AbortController();
    const done = streamLogLines({
        url,
        headers,
        body,
        signal: ctl.signal,
        onLine
    });
    return {
        stop: () => ctl.abort(),
        done,
        signal: ctl.signal
    };
}
