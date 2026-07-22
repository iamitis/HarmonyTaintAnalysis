import { showToast } from '../../utils/Toast'
import { router } from '@kit.ArkUI'
import { RouterConstant } from '../../contants/RouterConstant'
import { CommonConstant } from '../../contants/CommonConstant'
import { geoLocationManager } from '@kit.LocationKit';
import { abilityAccessCtrl, common, Permissions } from '@kit.AbilityKit';
import { IBestCalendar } from "@ibestservices/ibest-ui";
import { LoadingComponent } from '../../components/LoadingComponent'
import learnClockApi from '../../api/LearnClockApi'
import { Logger } from '../../utils/Logger'

@Entry
@Component
export struct Clock {
  // 打卡地点
  @State location: string = ''
  // 是否今日打卡
  @State isClock: boolean = false
  // 打卡的日期
  @State clockDate: Array<string> = []
  // 控制当前页面展示
  @State isShow: boolean = false

  /**
   * 动态授权
   */
  async aboutToAppear() {
    // 查询当前页面学习打卡数据
    this.getClockData()
    // 使用UIExtensionAbility：将common.UIAbilityContext 替换为common.UIExtensionContext
    const context: common.UIAbilityContext = getContext(this) as common.UIAbilityContext;
    // 定义要申请的权限
    const permissions: Array<Permissions> = ['ohos.permission.APPROXIMATELY_LOCATION'];
    let atManager: abilityAccessCtrl.AtManager = abilityAccessCtrl.createAtManager();
    // requestPermissionsFromUser会判断权限的授权状态来决定是否唤起弹窗
    try {
      const data = await atManager.requestPermissionsFromUser(context, permissions);
      let grantStatus: Array<number> = data.authResults;
      let length: number = grantStatus.length;
      for (let i = 0; i < length; i++) {
        if (grantStatus[i] === 0) {
          // 获取位置信息
          this.getLocation()
        } else {
          // 用户拒绝授权，提示用户必须授权才能访问当前页面的功能，并引导用户到系统设置中打开相应的权限
          showToast('用户必须授权才能访问当前定位功能')
          return;
        }
      }
    } catch (error) {
      showToast('用户必须授权才能访问当前定位功能')
    }
  }

  /**
   * 获取位置
   */
  async getLocation() {
    let request: geoLocationManager.SingleLocationRequest = {
      'locatingPriority': geoLocationManager.LocatingPriority.PRIORITY_LOCATING_SPEED,
      'locatingTimeoutMs': 10000
    }
    try {
      // 调用getCurrentLocation获取当前设备位置，通过promise接收上报的位置
      const result = await geoLocationManager.getCurrentLocation(request)
      Logger.info('current location: ' + JSON.stringify(result));
      // 判断地理编码服务是否可用
      let isAvailable = geoLocationManager.isGeocoderAvailable();
      if (isAvailable) {
        // 地理编码服务可用
        let reverseGeocodeRequest: geoLocationManager.ReverseGeoCodeRequest =
          { "latitude": result.latitude, "longitude": result.longitude, "maxItems": 1 };
        geoLocationManager.getAddressesFromLocation(reverseGeocodeRequest, (err, data) => {
          if (err) {
            Logger.error('getAddressesFromLocation err: ' + JSON.stringify(err));
          } else {
            Logger.info('getAddressesFromLocation data: ' + JSON.stringify(data));
            // 成功获取到位置信息
            this.location = data[0].administrativeArea + '' + data[0].subAdministrativeArea
            return
          }
        });
      } else {
        showToast('地理编码服务不可用')
      }
    } catch (err) {
      Logger.error("errCode:" + JSON.stringify(err));
      showToast("获取位置失败")
    }
  }

  /**
   * 获取页面打卡数据
   */
  async getClockData() {
    // 查询用户今日是否打卡
    this.isClock = await learnClockApi.isClock()
    // 查询用户已打卡的日期
    this.clockDate = await learnClockApi.listClockTime()
    // 显示页面数据
    this.isShow = true
  }

  /**
   * 打卡
   */
  async clock() {
    if (this.location !== '') {
      if (!this.isClock) {
        // 打卡
        await learnClockApi.learnClock({ location: this.location, content: '学习打卡' })
        showToast('打卡成功，已连续打卡200天')
        router.replaceUrl({ url: RouterConstant.VIEWS_LEARN_TOOL })
      } else {
        showToast('今日已打过卡，不需要重复打卡')
      }
    } else {
      showToast('打卡失败')
    }
  }

  build() {
    Navigation() {
      if (this.isShow) {
        Column({ space: 20 }) {
          Stack() {
            Button(this.isClock ? '已打卡' : '未打卡')
              .width($r('app.float.common_width_huge'))
              .height($r('app.float.common_height_huge'))
              .borderRadius(100)
              .backgroundColor('#03A9F4')
              .margin({ bottom: 20 })
              .onClick(() => {
                // 打卡
                this.clock()
              })
          }

          // 日历
          IBestCalendar({
            clock: true,
            defaultSelectedDate: this.clockDate,
            clockSuccessText: '✔',
            unClockText: '✖',
          })
        }.padding($r('app.float.common_padding'))
      } else {
        // 加载组件
        LoadingComponent()
      }
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.learn_clock_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}