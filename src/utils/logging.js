import * as rfs from 'rotating-file-stream'
import config from '@src/config'
import { mkdir } from '@src/utils/purefuncs'

const { appLogFile, appLogDir, jobLogDir } = config
const pad = (num) => (num > 9 ? '' : '0') + num

// ensure log dir
mkdir(appLogDir)
mkdir(jobLogDir)

const generator = (time, index) => {
  if (!time) return appLogFile

  const yyyyMM = time.getFullYear() + '' + pad(time.getMonth() + 1)
  const DD = pad(time.getDate())
  const HH = pad(time.getHours())
  const mm = pad(time.getMinutes())
  const ss = pad(time.getSeconds())
  return `${yyyyMM}/${yyyyMM}${DD}-${HH}${mm}${ss}-${index}-${appLogFile}.log`
}
const stream = rfs.createStream(generator, { interval: '1d', path: appLogDir, compress: 'gzip', size: '100M' })

export default () => {
  process.stdout.write = process.stderr.write = stream.write.bind(stream)
}
