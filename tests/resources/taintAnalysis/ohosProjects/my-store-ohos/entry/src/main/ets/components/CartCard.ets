import { Cart, deleteCartItem } from '../api/CartApi'
import { formatPrice } from '../api/ProductApi';
import { promptAction } from '@kit.ArkUI';
import { GenericResponse } from '../utils/RequestUtil';

@Component
export struct CartCard {
  // @Provide('router') router: NavPathStack = new NavPathStack()
  @Prop cart: Cart;
  @State backColor: string = '#fff';

  build() {
    Row() {
      Image(this.cart.product.productImages[0])
        .width(100).height(100)
        .borderRadius(10)
      Column() {
        Text(this.cart.product?.productName)
          .width('100%')
          .fontSize(15)
          .fontWeight(FontWeight.Bold)
          .padding(10)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Row() {
          Text(formatPrice(this.cart.product.productNowPrice)).margin({ left: 10 }).fontColor('#fff54242')
          Text("数量：" + this.cart.quantity.toString()).margin({ left: 50 })
        }
      }.width('80%')

      // Button({ buttonStyle: ButtonStyleMode.TEXTUAL }) {
      //   Image($r('app.media.ic_public_delete')).height(20).width(20)
      // }.height(30).width(30)
      // .onClick(() => this.handledeleteToCart())

    }.width('100%')
    .height(100)
    .borderRadius(10)
    .backgroundColor(this.backColor)
    .onTouch((event: TouchEvent) => {
      if (event.type === TouchType.Down) {
        this.backColor = '#ffd9d9d9';
      } else if (event.type === TouchType.Up) {
        this.backColor = '#ffffff';
      }
    })
  }

  async handledeleteToCart() {
    let id = 0;
    if(this.cart.cartItemId){
      id = this.cart.cartItemId;
    }
    const response = await deleteCartItem(id);
    if (response) {
      let parsedResponse = JSON.parse(response.toString()!) as GenericResponse<Cart>;
      if (parsedResponse.code === '000') {
        promptAction.showToast({message: '已从购物车中删除！'})
      }
    }
  }
}