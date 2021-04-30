const {
  appName,
  hostname,
  port,
  'xxl-job-admin-address': adminAddress,
  'xxl-job-access-token': accessToken,
  'app-log-file': appLogFile,
  'app-log-dir': appLogDir,
  'job-log-dir': jobLogDir,
} = process.env

export default {
  appName,
  hostname,
  port,
  adminAddress,
  accessToken,
  executorUrl: `http://${hostname}:${port}/`,
  appLogFile,
  appLogDir,
  jobLogDir,
}
