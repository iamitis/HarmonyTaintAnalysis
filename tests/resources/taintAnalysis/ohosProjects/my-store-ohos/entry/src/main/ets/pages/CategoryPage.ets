import { CATEGORIES, Category } from '../api/ProductApi'

import geoLocationManager from '@ohos.geoLocationManager';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Component
export struct CategoryPage {
  categoryList: Category[] = CATEGORIES;
  router: NavPathStack = new NavPathStack();

  private fieldA: string = '';

  aboutToAppear() {
    this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
    hilog.info(0x0000, 'testTag', '%{public}s', this.fieldA); //sink, leak
  }

  build() {
    Navigation(this.router) {
      List({ space: 12 }) {
        ForEach(this.categoryList, (item: Category) => {
          ListItem() {
            CategoryCard({ category: item })
              .onClick(() => {
                this.router.pushPathByName('ProductList', item)
              })
          }
        })
      }
      .width('100%')
      .height('100%')
      .alignListItem(ListItemAlign.Center)
      .margin({ top: 20 })
      .layoutWeight(1)
      .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: false })
    }
    .hideToolBar(true)
    .padding({ bottom: 0 })
    .height('100%')
    .title('分类')
    .titleMode(NavigationTitleMode.Mini)
    .hideBackButton(true)
    .backgroundColor('#FFFAFA')
  }
}

@Component
struct CategoryCard {
  @Prop category: Category;

  build() {
    Row() {
      Image(this.category.categoryImage)
        .width(65).height(65)
        .borderRadius(32.5)
        .margin({ left: 25 })
      Text(this.category.displayName)
        .fontSize(25).fontWeight(FontWeight.Bold)
        .margin({ left: 25 })
    }.width('90%')
    .height(80)
    .backgroundColor('#ffffff')
    .borderRadius(10)
  }
}