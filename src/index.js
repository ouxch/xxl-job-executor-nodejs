const { initExecutor, koaRestRouter, expressRestRouter } = require('./executor')
/**
 * apply xxl-job-executor middleware
 * @param {String} uri eg:'/xxl-job-executor'
 * @param {any} app express app or koa app
 * @param {String} appType express or koa
 * @param {String} scheduleCenterUrl xxl-job-admin address: http://host:port/xxl-job-admin
 * @param {String} executorKey the executor's name, configure executor in schedule center need this. eg:'xa-circle-api'
 * @param {String} executorUrl executor own address: http://host:port/xxl-job-executor
 * @param {String} accessToken just allow communication between schedule center and executor when AccessToken of each other matched
 * @param {String} jobLogPath job log will be stored in the specified location in a specific format(2021-05-01-logId.log)
 * @param {Map<String, Function>} jobHandlers all job functions, note that the function must be declared as a promise function
 */
const applyExecutorMiddleware = ({ uri, app, appType, scheduleCenterUrl, executorKey, executorUrl, accessToken, jobLogPath, jobHandlers }) => {
  if (appType === 'express') {
    let router = expressRestRouter(accessToken)
    app.use(uri, router)
  } else if (appType === 'koa') {
    const router = koaRestRouter(uri, accessToken)
    app.use(router.routes())
  } else {
    throw 'unsupported appType, only express or koa'
  }
  initExecutor(scheduleCenterUrl, executorKey, executorUrl, accessToken, jobLogPath, jobHandlers)
}
module.exports = applyExecutorMiddleware
