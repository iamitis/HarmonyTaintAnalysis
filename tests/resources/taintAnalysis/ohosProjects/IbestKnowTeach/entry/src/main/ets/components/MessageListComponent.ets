import { IBestDialogUtil } from '@ibestservices/ibest-ui'
import messageApi from '../api/MessageApi'
import { UserMessageInfo } from '../api/MessageApi.type'
import { CommonConstant } from '../contants/CommonConstant'
import { Logger } from '../utils/Logger'

@Component
export struct MessageListComponent {
  // 用户消息
  @State userMessageInfo: UserMessageInfo = {
    id: 1,
    isLook: '0',
    title: '',
    content: '',
    time: ''
  }

  /**
   * 点击消息
   */
  async clickMessage() {
    // 根据id获取消息详情
    this.userMessageInfo = await messageApi.getMessageInfo(this.userMessageInfo.id)
    IBestDialogUtil.open({
      title: "消息内容",
      message: this.userMessageInfo.content,
      onConfirm: () => {
        Logger.info('confirm message info')
      }
    })
  }

  build() {
    Row({ space: 15 }) {
      Column({ space: 10 }) {
        Row() {
          Badge({
            count: this.userMessageInfo.isLook === '0' ? 1 : 0,
            position: BadgePosition.RightTop,
            style: { badgeSize: 5, badgeColor: '#FA2A2D' }
          }) {
            Text(this.userMessageInfo.title)
              .fontWeight(FontWeight.Medium)
              .fontSize($r('app.float.common_font_size_medium'))
              .width('80%')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }

          Text(this.userMessageInfo.time)
            .textStyles()
        }.width(CommonConstant.WIDTH_FULL).justifyContent(FlexAlign.SpaceBetween)


        Text(this.userMessageInfo.content)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textStyles()
      }.height($r('app.float.common_height_medium')).justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Start)

    }
    .width(CommonConstant.WIDTH_FULL)
    .height($r('app.float.common_height_medium'))
    .backgroundColor($r('app.color.common_white'))
    .borderRadius(10)
    .padding($r('app.float.common_padding'))
    .onClick(() => {
      // 点击消息
      this.clickMessage()
    })
  }
}

@Extend(Text)
function textStyles() {
  .fontColor($r('app.color.common_gray'))
  .fontSize($r('app.float.common_font_size_small'))
}