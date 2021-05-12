/**
 * 应用xxl-job执行器组件
 * @param {any} app - server实例, express or koa
 * @param {String} appType - server类型，'EXPRESS' or 'KOA'
 * @param {String} executorUri - 执行器uri，用于构建路由，eg:'/job'
 * @param {String} executorUrl - 执行器地址，eg: 'http://127.0.0.1:5001/job'
 * @param {String} executorKey - 执行器AppName，在调度中心配置执行器时使用 eg:'xa-circle-api'
 * @param {String} scheduleCenterUrl - 调度中心地址, eg: 'http://127.0.0.1:8080/xxl-job-admin'
 * @param {String} accessToken - 请求令牌，调度中心和执行器都会进行校验，双方AccessToken匹配才允许通讯
 * @param {String} jobLogPath - 任务执行日志的存储路径， 日志文件的名称格式为'2021-05-01-logId.log'
 * @param {Map<String, Function>} jobHandlers - 所有的任务，key=>任务标识，即调度中心任务配置的JobHandler；value=>任务执行函数
 */
const applyXxlJobMiddleware = async (app, appType, executorUri, executorUrl, executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers) => {
  const Executor = require('./executor')

  const executor = new Executor(appType, executorUri, executorUrl, executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers)

  // apply executor
  executor.apply(app)

  // register executor
  await executor.registry()

  // add unregister event
  process.on('SIGINT', async () => {
    await executor.registryRemove()
    process.exit(1)
  })
}

module.exports = { applyXxlJobMiddleware }
