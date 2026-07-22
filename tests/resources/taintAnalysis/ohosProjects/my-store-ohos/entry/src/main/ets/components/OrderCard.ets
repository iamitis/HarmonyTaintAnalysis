import { Order, OrderStatusMap } from '../api/OrderApi'
import { formatDate } from '../utils/CommonUtil'
import { formatPrice } from '../api/ProductApi'


@Component
export struct OrderCard {
  @Prop order: Order;

  build() {
    Column({space: 30}) {
      Row({space: 15}) {
        Text("订单编号：" + 'ORD' + this.order.orderInfoId?.toString()).fontSize(15)
        Text("完成日期：" + formatDate(this.order.createDate)).fontSize(15)
      }.width('100%')

      Row({space: 25}) {
        Text("实付：" + formatPrice(this.order.totalPrice!)).fontSize(15);
        Text("订单状态：" + OrderStatusMap.get(this.order.orderStatus)).fontSize(15);
      }.width('100%')
    }.width('100%')
    .height(100)
    .padding(15)
    .backgroundColor('#ffffff')
    .borderRadius(10)
  }
}
