/*import area*/
const logger = require('../utils/logger')
const log = logger('xxl-job-executor')
const { compose, format, omitNil, propOr, postTask, Task, tapTask } = require('../utils/purefuncs')
const formatData = compose(format, propOr({}, 'data'))
const xxlPostTask = ({ url, data, postConfig }) => postTask(url, data, postConfig)

/*variable area*/
let XXL_HEADERS
let REGISTRY_URL
let REGISTRY_BODY
let REGISTRY_REMOVE_URL
let REGISTRY_REMOVE_BODY
let CALLBACK_URL

/*function area*/
/**
 * register executor to schedule center on startup
 */
const registry = () => {
  Task.of({ url: REGISTRY_URL, data: REGISTRY_BODY, postConfig: { headers: XXL_HEADERS } })
    .chain(xxlPostTask)
    .chain(tapTask((response) => log.info(`registry ==> ${format(REGISTRY_BODY)} ==> ${formatData(response)}`)))
    .orElse((err) => {
      log.err(`registry error:${propOr(err.toString(), 'message', err)}`)
      return Task.of()
    })
    // The executor needs to register with the schedule center every 30 seconds.
    // Do not register for more than 90 seconds, the schedule center will remove the executor.
    .chain(tapTask(() => setTimeout(registry, 30000)))
    .run().promise()
}
/**
 * remove executor from schedule center on shutdown
 */
const removeWhenShutDown = () => {
  process.on('SIGINT', async () => {
    await Task.of({ url: REGISTRY_REMOVE_URL, data: REGISTRY_REMOVE_BODY, postConfig: { headers: XXL_HEADERS } })
      .chain(xxlPostTask)
      .chain(tapTask((response) => log.info(`registry remove ==> ${format(REGISTRY_REMOVE_BODY)} ==> ${formatData(response)}`)))
      .orElse((err) => {
        log.err(`registry remove error:${propOr(err.toString(), 'message', err)}`)
        return Task.of()
      }).run().promise()
    process.exit(1)
  })
}
/**
 * report job result to schedule center when job execute finish
 */
const callback = async ({ logId, handleCode = 200, handleMsg = 'success' }) => {
  const data = [omitNil({ logId, logDateTim: Date.now(), handleCode, handleMsg })]
  await Task.of({ url: CALLBACK_URL, data, postConfig: { headers: XXL_HEADERS } })
    .chain(xxlPostTask)
    .chain(tapTask((response) => log.info(`callback ==> ${format(data[0])} ==> ${formatData(response)}`)))
    .orElse((err) => {
      log.err(`callback error:${propOr(err.toString(), 'message', err)}`)
      return Task.of({})
    }).run().promise()
}

const initScheduleCenter = (scheduleCenterUrl, executorKey, executorUrl, accessToken) => {
  XXL_HEADERS = { 'xxl-job-access-token': accessToken }
  REGISTRY_URL = `${scheduleCenterUrl}/api/registry`
  REGISTRY_BODY = { 'registryGroup': 'EXECUTOR', 'registryKey': executorKey, 'registryValue': executorUrl }
  REGISTRY_REMOVE_URL = `${scheduleCenterUrl}/api/registryRemove`
  REGISTRY_REMOVE_BODY = { 'registryGroup': 'EXECUTOR', 'registryKey': executorKey, 'registryValue': executorUrl }
  CALLBACK_URL = `${scheduleCenterUrl}/api/callback`

  registry()
  removeWhenShutDown()
}

/*export area*/
module.exports = { initScheduleCenter, callback }
