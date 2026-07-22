import { CartListPage } from './CartListPage';
import { CategoryPage } from './CategoryPage';
import { Discount } from './Discount';
import { UserPage } from './UserPage';

import geoLocationManager from '@ohos.geoLocationManager';
import { hilog } from '@kit.PerformanceAnalysisKit';

export const tabsController: TabsController = new TabsController();

@Entry
@Component
struct Index {
  @State currIndex: number = 0;

  private fieldA: string = '';

  aboutToAppear() {
    this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
    hilog.info(0x0000, 'testTag', '%{public}s', this.fieldA); //sink, leak
  }

  build() {
    Tabs({ barPosition: BarPosition.End, controller: tabsController }) {
      TabContent() {
        Discount()
      }.tabBar('折扣')

      TabContent() {
        CategoryPage()
      }.tabBar('分类')

      TabContent() {
        CartListPage({currTabIndex: this.currIndex})
      }.tabBar('购物车')

      TabContent() {
        UserPage()
      }.tabBar('我的')
    }.scrollable(false)
    .height('100%')
    .onChange((index: number) => {
      this.currIndex = index;
    })
  }
}