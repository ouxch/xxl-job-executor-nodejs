import { demoJobHandler } from '@src/job-handlers/demo-job-handler'

export default new Map([
  // note: jobHandler must be a promise function
  ['demo-job-handler', demoJobHandler],
])
