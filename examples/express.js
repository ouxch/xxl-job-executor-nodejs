/**
 * demo任务
 * @param jobLogger 由xxl-job组件定义的任务logger，会将日志内容输出到文件，可在调度中心查看执行日志
 * @param jobParams 任务参数
 * @return {Promise<void>} 函数必须返回一个 promise
 */
const demoJobHandler = async ({ jobLogger, ...jobParams }) => {
  jobLogger.info('job start, it will takes about 10 seconds')
  const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
  await sleep(10000)
  jobLogger.info('job finish')
}

// 构造 express 示例
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: true })) // or app.use(executorUri, bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json()) // or app.use(executorUri, bodyParser.json())

// server类型，'EXPRESS' or 'KOA'
const appType = 'EXPRESS'
// 执行器uri，用于构建路由
const executorUri = '/job'
// 执行器地址
const executorUrl = 'http://10.88.1.27:3000/job'
// 执行器AppName，在调度中心配置执行器时使用
const executorKey = 'xa-circle-api'
// 调度中心地址(xxl-job-admin)
const scheduleCenterUrl = 'http://10.88.1.27:8081/xxl-job-admin'
// 请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
const accessToken = '9217CF7406F643BEB71CC00731129CC9'
// 任务执行日志的存储路径
const jobLogPath = 'logs/job'
// 所有的任务，key=>任务标识，即调度中心任务配置的JobHandler；value=>任务执行函数
const jobHandlers = new Map([['demoJobHandler', demoJobHandler]])

// 应用执行器组件
const { applyXxlJobMiddleware } = require('../src/index')
applyXxlJobMiddleware(app, appType, executorUri, executorUrl, executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers)
  .then(() => {
    // 启动服务
    app.listen(3000, '10.88.1.27', () => console.log('server startup'))
  })
