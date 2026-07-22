import { FunctionBarComponent } from '../../components/FunctionBarComponent';
import { TitleComponent } from '../../components/TitleComponent';
import { CommonConstant } from '../../contants/CommonConstant';
import { RouterConstant } from '../../contants/RouterConstant';
import { DividerData } from '../../models/DividerData';
import { FunctionBarData } from '../../models/FunctionBarData';
import { router } from '@kit.ArkUI';
import { UserInfo } from '../../api/UserApi.type';

@Entry
@Component
export struct Mine {
  // 用户信息
  @StorageLink(CommonConstant.USER_INFO) userInfo: UserInfo = {
    nickname: '',
    account: '',
    avatarUri: '',
    id: 0
  }
  // 标题
  @State title: string = '我的'
  // 是否登录
  @State isLogin: boolean = false
  // 分割线
  @State egDivider: DividerData = new DividerData(1, 60, 10, '#ffe9f0f0')
  // 功能导航数据
  @State functionBarDataList: FunctionBarData[] = [
    { icon: $r('app.media.icon_mine_self'), text: '个人信息', router: RouterConstant.VIEWS_MINE_INFO },
    { icon: $r('app.media.icon_mine_collect'), text: '我的收藏', router: RouterConstant.VIEWS_MINE_COLLECT },
    { icon: $r('app.media.icon_mine_like'), text: '我的点赞', router: RouterConstant.VIEWS_MINE_LIKE },
    { icon: $r("app.media.icon_learn_clock"), text: '我的打卡', router: RouterConstant.VIEWS_LEARN_TOOL },
    { icon: $r('app.media.icon_mine_info'), text: '关于我们', router: RouterConstant.VIEWS_MINE_ABOUT_US },
    { icon: $r('app.media.icon_mine_feedback'), text: '点击反馈', eventType: 'feedback' },
    { icon: $r('app.media.icon_mine_setting'), text: '设置', router: RouterConstant.VIEWS_MINE_SET_UP },
  ]

  aboutToAppear() {
    // 获取用户信息
    const userInfo = AppStorage.get<UserInfo>(CommonConstant.USER_INFO);
    if (userInfo?.account) {
      this.isLogin = true
      this.userInfo = userInfo
    }
  }

  build() {
    Column() {
      // 标题栏
      TitleComponent({ title: this.title })
      Row({ space: 10 }) {
        // 判断是否登录
        if (this.isLogin) {
          // 头像信息
          Image(this.userInfo.avatarUri)
            .width($r('app.float.common_width_small'))
            .aspectRatio(1)
            .borderRadius(40)
            .objectFit(ImageFit.Auto)
            .shadow({
              radius: 15,
              color: '#0398FF',
              offsetX: 1,
              offsetY: 1
            })
            .onClick(() => {
              router.pushUrl({ url: RouterConstant.VIEWS_MINE_INFO })
            })
          Column({ space: 5 }) {
            // 昵称
            Text(this.userInfo.nickname)
              .fontWeight(FontWeight.Medium)
              .fontSize($r('app.float.common_font_size_medium'))
              .width('70%')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .onClick(() => {
                router.pushUrl({ url: RouterConstant.VIEWS_MINE_INFO })
              })
            // 编辑个人信息
            Text('编辑个人信息')
              .fontColor($r('app.color.common_gray'))
              .fontSize($r('app.float.common_font_size_small'))
              .onClick(() => {
                router.pushUrl({ url: RouterConstant.VIEWS_MINE_INFO })
              })
          }.width(CommonConstant.WIDTH_FULL).alignItems(HorizontalAlign.Start)
        } else {
          // 头像信息
          Image($r('app.media.icon_mine_avatar'))
            .width($r('app.float.common_width_small'))
            .aspectRatio(1)
            .borderRadius(40)
            .objectFit(ImageFit.Auto)
            .shadow({
              radius: 15,
              color: '#0398FF',
              offsetX: 1,
              offsetY: 1
            })
            .onClick(() => {
              router.pushUrl({ url: RouterConstant.PAGE_LOGIN })
            })
          Column({ space: 5 }) {
            // 登录
            Text('登录 / 注册')
              .fontWeight(FontWeight.Medium)
              .fontSize($r('app.float.common_font_size_medium'))
              .onClick(() => {
                router.pushUrl({ url: RouterConstant.PAGE_LOGIN })
              })
            // 登录后享受更多服务
            Text('登录后享受更多服务')
              .fontColor($r('app.color.common_gray'))
              .fontSize($r('app.float.common_font_size_small'))
              .onClick(() => {
                router.pushUrl({ url: RouterConstant.PAGE_LOGIN })
              })
          }.width(CommonConstant.WIDTH_FULL).alignItems(HorizontalAlign.Start)

        }
      }
      .width(CommonConstant.WIDTH_FULL)
      .height($r('app.float.common_height_big'))
      .padding(20)
      .borderRadius(20)
      .backgroundColor($r('app.color.common_white'))
      .margin({ bottom: 10 })

      // 我的页面主要功能
      List() {
        ForEach(this.functionBarDataList, (item: FunctionBarData) => {
          ListItem() {
            FunctionBarComponent({ functionBarData: item })
          }
        })
      }.divider(this.egDivider)

      // 退出登录
      FunctionBarComponent({
        functionBarData: {
          icon: $r('app.media.icon_mine_logout'),
          text: '退出登录',
          eventType: 'logout'
        }
      }).margin({ top: 10 })
    }
    .padding($r('app.float.common_padding'))
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
  }
}
