import { CommonConstant } from '../../contants/CommonConstant';
import { Clock } from './Clock'
import { ClockRecord } from './ClockRecord'

@Entry
@Component
struct LearnTool {
  // 当前tab索引
  @State currentIndex: number = 0

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

  build() {
    Column() {
      Tabs({ barPosition: BarPosition.End }) {
        TabContent() {
          if (this.currentIndex === 0) {
            // 打卡
            Clock()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.clock_tab_title'), 0, $r('app.media.icon_bottom_home_default'),
          $r('app.media.icon_bottom_home_selected')))

        TabContent() {
          if (this.currentIndex === 1) {
            // 打卡记录
            ClockRecord()
          }
        }
        .tabBar(this.tabBuilder($r('app.string.record_tab_title'), 1, $r('app.media.icon_bottom_home_default'),
          $r('app.media.icon_bottom_home_selected')))

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