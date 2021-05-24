const fs = require('fs')
const os = require('os')
const { format } = require('./purefuncs')
const debug = require('debug')

const dErr = debug('error')
const dInfo = debug('info ')
const dWarn = debug('warn ')
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
    const writeStream = fs.createWriteStream(logFilePath, {
      flags: 'w',
      encoding: 'utf8',
      autoClose: true,
      emitClose: true
    })
    const write = (...data) => {
      const content = data.map((ele) => typeof ele === 'string' ? ele : format(ele)).join(' ')
      writeStream.write(`${content}${os.EOL}`)
    }
    Object.keys(logger).forEach((funcName) => logger[funcName].log = write)
    logger.closeLogger = () => writeStream.end()
  }
  return logger
}
