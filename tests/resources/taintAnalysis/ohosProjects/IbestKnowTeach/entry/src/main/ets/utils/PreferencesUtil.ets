import { preferences } from '@kit.ArkData'

export class PreferencesUtil {
  /**
   * 保存数据到首选项
   * @param preferencesName
   * @param key
   * @param value
   */
  static async savaData<T extends keyof number | number | string | boolean | Array<number> | Array<string> | Array<boolean>>(preferencesName: string,
    key: string, value: T) {
    const pre = preferences.getPreferencesSync(getContext(), { name: preferencesName })
    pre.putSync(key, value as preferences.ValueType)
    await pre.flush()
  }

  /**
   * 获取数据
   * @param preferencesName
   * @param key
   * @param defaultValue
   * @returns
   */
  static getData<T extends keyof number | number | string | boolean | Array<number> | Array<string> | Array<boolean>>(preferencesName: string,
    key: string, defaultValue: T) {
    const pre = preferences.getPreferencesSync(getContext(), { name: preferencesName })
    return pre.getSync(key, defaultValue as preferences.ValueType) as T
  }

  /**
   * 删除数据
   * @param preferencesName
   * @param key
   */
  static async delAllData(preferencesName: string, key: string) {
    const pre = preferences.getPreferencesSync(getContext(), { name: preferencesName })
    pre.deleteSync(key)
    await pre.flush()
  }
}