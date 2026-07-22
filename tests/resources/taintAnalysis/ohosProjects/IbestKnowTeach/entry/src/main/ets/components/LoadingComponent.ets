import { CommonConstant } from '../contants/CommonConstant'

@Component
export struct LoadingComponent {
  @State message: string = '数据正在加载中'

  build() {
    Row() {
      LoadingProgress()
        .width(30).height(30).color(Color.Gray)
      Text(this.message)
        .fontSize((14)).fontColor(Color.Gray)
    }.height("80%")
    .width(CommonConstant.WIDTH_FULL)
    .justifyContent(FlexAlign.Center)
  }
}