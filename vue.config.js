const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/apiAgent': {  //需要代理的接口
        target:'http://100.84.26.208:12000', //目标服务器
        changeOrigin: true,//是否跨域
        pathRewrite: {
          '^/apiAgent': ''  //重定向
        },
        secure: false
      },
      '/api': {  //需要代理的接口
        target: 'http://100.84.26.208:12001', //目标服务器
        //target:'http://127.0.0.1:9101', //目标服务器
        changeOrigin: true,//是否跨域
        pathRewrite: {
          '^/api': ''
        },
        secure: false
      },
    }
  }
})
