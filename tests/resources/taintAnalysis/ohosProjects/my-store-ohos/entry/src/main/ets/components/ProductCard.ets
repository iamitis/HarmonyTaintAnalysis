import { formatPrice, Product } from '../api/ProductApi';

@Component
export struct ProductCard {
  @Prop product: Product;

  build() {
    Column() {
      Image(this.product.productImages[0])
        .width(170).height(170)
        .borderRadius(10)
      Text(this.product.productName)
        .width(160)
        .maxLines(1)
        .textOverflow({overflow: TextOverflow.None})
        .fontSize(18)
        .margin({top: 4})
      Row() {
        Text(formatPrice(this.product.productNowPrice))
          .fontColor('#fff54242')
          .fontWeight(FontWeight.Bold)
          .fontSize(18)
        Text(this.product.productScoreCount.toString() + '人付款')
          .margin({left: 10})
          .fontColor('#ff838383')
      }.width(160)
      .margin({top: 2})
    }
    .backgroundColor('#ffffff')
  }
}