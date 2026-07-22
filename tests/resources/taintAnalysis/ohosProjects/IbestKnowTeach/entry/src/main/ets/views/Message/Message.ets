import { MessageComponent } from '../../components/MessageComponent';
import { TitleComponent } from '../../components/TitleComponent';
import { CommonConstant } from '../../contants/CommonConstant';
import { router } from '@kit.ArkUI';
import { RouterConstant } from '../../contants/RouterConstant';
import { ProgressDialog } from '../../components/ProgressDialog';
import messageApi from '../../api/MessageApi';
import { MessageInfoNew, UserMessageCount } from '../../api/MessageApi.type';
import { LoadingComponent } from '../../components/LoadingComponent';
import { showToast } from '../../utils/Toast';

@Entry
@Component
export struct Message {
  @State title: string = '消息'
  // 消息总数量和未读
  @State userMassageCount: UserMessageCount = {
    totalQuantity: 0,
    totalUnReadQuantity: 0,
    systemUnReadQuantity: 0,
    noticeUnReadQuantity: 0
  }
  // 最新消息
  @State messageInfoNew: MessageInfoNew[] = []
  // 控制当前页面展示
  @State isShow: boolean = false
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false

  /**
   * 生命周期函数
   */
  async aboutToAppear() {
    this.getMessageData(false)
  }

  /**
   * 获取消息数据
   * @param isUpdate
   */
  async getMessageData(isUpdate: boolean) {
    // 查询用户获得的消息总数量和未读
    const userMassageCount = await messageApi.getUserMessageCount()
    this.userMassageCount = userMassageCount
    // 获取最新消息
    this.messageInfoNew = await messageApi.getMessageNew()
    // 页面展示数据
    this.isShow = true
    // 节流，防止用户重复下拉
    this.isLoad = false
    this.isRefreshing = false
    // 是否刷新
    if (isUpdate) {
      showToast("已更新")
    }
  }

  build() {
    Column() {
      // 标题栏
      TitleComponent({ title: this.title })
      if (this.isShow) {
        Refresh({ refreshing: $$this.isRefreshing }) {
          Column() {
            // 消息统计
            Row({ space: 10 }) {
              Text('共' + this.userMassageCount.totalQuantity + '条信息')
                .fontColor($r('app.color.common_gray'))
                .fontSize($r('app.float.common_font_size_medium'))
                .fontWeight(FontWeight.Medium)

              Text('(未读' + this.userMassageCount.totalUnReadQuantity + '条)')
                .fontColor('#406EFE')
                .fontSize($r('app.float.common_font_size_medium'))
                .fontWeight(FontWeight.Medium)
            }.width(CommonConstant.WIDTH_FULL)
            .justifyContent(FlexAlign.Start)
            .margin({ bottom: 15 })


            // 消息标题
            Column({ space: 15 }) {
              MessageComponent({
                icon: $r('app.media.icon_system_message'),
                title: '系统消息',
                content: this.messageInfoNew[0].content,
                unReadCount: this.userMassageCount.systemUnReadQuantity
              })
                .onClick(() => {
                  // 路由到消息内容主体页面
                  router.pushUrl({
                    url: RouterConstant.VIEWS_MESSAGE_LIST, params: {
                      "type": '1',
                      "title": '系统消息'
                    }
                  })
                })
              MessageComponent({
                icon: $r('app.media.icon_public_message'),
                title: '通知公告',
                content: this.messageInfoNew[1].content,
                unReadCount: this.userMassageCount.noticeUnReadQuantity
              })
                .onClick(() => {
                  // 路由到消息内容主体页面
                  router.pushUrl({
                    url: RouterConstant.VIEWS_MESSAGE_LIST, params: {
                      "type": '2',
                      "title": '通知公告'
                    }
                  })
                })
            }
          }
          .height(CommonConstant.HEIGHT_FULL)
        }.onRefreshing(() => {
          if (!this.isLoad) {
            this.isLoad = true
            // 查询消息数据
            this.getMessageData(true)
          }
        })

      } else {
        // 加载组件
        LoadingComponent()
      }

    }
    .padding($r('app.float.common_padding'))
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
  }
}