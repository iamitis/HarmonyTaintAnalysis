import { formatPrice, Product } from '../api/ProductApi'
import { AddressCard } from '../components/AddressCard';
import { GenericResponse } from '../utils/RequestUtil';
import { promptAction } from '@kit.ArkUI';
import { AddressInfo } from '../api/UserApi';
import { getAllAddressInfo } from '../api/UserApi';
import { Cart } from '../api/CartApi';
import { createOrder } from '../api/OrderApi';
import { tabsController } from './Index';
import { userTabsController } from './UserPage';

import geoLocationManager from '@ohos.geoLocationManager';
import { hilog } from '@kit.PerformanceAnalysisKit';

@Builder
export function BuyPageBuilder(name: string, param: Product) {
  BuyPage({ product: param });
}

@Component
export struct BuyPage {
  router: NavPathStack = new NavPathStack();
  @State product: Product | null = null;
  scroller: Scroller = new Scroller();
  @State totalPrice: number = 0;
  @State count: number = 1;
  @State addressList: AddressInfo[] = [];
  @State selectedAddress: AddressInfo | null = null;
  @State isAddrExpanded: boolean = false;
  @State selectedBorder: BorderOptions = {width: 0, color: '#ffd9d9d9', style: BorderStyle.Solid};
  @State successful: boolean = false;
  @State isOrdering: boolean = false;
  @State isGettingAddr: boolean = false;

  private fieldA: string = '';

  async aboutToAppear() {
    this.totalPrice = this.product?.productNowPrice ?? 0;

    // 获取用户地址
    this.isGettingAddr = true;
    const response = await getAllAddressInfo(1);
    if (response) {
      const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<AddressInfo[]>;
      this.addressList = parsedResponse.result;
      this.selectedAddress = this.addressList[0];
    }
    this.isGettingAddr = false;

    this.fieldA = JSON.stringify(geoLocationManager.getLastLocation()); //source
    hilog.info(0x0000, 'testTag', '%{public}s', this.fieldA); //sink, leak
  }

  build() {
    NavDestination() {
      Scroll(this.scroller) {
        Column({ space: 10 }) {
          if (this.isGettingAddr) {
            LoadingProgress().width(100).height(100)
          }
          if (this.selectedAddress) {
            AddressCard({ address: this.selectedAddress, canRemoved: false })
              .width('100%')
              .onClick(() => {
                this.isAddrExpanded = !this.isAddrExpanded;
                this.selectedBorder.width = this.isAddrExpanded ? 1 : 0;
              })
              .border(this.selectedBorder)
          }

          if (this.isAddrExpanded && this.addressList.length > 1) {
            ForEach(this.addressList, (item: AddressInfo) => {
              if (item.addressInfoId !== this.selectedAddress?.addressInfoId) {
                AddressCard({ address: item, canRemoved: false })
                  .width('100%')
                  .onClick(() => {
                    this.selectedAddress = item;
                    this.selectedBorder.width = 0;
                    this.isAddrExpanded = false;
                  })
              }
            })
          }

          Divider()

          Row({ space: 10 }) {
            Image(this.product?.productImages[0])
              .borderRadius(5)
              .height(130).width(130)
            Column() {
              Text('实付' + formatPrice(this.totalPrice))
                .width('100%')
                .fontSize(18).fontWeight(FontWeight.Bold)
                .fontColor('#fff54242')
              Row() {
                Button('-', { type: ButtonType.Normal })
                  .backgroundColor('#ffe2dede')
                  .onClick(() => {
                    if (this.count > 1) {
                      --this.count
                      this.updatePrice();
                    }
                  })
                TextInput({ text: this.count.toString() })
                  .type(InputType.Number)
                  .width(60)
                  .textAlign(TextAlign.Center)
                  .borderRadius(0)
                  .onChange(() => {
                    if (this.count < 1) {
                      this.count = 1;
                    } else if (this.count > 999) {
                      this.count = 999;
                    }
                    this.updatePrice();
                  })
                Button('+', { type: ButtonType.Normal })
                  .backgroundColor('#ffe2dede')
                  .onClick(() => {
                    if (this.count < 999) {
                      ++this.count;
                      this.updatePrice();
                    }
                  })
              }.alignSelf(ItemAlign.Start)
            }.height(130)
            .padding({ top: 10, bottom: 10 })
            .justifyContent(FlexAlign.SpaceBetween)
          }

          Divider()

          if (!this.successful && !this.isOrdering) {
            Button('立即支付' + formatPrice(this.totalPrice), { type: ButtonType.Normal })
              .width('100%')
              .backgroundColor('#fff54242')
              .onClick(() => this.handlePay())
              .fontWeight(FontWeight.Bold)
          } else if (this.successful && !this.isOrdering) {
            Text('下单成功！')
              .fontColor('#fff54242')
              .fontWeight(FontWeight.Bold).fontSize(20)

            Row() {
              Button('返回商品页', { buttonStyle: ButtonStyleMode.TEXTUAL })
                .onClick(() => {
                  this.router.pop();
                })
              Button('前往订单页', { buttonStyle: ButtonStyleMode.TEXTUAL })
                .onClick(() => {
                  userTabsController.changeIndex(1);
                  setTimeout(() => {}, 1200);
                  userTabsController.changeIndex(0);
                  tabsController.changeIndex(3);
                  this.router.pop();
                })
            }
          } else if (!this.successful && this.isOrdering) {
            LoadingProgress()
              .width(100).height(100)
          }
        }.padding(15)
      }
    }.onReady((context: NavDestinationContext) => {
      this.router = context.pathStack;
    })
  }

  updatePrice() {
    this.totalPrice = this.product?.productNowPrice! * this.count;
  }

  handlePay = async () => {
    let userId = 1;
    let productList: Cart[] = [
      {
        userId: userId,
        quantity: this.count,
        product: this.product!,
        productOptionValues: [],
      }
    ];
    let addressInfoId = this.selectedAddress?.addressInfoId!;


    this.isOrdering = true;
    let response = await createOrder(userId, productList, addressInfoId);
    if (response) {
      let parsedResponse = JSON.parse(response.toString()!) as GenericResponse<boolean>;
      if (parsedResponse.code === '000') {
        this.successful = true;
      }
    }
    this.isOrdering = false;
  }
}