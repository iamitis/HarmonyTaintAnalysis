import learnClockApi from '../../api/LearnClockApi';
import { UserLearnClockData } from '../../api/LearnClockApi.type';
import { ClockRecordContentComponent } from '../../components/ClockRecordContentComponent';
import { LoadingComponent } from '../../components/LoadingComponent';
import { CommonConstant } from '../../contants/CommonConstant';
import { showToast } from '../../utils/Toast';

@Entry
@Component
export struct ClockRecord {
  // 学习打卡记录数据
  @State clockDataList: UserLearnClockData[] = []
  // 学习打卡总记录数
  @State total: number = 0
  // 当前页
  @State page: number = 1
  // 每一页大小
  @State pageSize: number = 10
  // 控制当前页面展示
  @State isShow: boolean = false
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false
  // 是否展示文本，列表到底
  @State textShow: boolean = false

  /**
   * 生命周期函数
   */
  aboutToAppear() {
    this.getCLockData(true, false)
  }

  /**
   * 查询打卡记录数据
   * @param isFlushed
   */
  async getCLockData(isFlushed: boolean, isUpdate: boolean) {
    // 获取打卡记录数据
    const clockRecords = await learnClockApi.pageListUserClock({ page: this.page, pageSize: this.pageSize })
    // 判断是否是刷新还是下拉
    isFlushed ? this.clockDataList = clockRecords.records : this.clockDataList.push(...clockRecords.records);
    this.total = clockRecords.total
    // 判断总数据
    if (this.total > this.page * this.pageSize) {
      this.textShow = false
    } else {
      this.textShow = true
    }
    // 页面展示
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
        Refresh({ refreshing: $$this.isRefreshing }) {
          Column() {
            List() {
              ForEach(this.clockDataList, (item: UserLearnClockData) => {
                ClockRecordContentComponent({ clockRecord: item })
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
            }.scrollBar(BarState.Off)
            .onReachEnd(() => {
              if (!this.isLoad) {
                if (this.total > this.page * this.pageSize) {
                  this.isLoad = true
                  this.page++
                  // 查询打卡记录数据
                  this.getCLockData(false, false)
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
            // 查询打卡记录数据
            this.getCLockData(true, true)
          }
        })
      } else {
        // 加载组件
        LoadingComponent()
      }
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.clock_record_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}