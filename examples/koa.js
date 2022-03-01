/* 设置环境变量 */
Object.assign(process.env, {
  // 执行器AppName，在调度中心配置执行器时使用
  XXL_JOB_EXECUTOR_KEY: 'executor-example-koa',
  // 调度中心地址
  XXL_JOB_SCHEDULE_CENTER_URL: 'http://127.0.0.1:8080/xxl-job-admin',
  // 调度中心设置的请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
  XXL_JOB_ACCESS_TOKEN: '9217CF7406F643BEB71CC00731129CC9',
  // 任务执行日志的存储路径
  XXL_JOB_JOB_LOG_PATH: 'logs/job',
  // 执行器运行日志开关(非任务执行日志)，默认关闭
  XXL_JOB_DEBUG_LOG: 'true',
})

// 实例化 XxlJobExecutor 组件
const XxlJobExecutor = require('../index')
const { jobHandlers } = require('./jobHandlers')
const context = { /* anything*/ }
const xxlJobExecutor = new XxlJobExecutor(jobHandlers, context)

// 实例化 koa app
const Koa = require('koa')
const app = new Koa()
app.use(require('koa-bodyparser')())

// 应用 XxlJobExecutor 组件
xxlJobExecutor.applyMiddleware({ app, appType: 'KOA', appDomain: 'http://127.0.0.1:3000', path: '/job' })

// 启动服务
const log = require('../src/logger')('executor-example-koa')
app.listen(3000, '127.0.0.1', () => log.info('server startup'))

// 退出前从注册中心摘除执行器
const { addShutdownHandlers } = require('./shutdown')
addShutdownHandlers(xxlJobExecutor.close.bind(xxlJobExecutor))
