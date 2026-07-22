import { getAllOrders } from '../api/OrderApi'
import { Order } from '../api/OrderApi'
import { OrderCard } from '../components/OrderCard'
import { GenericResponse } from '../utils/RequestUtil';
import { currUser } from './LoginPage';

@Component
export struct Orders {
  @State orderList: Order[] = [];
  @Provide('router') router: NavPathStack = new NavPathStack();
  @State isGettingOrders: boolean = false;
  @Prop @Watch('refresh') currTabIndex: number;
  index = 0;

  async refresh() {
    if (this.index === this.currTabIndex) {
      this.isGettingOrders = true;
      const response = await getAllOrders(currUser.id!);
      if (response) {
        const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<Order[]>;
        this.orderList = parsedResponse.result.sort((a: Order, b: Order) => {
          return b.orderInfoId! - a.orderInfoId!;
        })
      }
      this.isGettingOrders = false;
    }
  }

  async aboutToAppear() {
    this.isGettingOrders = true;
    const response = await getAllOrders(currUser.id!);
    if (response) {
      const parsedResponse = JSON.parse(response.toString()!) as GenericResponse<Order[]>;
      this.orderList = parsedResponse.result.sort((a: Order, b: Order) => {
        return b.orderInfoId! - a.orderInfoId!;
      })
    }
    this.isGettingOrders = false;
  }

  build() {
    Navigation(this.router){
      Column() {
        if (this.isGettingOrders) {
          LoadingProgress().width(100).height(100)
        }
        if (this.orderList.length > 0) {
          List({ space: 10 }) {
            ForEach(this.orderList, (item: Order) => {
              ListItem() {
                OrderCard({ order: item })
                  .onClick(()=>{
                    this.router.pushPathByName('OrderDetail', item.products)
                  })
              }
            })
          }.padding({ left: 8, right: 8 })
          .width('100%').height('100%')
          .scrollBar(BarState.Off)
        } else if (!this.isGettingOrders) {
          Text('暂无订单').fontSize(30)
        }
      }
    }.hideTitleBar(true)
    .backgroundColor('#FFFAFA')
  }
}