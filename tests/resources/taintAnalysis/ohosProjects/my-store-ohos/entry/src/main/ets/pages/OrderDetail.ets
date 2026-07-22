import { Cart } from '../api/CartApi';
import { formatPrice } from '../api/ProductApi';
import {CartCard} from '../components/CartCard'

@Builder
export function OrderDetailBuilder(name: string, param: Cart[]) {
  OrderDetail({cartList:param})
}

@Component struct OrderDetail {
 router: NavPathStack = new NavPathStack()
  @State cartList: Cart[]|null = null;
  @State totalPrice:number = 0;

  async aboutToAppear(){
    if(this.cartList) {
      for(let i = 0; i  < this.cartList.length; i++ ) {
        this.totalPrice += this.cartList[i].quantity * this.cartList[i].product.productNowPrice
      }
    }
  }

  build() {
    if(this.cartList) {
        NavDestination() {
          if (this.cartList.length > 0) {
            List({ space: 15 }) {
              ForEach(this.cartList, (item: Cart) => {
                ListItem() {
                  CartCard({ cart: item })
                    .onClick(()=>{
                      this.router.pushPathByName('ProductDetail', item.product)
                    })
                }
              })
            }.padding({left: 15, right: 15})
            .width('100%').height('100%')
            .scrollBar(BarState.Off)
            .divider({strokeWidth: 1, color: '#ffd6d4d4'})


            Row() {
              Text('总计：' + formatPrice(this.totalPrice)).margin(15).fontSize(15).fontWeight(FontWeight.Bold)
            }.width('100%').height(50)
            .backgroundColor(Color.White)
            .position({ bottom: 1, right: 10 })
          }
        }.title('订单详情')
        .onReady((context: NavDestinationContext) => {
          this.router = context.pathStack;
        })
      }
    }
}