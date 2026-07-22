import { addToShoppingCart, Cart } from '../api/CartApi';
import { formatPrice, Product } from '../api/ProductApi';
import { GenericResponse } from '../utils/RequestUtil';
import { promptAction } from '@kit.ArkUI';

@Builder
export function ProductDetailBuilder(name: string, param: Product) {
  ProductDetail({product: param});
}

@Component
export struct ProductDetail {
  router: NavPathStack = new NavPathStack();
  @State product: Product | null = null;
  scroller: Scroller = new Scroller();
  @State cartButtonColor: string = '#fff3ca4f';
  @State buyButtonColor: string = '#fff54242';
  @State isAddingToCart: boolean = false;

  build() {
    if (this.product) {
      NavDestination() {
        Scroll(this.scroller) { // 与下层的column搭配使页面可滚动
          Column() { // 最外层column
            Stack() { // 返回按钮和轮播图
              Swiper() {
                ForEach(this.product?.productImages, (item: string) => {
                  Image(item)
                    .width('100%').height(300)
                    .objectFit(ImageFit.Cover)
                })
              }

              // back button
              Button({ type: ButtonType.Circle }) {
                Image($r('sys.media.ohos_ic_public_arrow_left')).width(30).height(30)
              }
              .width(40)
              .height(40)
              .backgroundColor('#ffd7d6d6')
              .opacity(0.8)
              .position({ top: 10, left: 20 })
              .onClick(() => {
                this.router.pop()
              })
            }

            // price and name
            Column() {
              // price
              Row() {
                Text(formatPrice(this.product?.productNowPrice!))
                  .fontSize(23).fontWeight(FontWeight.Bold)
                  .fontColor('#fff54242')
                if (this.product?.productNowPrice! < this.product?.productOriginalPrice!) {
                  Text(formatPrice(this.product?.productOriginalPrice!))
                    .fontSize(22)
                    .fontWeight(FontWeight.Bold)
                    .fontColor('#ff818080')
                    .decoration({ type: TextDecorationType.LineThrough, color: '#ff818080' })
                    .margin({ left: 15 })
                }
                Text('已售' + this.product?.productScoreCount.toString())
                  .fontSize(18)
                  .fontColor('#ff818080')
                  .position({ right: 0, bottom: 1 })
              }.width('100%')
              .alignItems(VerticalAlign.Bottom)

              // name
              Text(this.product?.productName)
                .width('100%')
                .fontSize(20)
                .fontWeight(FontWeight.Bold)
                .margin({ top: 10 })
            }.backgroundColor(Color.White)
            .padding(15)

            // description
            Column() {
              Text('商品详情')
                .width('100%')
                .fontSize(20).fontWeight(FontWeight.Bold)
              Text(this.product?.productDescription)
                .width('100%')
                .margin({ top: 10 })
                .lineHeight(30)
                .letterSpacing(1)
            }.margin({ top: 10 })
            .backgroundColor(Color.White)
            .padding({
              top: 15,
              bottom: 200,
              left: 15,
              right: 15
            })
          }
        }.scrollBar(BarState.Off)

        // 购买和购物车按钮
        Row() {
          Row() {
            Text('加入购物车')
              .textAlign(TextAlign.Center)
              .width('100%')
              .fontColor(Color.White).fontWeight(FontWeight.Bold)
          }
          .width(100)
          .height(50)
          .backgroundColor(this.cartButtonColor)
          .borderRadius({ topLeft: 25, bottomLeft: 25 })
          .onTouch((event: TouchEvent) => {
            if (event.type == TouchType.Down) {
              this.cartButtonColor = '#ffecc13e';
            } else if (event.type == TouchType.Up) {
              this.cartButtonColor = '#fff3ca4f';
            }
          })
          .onClick(() => this.handleAddToCart())

          Row() {
            Text('立即购买')
              .textAlign(TextAlign.Center)
              .width('100%')
              .fontColor(Color.White).fontWeight(FontWeight.Bold)
          }
          .width(100)
          .height(50)
          .backgroundColor(this.buyButtonColor)
          .borderRadius({ topRight: 25, bottomRight: 25 })
          .onTouch((event: TouchEvent) => {
            if (event.type == TouchType.Down) {
              this.buyButtonColor = '#ffe33a3a';
            } else if (event.type == TouchType.Up) {
              this.buyButtonColor = '#fff54242';
            }
          })
          .onClick(() => {this.handleBuy(this.router, this.product)})
        }.width(200).height(50)
        .position({ bottom: 10, right: 10 })
        .borderRadius(25)

        if (this.isAddingToCart) {
          LoadingProgress().width(100).height(100).position({bottom: 50, left: '40%'})
        }

      }.hideTitleBar(true)
      .backgroundColor('#ffdddcdc')
      .onReady((context: NavDestinationContext) => {
        this.router = context.pathStack;
      })
    }
  }

  handleBuy(router: NavPathStack, product: Product | null) {
    // TODO: 登录验证

      router.pushPathByName('BuyPage', product)
  }
  async handleAddToCart() {
    this.isAddingToCart = true;
    const cart: Cart = {
      product: this.product!,
      quantity: 1,
      productOptionValues: [],
      userId: 1,
      cartItemDate: new Date(),
    };
    const response = await addToShoppingCart(cart);
    if (response) {
      let parsedResponse = JSON.parse(response.toString()!) as GenericResponse<Cart>;
      if (parsedResponse.code === '000') {
        promptAction.showToast({message: '已加入购物车！'})
      }
    }
    this.isAddingToCart = false;
  }
}
