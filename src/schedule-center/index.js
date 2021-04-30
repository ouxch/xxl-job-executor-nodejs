import config from '@src/config'
import EventEmitter from 'events'
import logger from '@src/utils/logger'
import { compose, format, omitNil, postTask, propOr, tapTask, Task } from '@src/utils/purefuncs'

const { accessToken, adminAddress, appName, executorUrl } = config
const log = logger('schedule-center')
const headers = { 'xxl-job-access-token': accessToken }
const xxlPost = ({ url, data }) => postTask(url, data, { headers })
const formatResData = compose(format, propOr({}, 'data'))

/**
 * registry executor emitter
 */
class RegistryEmitter extends EventEmitter {}
const registryEmitter = new RegistryEmitter()
const registryEmitterEvent = 'REGISTRY_EXECUTOR'
registryEmitter.on('error', (err) => log.err('registryEmitter on error:', err))
registryEmitter.on(registryEmitterEvent, async () => await registryTask.run().promise())

// executor registry
const registryUrl = `${adminAddress}/api/registry`
const registryData = { 'registryGroup': 'EXECUTOR', 'registryKey': appName, 'registryValue': executorUrl }
const registryTask = Task.of({ url: registryUrl, data: registryData })
  // The executor needs to register with the schedule center every 30 seconds.
  // Do not register for more than 90 seconds, the schedule center will remove the executor.
  .chain(tapTask(() => setTimeout(() => registryEmitter.emit(registryEmitterEvent), 30000)))
  .chain(xxlPost)
  .chain(tapTask((response) => log.info(`registry ==> ${formatResData(response)}`)))
  .orElse((err) => {
    log.err(`registry error:${propOr(err.toString(), 'message', err)}`)
    return Task.of()
  })

// executor registry remove
const registryRemoveUrl = `${adminAddress}/api/registryRemove`
const registryRemoveData = { 'registryGroup': 'EXECUTOR', 'registryKey': appName, 'registryValue': executorUrl }
const registryRemoveTask = Task.of({ url: registryRemoveUrl, data: registryRemoveData })
  .chain(xxlPost)
  .chain(tapTask((response) => log.info(`registry remove ==> ${formatResData(response)}`)))
  .orElse((err) => {
    log.err(`registry remove error:${propOr(err.toString(), 'message', err)}`)
    return Task.of()
  })

// callback when job execute finish
const callbackUrl = `${adminAddress}/api/callback`
const callbackTask = ({ logId, handleCode = 200, handleMsg = 'success' }) => {
  const data = [omitNil({ logId, logDateTim: Date.now(), handleCode, handleMsg })]
  return Task.of({ url: callbackUrl, data })
    .chain(xxlPost)
    .chain(tapTask((response) => log.info(`callback ==> ${format(data)} ==> ${formatResData(response)}`)))
    .orElse((err) => {
      log.err(`callback error:${propOr(err.toString(), 'message', err)}`)
      return Task.of({})
    })
}

export { registryTask, registryRemoveTask, callbackTask }
