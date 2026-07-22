import { MessageListComponent } from '../../components/MessageListComponent'
import { CommonConstant } from '../../contants/CommonConstant'
import { router } from '@kit.ArkUI'
import messageApi from '../../api/MessageApi'
import { UserMessageInfo } from '../../api/MessageApi.type'
import { LoadingComponent } from '../../components/LoadingComponent'
import { showToast } from '../../utils/Toast'

@Entry
@Component
struct MessageList {
  // 页面标题
  @State title: string = '系统消息'
  // 类型
  @State type: string = '1'
  // 页面数据
  @State messageList: UserMessageInfo[] = []
  // 控制当前页面展示
  @State isShow: boolean = false
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false
  // 当前页
  @State page: number = 1
  // 每一页大小
  @State pageSize: number = 12
  // 当前消息数据总记录数
  @State total: number = 0
  // 是否展示文本，列表到底
  @State textShow: boolean = false

  aboutToAppear() {
    // 获取当前页面标题
    const param = router.getParams() as object
    if (param) {
      this.title = param["title"] as string
      this.type = param["type"] as string
      // 根据类型获取页面数据
      this.getMessageList(true, false)
    }
  }

  /**
   * 根据类型获取页面数据
   */
  async getMessageList(isFlushed: boolean, isUpdate: boolean) {
    // 查询接口
    const userMessagePageInfo =
      await messageApi.getMessageList({ type: this.type, page: this.page, pageSize: this.pageSize })
    // 判断是否是刷新还是下拉
    isFlushed ? this.messageList = userMessagePageInfo.records : this.messageList.push(...userMessagePageInfo.records);
    this.total = userMessagePageInfo.total
    // 判断总数据
    if (this.total > this.page * this.pageSize) {
      this.textShow = false
    } else {
      this.textShow = true
    }
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
    Navigation() {
      if (this.isShow) {
        // 刷新
        Refresh({ refreshing: $$this.isRefreshing }) {
          Column() {
            // 消息列表
            List({ space: 15 }) {
              ForEach(this.messageList, (item: UserMessageInfo) => {
                ListItem() {
                  // 消息内容
                  MessageListComponent({ userMessageInfo: item })
                }
              })
              if (this.textShow) {
                ListItem() {
                  Text($r('app.string.no_have_article'))
                    .fontColor($r('app.color.common_gray'))
                    .fontSize($r('app.float.common_font_size_small'))
                    .width(CommonConstant.WIDTH_FULL)
                    .textAlign(TextAlign.Center)
                    .margin({ top: 20 })
                }
              }
            }
            .scrollBar(BarState.Off)
            .onReachEnd(() => {
              if (!this.isLoad) {
                if (this.total > this.page * this.pageSize) {
                  this.isLoad = true
                  this.page++
                  this.getMessageList(false, false)
                } else {
                  this.textShow = true
                }
              }
            })

          }.padding($r('app.float.common_padding'))
          .height(CommonConstant.HEIGHT_FULL)
          .width(CommonConstant.WIDTH_FULL)
        }
        .onRefreshing(() => {
          if (!this.isLoad) {
            this.isLoad = true
            this.textShow = false
            // 页面恢复到1
            this.page = 1
            // 查询消息数据
            this.getMessageList(true, true)
          }
        })
      } else {
        // 加载组件
        LoadingComponent()
      }

    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title(this.title)
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}