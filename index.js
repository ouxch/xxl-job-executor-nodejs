const Executor = require('./src/executor')
const { isNilOrEmpty, notEmpty } = require('./src/purefuncs')

/**
 * XxlJobExecutor
 */
class XxlJobExecutor {
  /**
   * 创建 XxlJobExecutor 实例
   * @param {Map<String, Function>} jobHandlers 所有的任务执行函数，key: 任务标识，即调度中心任务配置的JobHandler；value: 任务执行函数
   * @param {Object} context 为所有任务执行函数指定公共的上下文对象，常见比如数据库实例 { database, redis }
   */
  constructor(jobHandlers, context = undefined) {
    const {
      XXL_JOB_EXECUTOR_KEY: executorKey,
      XXL_JOB_SCHEDULE_CENTER_URL: scheduleCenterUrl,
      XXL_JOB_ACCESS_TOKEN: accessToken,
      XXL_JOB_JOB_LOG_PATH: jobLogPath,
    } = process.env
    const parameters = { executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers }
    const invalidParameters = Object.entries(parameters).filter(([, value]) => isNilOrEmpty(value))
    if (notEmpty(invalidParameters)) throw `invalid parameter: ${invalidParameters.map(([key]) => key).join(',')}`
    this.executor = new Executor(executorKey, scheduleCenterUrl, accessToken, jobLogPath, jobHandlers, context)
  }

  /**
   * 应用执行器组件
   * @param {Object} args
   * @param {any} args.app 执行器server, express or koa
   * @param {string} args.appType 执行器 server 类型，'EXPRESS' or 'KOA'
   * @param {string} args.appDomain 执行器 server 地址，eg: http://server-api.com
   * @param {string} args.path 执行器挂载的 uri 路径，eg: /job
   */
  applyMiddleware({ app, appType, appDomain, path: uri }) {
    this.executor.applyMiddleware({ app, appType, appDomain, uri })
    // register every 30 seconds. no register for more than 90 seconds, the schedule center will remove the executor.
    const registry = this.executor.registry.bind(this.executor)
    registry() && setInterval(registry, 30000)
  }

  /**
   * 关闭服务前应调用该方法，将执行器从调度中心摘除
   */
  async close() {
    await this.executor.registryRemove()
  }
}

module.exports = XxlJobExecutor
