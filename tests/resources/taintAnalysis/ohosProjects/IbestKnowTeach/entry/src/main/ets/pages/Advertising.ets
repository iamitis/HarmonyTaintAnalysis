import { CommonConstant } from '../contants/CommonConstant';
import { router } from '@kit.ArkUI';
import { RouterConstant } from '../contants/RouterConstant';
import { PreferencesUtil } from '../utils/PreferencesUtil';

@Entry
@Component
struct Advertising {
  // 展示开屏页面时间,单位秒
  @State countDownSeconds: number = CommonConstant.ADVERTISING_TIME;
  // 结束时间,单位秒
  endTime: number = CommonConstant.ADVERTISING_END_TIME;

  /**
   * 生命周期函数
   */
  onPageShow() {
    this.endTime = setInterval(async () => {
      if (this.countDownSeconds === CommonConstant.ADVERTISING_END_TIME) {
        // 清除定时器
        clearInterval(this.endTime);
        // 获取对应的token等数据
        const token = PreferencesUtil.getData(CommonConstant.PREFERENCES_NAME, CommonConstant.TOKEN_NAME, '')
        const userInfo = PreferencesUtil.getData(CommonConstant.PREFERENCES_NAME, CommonConstant.USER_INFO, '')
        if (token && userInfo) {
          AppStorage.setOrCreate(CommonConstant.TOKEN_NAME, token)
          AppStorage.setOrCreate(CommonConstant.USER_INFO, JSON.parse(userInfo))
        }
        // 跳转到首页
        router.replaceUrl({ url: RouterConstant.PAGE_INDEX })
      } else {
        this.countDownSeconds--;
      }
    }, 1000);
  }

  /**
   * 生命周期函数：隐藏页面
   */
  onPageHide() {
    // 清除定时任务
    clearInterval(this.endTime);
  }

  build() {
    Column() {
      Row() {
        Text(this.countDownSeconds.toString() + 's')
          .fontColor($r('app.color.common_white'))
          .fontSize($r('app.float.common_font_size_medium'))
          .width(40)
          .height($r('app.float.common_height_tiny'))
          .backgroundColor($r('app.color.common_gray'))
          .textAlign(TextAlign.Center)
          .borderRadius(10)
      }.padding($r('app.float.common_padding'))
      .width(CommonConstant.WIDTH_FULL)
      .justifyContent(FlexAlign.End)
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .backgroundImage($r('app.media.advertising'))
    .backgroundImageSize({ width: CommonConstant.WIDTH_FULL, height: CommonConstant.HEIGHT_FULL })
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}