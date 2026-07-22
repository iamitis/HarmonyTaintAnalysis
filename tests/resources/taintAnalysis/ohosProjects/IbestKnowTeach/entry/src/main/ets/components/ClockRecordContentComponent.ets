import { UserLearnClockData } from '../api/LearnClockApi.type'
import { CommonConstant } from '../contants/CommonConstant'

@Component
export struct ClockRecordContentComponent {
  // 打卡数据
  @State clockRecord: UserLearnClockData = {
    id: 1,
    location: '',
    content: '',
    nickname: '',
    time: ''
  }

  build() {
    Column() {
      Row() {
        Text(this.clockRecord.nickname)
          .fontSize($r('app.float.common_font_size_medium'))
          .fontWeight(FontWeight.Medium)
          .width('60%')
          .fontColor($r('app.color.common_gray'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.clockRecord.location).fontSize($r('app.float.common_font_size_small'))
      }.width(CommonConstant.WIDTH_FULL)
      .padding(10)
      .justifyContent(FlexAlign.SpaceBetween)

      Row() {
        Text(this.clockRecord.content).textStyles()
        Text(this.clockRecord.time).textStyles()
      }.width(CommonConstant.WIDTH_FULL).padding(10)
      .justifyContent(FlexAlign.SpaceBetween)

    }
    .width(CommonConstant.WIDTH_FULL)
    .height(80)
    .margin({ bottom: 10 })
    .backgroundColor($r('app.color.common_white'))
    .justifyContent(FlexAlign.SpaceBetween)
    .borderRadius(10)
  }
}

@Extend(Text)
function textStyles() {
  .fontSize($r('app.float.common_font_size_small'))
  .fontColor($r('app.color.common_gray'))
}