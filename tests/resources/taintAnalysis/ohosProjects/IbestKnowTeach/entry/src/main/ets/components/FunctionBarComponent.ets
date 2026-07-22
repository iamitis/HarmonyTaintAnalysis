import { CommonConstant } from '../contants/CommonConstant'
import { FunctionBarData } from '../models/FunctionBarData'
import { router } from '@kit.ArkUI'
import { PreferencesUtil } from '../utils/PreferencesUtil'
import { RouterConstant } from '../contants/RouterConstant'
import { IBestButton, IBestDialog, IBestDialogUtil } from '@ibestservices/ibest-ui'
import feedbackInfoApi from '../api/FeedbackInfoApi'
import { showToast } from '../utils/Toast'
import { ApplicationCheckUtil } from '../utils/ApplicationCheckUtil'

@Component
@Entry
export struct FunctionBarComponent {
  @State functionBarData: FunctionBarData = {
    icon: '',
    text: '',
    router: '',
    eventType: ''
  }
  // 反馈信息
  @State inputValue: string = ''
  @State formInputError: boolean = false
  @State dialogVisible: boolean = false

  @Builder
  formInputContain() {
    Column() {
      TextInput({ 'placeholder': '请输入反馈意见,长度不能超过255字符' })
        .fontSize(14)
        .placeholderFont({ size: 14 })
        .onChange((value) => {
          this.inputValue = value;
          this.formInputError = false
        })
      if (this.formInputError) {
        Text('反馈意见不能为空')
          .width(CommonConstant.WIDTH_FULL)
          .textAlign(TextAlign.Start)
          .margin({
            top: 5,
            left: 5
          })
          .fontColor(Color.Red)
          .fontSize($r('app.float.common_font_size_small'))
          .transition({ type: TransitionType.Insert, opacity: 1 })
          .transition({ type: TransitionType.Delete, opacity: 0 })
      }

    }.width('90%').margin({ top: 15, bottom: 15 })
  }

  build() {
    Row() {
      IBestDialog({
        visible: $dialogVisible,
        title: "反馈意见",
        showCancelButton: true,
        defaultBuilder: (): void => this.formInputContain(),
        beforeClose: async (action) => {
          if (action === 'cancel') {
            return true
          }
          const valueLength = this.inputValue.trim().length;
          this.formInputError = !valueLength;
          if (!this.formInputError) {
            // 添加反馈内容
            await feedbackInfoApi.addFeedbackContent({ content: this.inputValue })
            // 更新用户个人信息
            showToast('添加反馈意见成功')
            this.inputValue = ''
            return true
          }
          return !this.formInputError
        }
      })

      Row({ space: 10 }) {
        if (this.functionBarData.icon != '') {
          Image(this.functionBarData.icon)
            .width(30).aspectRatio(1)
        }
        Text(this.functionBarData.text)
          .fontSize($r('app.float.common_font_size_medium'))
          .fontWeight(FontWeight.Normal)
      }

      Image($r('app.media.icon_arrow'))
        .width(15).aspectRatio(1)

    }
    .width(CommonConstant.WIDTH_FULL)
    .height($r('app.float.common_height_small'))
    .backgroundColor($r('app.color.common_white'))
    .padding(10)
    .justifyContent(FlexAlign.SpaceBetween)
    .borderRadius(5)
    .onClick(() => {
      if (this.functionBarData.router) {
        router.pushUrl({ url: this.functionBarData.router })
      } else if (this.functionBarData.eventType === 'logout') {
        // 退出登录
        logout()
      } else if (this.functionBarData.eventType === 'feedback') {
        // 点击反馈
        this.dialogVisible = true
      } else if (this.functionBarData.eventType === 'checkAppUpdate') {
        // 检查更新
        ApplicationCheckUtil.checkAppUpdate()
      }
    })
  }
}

/**
 * 退出登录
 */
function logout() {
  IBestDialogUtil.open({
    title: "提示",
    message: "是否确认退出登录？",
    showCancelButton: true,
    onConfirm: async () => {
      // 清除登录的缓存数据,userInfo有订阅者删不掉，所以重新赋值空的给userInfo
      AppStorage.setOrCreate(CommonConstant.USER_INFO, {
        nickname: '',
        account: '',
        avatarUri: '',
        id: 0
      })
      AppStorage.delete(CommonConstant.TOKEN_NAME)
      await PreferencesUtil.delAllData(CommonConstant.PREFERENCES_NAME, CommonConstant.TOKEN_NAME)
      await PreferencesUtil.delAllData(CommonConstant.PREFERENCES_NAME, CommonConstant.USER_INFO)
      router.clear()
      // 路由到我的页面
      router.replaceUrl({
        url: RouterConstant.PAGE_INDEX, params: {
          "currentIndex": 3
        }
      })
    }
  })
}
