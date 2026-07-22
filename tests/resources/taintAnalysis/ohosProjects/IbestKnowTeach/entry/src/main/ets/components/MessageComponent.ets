import { CommonConstant } from '../contants/CommonConstant'

@Component
export struct MessageComponent {
  @State icon: ResourceStr = ''
  @State title: string = ''
  @Prop content: string
  @Prop unReadCount: number

  build() {
    Row({ space: 15 }) {
      Badge({
        count: this.unReadCount,
        position: BadgePosition.RightTop,
        style: { badgeSize: 15, badgeColor: '#FA2A2D' }
      }) {
        Image(this.icon)
          .width($r('app.float.common_width_small')).aspectRatio(1)
      }

      Column({ space: 10 }) {
        Text(this.title)
          .fontWeight(FontWeight.Medium)
          .fontSize($r('app.float.common_font_size_medium'))
        Text(this.content)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .fontColor($r('app.color.common_gray'))
          .fontSize($r('app.float.common_font_size_small'))
      }.height(80).justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)
      .width('80%')
    }
    .width(CommonConstant.WIDTH_FULL)
    .height(80)
    .backgroundColor($r('app.color.common_white'))
    .borderRadius(15)
    .padding(10)
  }
}