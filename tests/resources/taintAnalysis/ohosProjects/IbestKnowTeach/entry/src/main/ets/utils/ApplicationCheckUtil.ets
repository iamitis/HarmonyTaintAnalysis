import { updateManager } from '@kit.StoreKit';
import type { common } from '@kit.AbilityKit';
import { Logger } from './Logger';
import { showToast } from './Toast';

let context: common.UIAbilityContext = getContext() as common.UIAbilityContext;

export class ApplicationCheckUtil {
  /**
   * 检测新版本
   */
  static async checkAppUpdate() {
    try {
      const checkResult = await updateManager.checkAppUpdate(context);
      if (checkResult.updateAvailable === 0) {
        showToast('当前应用版本已经是最新');
        return;
      }
      // 存在新版本，显示更新对话框
      const resultCode = await updateManager.showUpdateDialog(context);
      if (resultCode === 1) {
        showToast("检查更新失败，请稍后重试，或者在我的界面直接点击反馈将信息反馈给开发者")
        return
      }
    } catch (error) {
      Logger.error('TAG', `检查更新出错: code is ${error.code}, message is ${error.message}`);
      showToast("检查更新失败，请稍后重试，或者在我的界面直接点击反馈将信息反馈给开发者")
    }
  }
}

