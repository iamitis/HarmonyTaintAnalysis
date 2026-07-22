import targetInfoApi from '../../api/TargetInfoApi'
import { TargetInfoCountVo, TargetInfoVo } from '../../api/TargetInfoApi.type'
import { LearnTargetContentComponent } from '../../components/LearnTargetContentComponent'
import { LoadingComponent } from '../../components/LoadingComponent'
import { CommonConstant } from '../../contants/CommonConstant'
import { IBestDialog, IBestDialogUtil } from "@ibestservices/ibest-ui"
import { showToast } from '../../utils/Toast'
import { router } from '@kit.ArkUI'
import { RouterConstant } from '../../contants/RouterConstant'

@Entry
@Component
struct LearnTarget {
  // 目标数据
  @State targetInfoVos: TargetInfoVo[] = []
  // 控制当前页面展示
  @State isShow: boolean = false
  // 目标进度统计
  @State countData: TargetInfoCountVo = { totalQuantity: 0, completeQuantity: 0, updateTime: '' }
  // 目标进度总记录数
  @State total: number = 0
  // 当前页
  @State page: number = 1
  // 每一页大小
  @State pageSize: number = 10
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false
  // 是否展示文本，列表到底
  @State textShow: boolean = false
  // 输入框目标里面的值
  @State inputTargetValue: string = ''
  @State formInputError: boolean = false
  @State dialogVisible: boolean = false

  /**
   * 生命周期
   */
  aboutToAppear() {
    this.getUserTargetData(true, false)
  }

  /**
   * 获取用户目标数据
   * @param isFlushed
   * @param isUpdate
   */
  async getUserTargetData(isFlushed: boolean, isUpdate: boolean) {
    // 获取用户整体目标完成进度统计
    this.countData = await targetInfoApi.getTargetInfoCount()
    // 分页查询用户整体目标
    const pageResult = await targetInfoApi.pageListTargetInfo({ page: this.page, pageSize: this.pageSize })
    this.total = pageResult.total
    // 判断总数据
    if (this.total > this.page * this.pageSize) {
      this.textShow = false
    } else {
      this.textShow = true
    }
    // 判断是否是刷新还是下拉
    isFlushed ? this.targetInfoVos = pageResult.records : this.targetInfoVos.push(...pageResult.records)
    // 展示页面数据
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
        IBestDialog({
          visible: $dialogVisible,
          title: "添加目标",
          showCancelButton: true,
          defaultBuilder: (): void => this.formInputContain(),
          beforeClose: async (action) => {
            if (action === 'cancel') {
              return true
            }
            const valueLength = this.inputTargetValue.trim().length;
            this.formInputError = !valueLength;
            if (!this.formInputError) {
              // 添加新目标
              await targetInfoApi.addTargetInfo({ content: this.inputTargetValue })
              showToast('添加目标成功')
              // 查询数据
              this.page = 1
              this.aboutToAppear()
              return true
            }
            return !this.formInputError
          }
        })
        Column() {
          // 整体进度
          Row() {
            Column() {
              Text('整体进度')
                .fontSize($r('app.float.common_font_size_big'))
                .fontWeight(FontWeight.Medium)
                .fontColor('#191919')
                .margin({ bottom: 10 })
              Text(this.countData.updateTime)
                .fontColor($r('app.color.common_gray'))
                .fontSize($r('app.float.common_font_size_tiny'))
            }.alignItems(HorizontalAlign.Start)

            // 环形进度条
            Stack() {
              Progress({
                value: this.countData.completeQuantity,
                total: this.countData.totalQuantity,
                type: ProgressType.Ring
              })
                .width($r('app.float.common_width_medium'))
                .height($r('app.float.common_height_medium'))
                .color('#1698CE')
                .style({ strokeWidth: 8 })
              Text(this.countData.completeQuantity + '/' + this.countData.totalQuantity)
                .fontSize($r('app.float.common_font_size_tiny'))
            }
          }.width(CommonConstant.WIDTH_FULL)
          .justifyContent(FlexAlign.SpaceBetween)

        }.padding($r('app.float.common_padding'))

        // 分割线
        Divider()
          .strokeWidth((4))
          .color('#FFFFFF')

        // 子目标
        Row() {
          Text('子目标')
            .fontSize($r('app.float.common_font_size_big')).fontWeight(FontWeight.Medium)
            .fontColor('#191919')
          Image($r('app.media.icon_add'))
            .width(30)
            .aspectRatio(1)
            .onClick(() => {
              this.dialogVisible = true
            })

        }
        .width(CommonConstant.WIDTH_FULL)
        .padding($r('app.float.common_padding'))
        .justifyContent(FlexAlign.SpaceBetween)

        Refresh({ refreshing: $$this.isRefreshing }) {
          Column() {
            // 目标内容
            List({ space: 15 }) {
              ForEach(this.targetInfoVos, (item: TargetInfoVo) => {
                ListItem() {
                  LearnTargetContentComponent({
                    targetInfoVo: item
                  })
                }.swipeAction({
                  end: {
                    // index为该ListItem在List中的索引值。
                    builder: () => {
                      this.itemEnd(item)
                    },
                  }
                }) // 设置侧滑属性.
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
                  this.getUserTargetData(false, false)
                } else {
                  this.textShow = true
                }

              }
            })
          }.padding($r('app.float.common_padding'))
          .height('80%')
          .width(CommonConstant.WIDTH_FULL)
        }
        .onRefreshing(() => {
          if (!this.isLoad) {
            this.isLoad = true
            this.textShow = false
            // 页面恢复到1
            this.page = 1
            // 查询数据
            this.getUserTargetData(true, true)
          }
        })
      } else {
        // 加载组件
        LoadingComponent()
      }
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.learn_target_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }

  @Builder
  itemEnd(item: TargetInfoVo) {
    Row() {
      // 构建尾端滑出组件
      Button({ type: ButtonType.Circle }) {
        Image($r('app.media.icon_finish'))
          .width(40)
          .aspectRatio(1)
      }
      .onClick(async () => {
        // 完成未完成的目标
        if (item.status === '1') {
          showToast('当前目标已完成，无需重复点击')
          return
        }
        // 完成目标
        await targetInfoApi.completeTargetInfo({ id: item.id })
        showToast('目标已完成')
        router.replaceUrl({ url: RouterConstant.VIEWS_LEARN_TARGET })
      }).margin({ right: 10 })

      // 构建尾端滑出组件
      Button({ type: ButtonType.Circle }) {
        Image($r('app.media.icon_delete'))
          .width(40)
          .aspectRatio(1)
      }
      .margin({ right: 10 })
      .onClick(async () => {
        IBestDialogUtil.open({
          title: "提示",
          message: "是否确认删除当前目标？",
          showCancelButton: true,
          onConfirm: async () => {
            // 删除目标
            await targetInfoApi.deleteTargetInfo({ id: item.id })
            showToast('删除目标成功')
            router.replaceUrl({ url: RouterConstant.VIEWS_LEARN_TARGET })
          }
        })
      })
    }.justifyContent(FlexAlign.SpaceBetween)
  }

  @Builder
  formInputContain() {
    Column() {
      TextInput({ 'placeholder': '请输入目标内容,长度不能超过255字符' })
        .fontSize(14)
        .placeholderFont({ size: 14 })
        .onChange((value) => {
          this.inputTargetValue = value;
          this.formInputError = false
        })
      if (this.formInputError) {
        Text('目标内容不能为空')
          .width(CommonConstant.WIDTH_FULL)
          .textAlign(TextAlign.Start)
          .margin({
            top: 5,
            left: 5
          })
          .fontColor(Color.Red)
          .fontSize($r('app.float.common_font_size_small'))
          .transition({ type: TransitionType.Insert, opacity: 1 })
          .transition({ type: TransitionType.Delete, opacity: 0 })
      }

    }.width('90%').margin({ top: 15, bottom: 15 })
  }
}

