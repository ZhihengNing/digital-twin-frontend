const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      // '/iS3Api': {  //需要代理的接口
      //   target:'http://129.211.174.77:31900', //目标服务器
      //   changeOrigin: true,//是否跨域
      //   pathRewrite: {
      //     '^/iS3Api': ''  //重定向
      //   },
      //   secure: false
      // },
      '/api': {  //需要代理的接口
        target: 'http://127.0.0.1:9090', //目标服务器
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
