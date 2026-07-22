import { FunctionBarComponent } from '../../components/FunctionBarComponent'
import { CommonConstant } from '../../contants/CommonConstant'
import { RouterConstant } from '../../contants/RouterConstant'
import { DividerData } from '../../models/DividerData'
import { FunctionBarData } from '../../models/FunctionBarData'

@Entry
@Component
struct SetUp {
  @State functionBarDataList: FunctionBarData[] = [
    { icon: '', text: '编辑资料', router: RouterConstant.VIEWS_MINE_INFO },
    { icon: '', text: '隐私政策', router: RouterConstant.PAGE_PRIVACY_POLICY },
    { icon: '', text: '当前版本', router: RouterConstant.VIEWS_MINE_ABOUT_US },
    { icon: '', text: '检查更新', eventType: 'checkAppUpdate' },
  ]
  // list组件分割线
  @State egDivider: DividerData = new DividerData(1, 60, 10, '#ffe9f0f0')

  build() {
    Navigation() {

      Column() {
        // 我的页面主要功能
        List() {
          ForEach(this.functionBarDataList, (item: FunctionBarData) => {
            ListItem() {
              FunctionBarComponent({ functionBarData: item })
            }
          })
        }.divider(this.egDivider)
      }.padding($r('app.float.common_padding'))

    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.set_up_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}