import { hilog } from '@kit.PerformanceAnalysisKit'

const DOMAIN = 0x0000
const TAG = 'wdl'
const FORMAT = '%{public}s %{public}s'

export class Logger {
  static debug(...args: string[]) {
    hilog.debug(DOMAIN, TAG, FORMAT, args)
  }

  static info(...args: string[]) {
    hilog.info(DOMAIN, TAG, FORMAT, args)
  }

  static warn(...args: string[]) {
    hilog.warn(DOMAIN, TAG, FORMAT, args)
  }

  static error(...args: string[]) {
    hilog.error(DOMAIN, TAG, FORMAT, args)
  }
}