import axios from 'axios'


const apiClient = axios.create({
    baseURL: '/api', // 后端 API 的基础路径
    timeout: 20000, // 请求超时时间
    headers: {
        'Content-Type': 'application/json',
    },
});


// 请求拦截器，增加token
apiClient.interceptors.request.use(
    config => {
        if(config.url!=="/sys-m-s/user-management/login"){
            config.headers.Authorization = window.sessionStorage.getItem('tmzf-token')
        }
        return config
    },
    error => {
        return Promise.reject(error);
    }
)


export default apiClient;
