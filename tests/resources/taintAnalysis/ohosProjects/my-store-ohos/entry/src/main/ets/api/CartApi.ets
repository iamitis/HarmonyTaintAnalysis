import { session } from '../utils/RequestUtil';
import { Product } from './ProductApi'

const CARTS = "users";

export interface Cart {
  cartItemId?: number,
  userId: number,
  quantity: number,
  product: Product,
  productOptionValues?: ProductOptionValue[],
  cartItemDate?: Date,
  // ...
}

export interface ProductOptionValue {
    productOptionValueId?:number,
    productId?: number,
    productOptionName?:string,
    value?: string
}
@Concurrent
export async function getShoppingCart(userId: number) {
  return await session.get(`${"users"}/getShoppingCart/${userId}`);
}
@Concurrent
export async function addToShoppingCart(cartItem: Cart) {
  return await session.post(`${"users"}/addCartItem`, cartItem)
}
@Concurrent
export async function deleteCartItem(cartItemId: number) {
  return await session.delete(`${"users"}/deleteCartItem/${cartItemId}`);
}