import promptAction from '@ohos.promptAction'

/**
 * 显示toast
 * @param { string } message 显示的信息
 */
export function showToast(message: string) {
  promptAction.showToast({
    message: message || '请求错误',
    duration: 2000,
  })
}