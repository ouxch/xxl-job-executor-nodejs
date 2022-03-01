const { once } = require('events')
const fs = require('fs')
const readline = require('readline')

const mkdir = (path) => !fs.existsSync(path) && fs.mkdirSync(path, { recursive: true })

const searchInFile = async (filePath, content, endContent) => {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  const reg = content ? new RegExp(content, 'i') : undefined
  const endReg = endContent ? new RegExp(endContent, 'i') : undefined
  const lines = []
  let stop = false
  rl.on('line', (line) => {
    if (stop) {
      rl.close()
      return
    }
    reg && reg.test(line) && lines.push(line)
    endReg && endReg.test(line) && (stop = true) && rl.close()
  })
  await once(rl, 'close')
  return lines
}

module.exports = {
  mkdir,
  searchInFile,
}
