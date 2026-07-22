import { webview } from '@kit.ArkWeb'
import { CommonConstant } from '../contants/CommonConstant'

@Entry
@Component
struct PolicyPage {
  webViewController: webview.WebviewController = new webview.WebviewController

  build() {
    Navigation() {
      Web({
        src: $rawfile("PrivacyPolicy.html"),
        controller: this.webViewController
      })
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.privacy_policy'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}