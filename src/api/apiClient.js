import axios from 'axios'


export const apiClient = axios.create({
    baseURL: '/apiSever', // 后端 API 的基础路径
    timeout: 8000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json',
    },
});

export const apiAgentClient = axios.create({
    baseURL: '/apiAgent', // 后端 API 的基础路径
    timeout: 8000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json',
    },
});
