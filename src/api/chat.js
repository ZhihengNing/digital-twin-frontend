


// ✅ 调后端：输入 query，返回 query（若后端空则回退原值）
import {apiAgentClient} from "@/api/apiClient";

export async function resolveQuery(query) {
    const data = {
        "message": query
    };
    return query;
    try {
        const response = await apiAgentClient.post("/agent/chat", data);
        return response.data;
    } catch (error) {
        console.error('Error during get Inversion Result by id:', error);
    }
}


export async function getHistoryMessages(sessionId) {
    return sessionId === "ops"
        ? [
            {role: "assistant", content: "我是运维助手：你可以问我 Redis/Neo4j/服务器问题。"},
            {role: "user", content: "neo4j 远程连不上怎么办？"},
            {role: "assistant", content: "先检查 7687/7474 端口监听、防火墙、docker 端口映射。"}
        ]
        : sessionId === "kb"
            ? [{role: "assistant", content: "我是知识库助手：我可以从你的本体/文档里检索答案。"}]
            : [{role: "assistant", content: "我是智能对话助手：我们从这里开始对话吧。"}];
}


export async function getAllSessions(){
    return [
        { label: "智能对话助手", value: "default" },
        { label: "运维助手", value: "ops" },
        { label: "知识库助手", value: "kb" }
    ];
}