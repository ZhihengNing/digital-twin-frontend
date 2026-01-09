const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 51502,
    host: '0.0.0.0',
    https: false,
    open: true,
    proxy: {
      '/apiAgent': {  //需要代理的接口
        target: 'http://127.0.0.1:51500',
        // target:'http://100.84.26.208:12000', //目标服务器
        changeOrigin: true,//是否跨域
        pathRewrite: {
          '^/apiAgent': ''  //重定向
        },
        secure: false
      },
      '/apiSever': {  //需要代理的接口
        target: 'http://127.0.0.1:51501',
        // target: 'http://100.84.26.208:12001', //目标服务器
        changeOrigin: true,//是否跨域
        pathRewrite: {
          '^/apiSever': ''
        },
        secure: false
      },
    }
  }
})
