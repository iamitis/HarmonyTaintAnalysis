import {session} from '../utils/RequestUtil'
import { Cart } from './CartApi';

const ORDER = "users";

export interface Order{
  orderInfoId?: number,
  userId?: number,
  products: Cart[],
  addressInfoId?: number,
  orderStatus?: OrderStatus,
  totalPrice?:number,
  createDate: Date,
}

export enum OrderStatus {
  UNPAID = 'UNPAID',
  UNSEND = 'UNSEND',
  UNGET = 'UNGET',
  UNCOMMENT = 'UNCOMMENT',
  DONE = 'DONE',
}

export const OrderStatusMap: Map<OrderStatus, string> = new Map();
OrderStatusMap.set(OrderStatus.UNPAID, '待付款');
OrderStatusMap.set(OrderStatus.UNSEND, '待发货');
OrderStatusMap.set(OrderStatus.UNGET, '已发货');
OrderStatusMap.set(OrderStatus.UNCOMMENT, '待评价');
OrderStatusMap.set(OrderStatus.DONE, '已完成');

@Concurrent
export async function getAllOrders(userId:number) {
  return await session.get(`${"users"}/getAllOrders/${userId}`);
}
export async function createOrder(userId: number, productList: Cart[], addressInfoId: number) {
  const order: Order = {
    userId: userId,
    products: productList,
    addressInfoId: addressInfoId,
    orderStatus: OrderStatus.UNSEND,
    createDate: new Date()
  }
  order.totalPrice = productList.reduce((acc, cur) => acc + cur.product!.productNowPrice! * cur.quantity!, 0)
  return await session.post(`${ORDER}/createOrder`, order)
}