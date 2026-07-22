import { CommonConstant } from '../contants/CommonConstant'
import { Home } from '../views/Home/Home'
import { Learn } from '../views/Learn/Learn'
import { Message } from '../views/Message/Message'
import { Mine } from '../views/Mine/Mine'
import { router } from '@kit.ArkUI'

@Entry
@Component
struct Index {
  // 当前tab索引,默认索引0是首页
  @State currentIndex: number = 0
  private tabsController: TabsController = new TabsController()

  @Builder
  tabBuilder(title: ResourceStr, targetIndex: number, normalImg: Resource, selectedImg: Resource) {
    Column() {
      Image(this.currentIndex === targetIndex ? selectedImg : normalImg)
        .width($r('app.float.common_width_tiny'))
        .aspectRatio(1)
      Text(title)
        .fontSize($r('app.float.common_font_size_small'))
        .fontWeight(FontWeight.Medium)
        .fontColor(this.currentIndex === targetIndex ? '#1698CE' : '#6B6B6B')
    }
    .width(CommonConstant.WIDTH_FULL)
    .height($r('app.float.common_height_small'))
    .justifyContent(FlexAlign.Center)
  }

  aboutToAppear(): void {
    // 获取路由到首页的当前页面索引
    const param = router.getParams() as object
    if (param) {
      const currentIndex = param["currentIndex"] as number
      if (currentIndex) {
        this.currentIndex = currentIndex
      }
    }
  }

  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End, index: this.currentIndex, controller: this.tabsController }) {
        TabContent() {
          if (this.currentIndex === 0) {
            // 首页
            Home()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.index_tab_title'), 0, $r('app.media.icon_bottom_home_default'),
          $r('app.media.icon_bottom_home_selected')))

        TabContent() {
          if (this.currentIndex === 1) {
            // 学习
            Learn()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.learn_tab_title'), 1, $r('app.media.icon_bottom_learn_default'),
          $r('app.media.icon_bottom_learn_selected')))

        TabContent() {
          if (this.currentIndex === 2) {
            // 消息
            Message()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.message_tab_title'), 2, $r('app.media.icon_bottom_message_default'),
          $r('app.media.icon_bottom_message_selected')))

        TabContent() {
          if (this.currentIndex === 3) {
            // 我的
            Mine()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.mine_tab_title'), 3, $r('app.media.icon_bottom_my_default'),
          $r('app.media.icon_bottom_my_selected')))
      }.onChange((currentIndex: number) => {
        this.currentIndex = currentIndex
      }).scrollable(false)
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}
