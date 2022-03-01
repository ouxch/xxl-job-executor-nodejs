/**
 * demo任务
 * @param {any} jobLogger 由xxl-job组件定义的任务logger，会将日志内容输出到文件，可在调度中心查看执行日志
 * @param {{ jobParam1: any, jobParam2: any }} jobParams 任务参数
 * @param {Object} context 任务上下文
 * @return {Promise<void>} 函数必须返回一个 promise
 */
const demoJobHandler = async (jobLogger, jobParams, context) => {
  jobLogger.debug('params: %o, context: %o', jobParams, context)
  const sleep = async (millis) => new Promise((resolve) => setTimeout(resolve, millis))
  for (let i = 1; i < 10; i++) {
    await sleep(1000)
    jobLogger.debug(`${i}s passed`)
  }
}

module.exports = {
  jobHandlers: new Map([
    ['demoJobHandler', demoJobHandler],
  ]),
}
