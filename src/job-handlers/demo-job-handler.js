import { sleep } from '@src/utils/purefuncs'
export const demoJobHandler = async ({ log }) => {
  log.info('job start, it will takes about 10 seconds')
  await sleep(10000)
  log.info('job finish')
}
