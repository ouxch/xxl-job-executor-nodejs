const { isNilOrEmpty, notEmpty } = require("./utils/purefuncs");
const Executor = require("./executor");

class XxlJobExecutor {
  /**
   * 创建 XxlJobExecutor 实例
   * @param {Map<String, Function>} jobHandlers 所有的任务函数函数，key=>任务标识，即调度中心任务配置的JobHandler；value=>任务执行函数
   */
  constructor(jobHandlers) {
    const {
      XXL_JOB_EXECUTOR_KEY,
      XXL_JOB_SCHEDULE_CENTER_URL,
      XXL_JOB_ACCESS_TOKEN,
      XXL_JOB_JOB_LOG_PATH
    } = process.env
    const parameters = {
      XXL_JOB_EXECUTOR_KEY,
      XXL_JOB_SCHEDULE_CENTER_URL,
      XXL_JOB_ACCESS_TOKEN,
      XXL_JOB_JOB_LOG_PATH,
      jobHandlers,
    }
    const invalidParameters = Object.entries(parameters).filter(([ , value ]) => isNilOrEmpty(value))
    if (notEmpty(invalidParameters)) throw `invalid parameter: ${invalidParameters.map(([ key ]) => key).join(',')}`
    this.executor = new Executor(XXL_JOB_EXECUTOR_KEY, XXL_JOB_SCHEDULE_CENTER_URL, XXL_JOB_ACCESS_TOKEN, XXL_JOB_JOB_LOG_PATH, jobHandlers)
  }

  /**
   * 应用执行器组件
   * @param {Object} args
   * @param {any} args.app 执行器server, express or koa
   * @param {string} args.appType 执行器 server 类型，'EXPRESS' or 'KOA'
   * @param {string} args.appDomain 执行器 server 地址，eg: http://server-api.com
   * @param {string} args.path 执行器挂载的 uri 路径，eg: /job
   */
  async applyMiddleware({ app, appType, appDomain, path: uri }) {
    await this.executor.applyMiddleware({ app, appType, appDomain, uri })
  }

  /**
   * 关闭服务前应调用该方法，将执行器从调度中心摘除
   */
  async close() {
    await this.executor.registryRemove()
  }
}

module.exports = XxlJobExecutor
