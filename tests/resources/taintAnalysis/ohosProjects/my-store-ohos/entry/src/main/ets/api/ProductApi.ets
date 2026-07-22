import { session } from '../utils/RequestUtil';

const PRODUCTS = 'newProducts';

export interface Product {
  productId?: number,
  productCategory: string,
  productName: string,
  productOriginalPrice: number,
  productNowPrice: number,
  productImages: string[],
  productDescription: string,
  productScore: number,
  productScoreCount: number,
};

export interface ProductAttribute {
  productAttributeId?: number;
  productAttributeName: string; // 属性名，如食品的口味 flavor，服饰的季节 season
  displayName: string; // 显示名，如"口味", "季节"
  productCategory: string; // 所属类别, 属于食品还是服饰
}

export interface ProductAttributeValue {
  productAttributeValueId?: number;
  product: Product;
  productAttribute: ProductAttribute;
  value: string; // 属性值，如"香辣", "春季"
}

export interface FilterInfo {
  productCategory?: string;
  attributeValues?: Map<string, string[]>;
}
@Concurrent
export async function getAllDiscountProduct() {
  return await session.get(`${'newProducts'}/getAllDiscountProduct`);
}
@Concurrent
export async function getAttributesByCategory(category: string) {
  return await session.get(`${'newProducts'}/getAttributesByCategory/${category}`)
}
@Concurrent
export async function getAttributeValuesByCategory(category: string) {
  return await session.get(`${'newProducts'}/getAttributeValuesByCategory/${category}`)
}

export async function filterProducts(category: string, selectedAttrValMap: Map<string, ProductAttributeValue[]>) {
  const filterInfo: FilterInfo = {
    productCategory: category,
    attributeValues: new Map<string, string[]>(),
  }
  selectedAttrValMap.forEach((value, key) => {
    filterInfo.attributeValues!.set(key, value.map(v => v.value!))
  })

  let jsonObject:Record<string, string[]> = {} //新增Record对象用来存储转换后的结果
  filterInfo.attributeValues!.forEach((value,key) => {
    if (key != undefined && value != undefined) {
      jsonObject[key] = value;
    }
  })

  return await session.post(`${PRODUCTS}/filterProducts`, {
    productCategory: filterInfo.productCategory,
    attributeValues: jsonObject,
  })
}
@Concurrent
export async function getProductById(productId: number) {
  return await session.get(`${'newProducts'}/getProductById/${productId}`)
}

export interface ProductOption {
  productOptionId?: number;
  productId?: number;
  productOptionName?: string; // 选项名，如"颜色"
}

export interface ProductOptionValue {
  productOptionValueId?: number;
  productId?: number;
  productOptionName?: string;
  value?: string; // 选项值，如"银色"
}

// 获取某商品的所有选项类
@Concurrent
export async function getProductOptions(productId: number) {
  return await session.get(`${'newProducts'}/getProductOptions/${productId}`)
}

// 获取某商品的所有选项值
@Concurrent
export async function getProductOptionValues(productId: number) {
  return await session.get(`${'newProducts'}/getProductOptionValues/${productId}`)
}
@Concurrent
export async function searchProduct(search: string) {
  return await session.get(`${'newProducts'}/searchProduct/${search}`)
}

export function formatPrice(price: number) {
  return "￥" + price.toFixed(2)
}

export interface Category {
  categoryName: string,
  displayName: string,
  categoryImage: Resource,
}

export const CATEGORIES: Category[] = [
  {displayName: '食品', categoryName: 'FOOD', categoryImage: $r('app.media.FOOD')},
  {displayName: '服装', categoryName: 'APPAREL', categoryImage: $r('app.media.APPAREL')},
  {displayName: '宠物用品', categoryName: 'PET_SUPPLIES', categoryImage: $r('app.media.PET_SUPPLIES')},
  {displayName: '保健品', categoryName: 'HEALTH_PRODUCTS', categoryImage: $r('app.media.HEALTH_PRODUCTS')},
  {displayName: '电子', categoryName: 'ELECTRONICS', categoryImage: $r('app.media.ELECTRONICS')},
  {displayName: '洗浴用品', categoryName: 'BATH_PRODUCTS', categoryImage: $r('app.media.BATH_PRODUCTS')},
]
