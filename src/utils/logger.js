import fs from 'fs'
import os from 'os'
import { format } from '@src/utils/purefuncs'

const debug = require('debug')

const dErr = debug('error')
const dInfo = debug('info')
const dWarn = debug('warn')
const dDebug = debug('debug')
const dTrace = debug('trace')

module.exports = (ns, logFilePath) => {
  const logger = {
    info: dInfo.extend(ns),
    err: dErr.extend(ns),
    debug: dDebug.extend(ns),
    warn: dWarn.extend(ns),
    trace: dTrace.extend(ns),
  }
  if (!!logFilePath) {
    const logFunc = (...data) => {
      const content = data.map((value) => typeof(value) === 'string' ? value : format(value)).join(' ')
      fs.writeFileSync(logFilePath, content + os.EOL, { flag: 'a' })
    }
    Object.keys(logger).forEach((funcName) => logger[funcName].log = logFunc)
  }
  return logger
}
