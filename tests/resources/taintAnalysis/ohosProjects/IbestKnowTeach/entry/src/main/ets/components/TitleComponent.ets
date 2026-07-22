import { CommonConstant } from '../contants/CommonConstant'

@Component
export struct TitleComponent {
  // 标题
  @Link title: string

  build() {
    Row() {
      Text(this.title)
        .fontSize($r('app.float.common_font_size_huge'))
        .fontWeight(FontWeight.Medium)
    }.width(CommonConstant.WIDTH_FULL)
    .margin({ top: 10, bottom: 20 })
  }
}