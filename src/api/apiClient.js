import axios from 'axios'


export const apiClient = axios.create({
    baseURL: '/api', // 后端 API 的基础路径
    timeout: 20000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiAgentClient = axios.create({
    baseURL: '/agentApi', // 后端 API 的基础路径
    timeout: 20000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json',
    },
});
