const log = require('../src/utils/logger')('executor-example-koa')

/* 设置环境变量 */
const xxlJobEnv = {
  // 执行器AppName，在调度中心配置执行器时使用
  XXL_JOB_EXECUTOR_KEY: 'executor-example-express',
  // 调度中心地址, eg: 'http://127.0.0.1:8080/xxl-job-admin'
  XXL_JOB_SCHEDULE_CENTER_URL: 'http://xxl-job-admin.kxb.com/xxl-job-admin',
  // 请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
  XXL_JOB_ACCESS_TOKEN: '9217CF7406F643BEB71CC00731129CC9',
  // 任务执行日志的存储路径， eg: 'logs/job'
  XXL_JOB_JOB_LOG_PATH: 'logs/job',
  // 执行器运行日志开关(非任务执行的日志) eg: '1' or '0'
  XXL_JOB_DEBUG_LOG: '1',
}
Object.assign(process.env, xxlJobEnv)

// 构造 koa 实例
const Koa = require('koa');
const koa = new Koa();

// 应用 body-parser 组件
const bodyparser = require('koa-bodyparser')
koa.use(bodyparser())

// 实例化 XxlJobExecutor 组件
const { jobHandlers } = require('./jobHandlers')
const XxlJobExecutor = require('../src/index')
const xxlJobExecutor = new XxlJobExecutor(jobHandlers)

// 应用 XxlJobExecutor 组件
const app = koa
const appType = 'KOA'
const appDomain = 'http://10.88.1.129:3000'
const path = '/job'
xxlJobExecutor.applyMiddleware({ app, appType, appDomain, path })
  // 启动服务
  .then(() => app.listen(3000, '10.88.1.129', () => log.info('server startup')))

// 退出前从注册中心摘除执行器
const { addShutdownHandlers } = require('./shutdown')
addShutdownHandlers(xxlJobExecutor.close.bind(xxlJobExecutor))
