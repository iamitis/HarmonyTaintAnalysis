import { CommonConstant } from '../../contants/CommonConstant'

@Entry
@Component
struct AboutUS {
  build() {
    Navigation() {
      Column() {
        Column() {
          Image($r("app.media.app_icon"))
            .width($r('app.float.common_width_medium'))
            .borderRadius(30)
          Text($r("app.string.application_name"))
            .fontSize(19)
            .fontColor("#121826")
            .fontWeight(FontWeight.Medium)
            .margin(12)
          Text($r("app.string.app_description"))
            .fontColor("#6F6F6F")
            .fontSize(14)
          Text("版本号：V1.0.0")
            .margin(18)
            .fontSize(14)
            .fontColor("#979797")
        }

        Row() {
          Text('百得知识库是安徽百得思维信息科技有限公司研发的一款编程知识分享的App')
            .fontSize(14)
            .fontColor("#979797")
        }
      }.padding(60).height("100%").justifyContent(FlexAlign.SpaceBetween)
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.about_us_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundImage($r('app.media.background'))
    .backgroundImageSize({ width: CommonConstant.WIDTH_FULL, height: CommonConstant.HEIGHT_FULL })
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}