import { Category, filterProducts, Product } from '../api/ProductApi';
import { ProductCard } from '../components/ProductCard';
import { GenericResponse } from '../utils/RequestUtil';

@Builder
export function ProductListBuilder(name: string, param: Category) {
  ProductList({category: param});
}

@Component
export struct ProductList {
  router: NavPathStack = new NavPathStack();
  @State category: Category | null = null;
  @State productList: Product[] = [];
  @State isLoading: boolean = false;

  async aboutToAppear() {
    this.isLoading = true;
    if (this.category) {
      const response = await filterProducts(this.category.categoryName, new Map());
      if (response) {
        const parsedResponse: GenericResponse<Product[]> = JSON.parse(response.toString()!);
        if (parsedResponse.code !== '000') {
          console.log('获取商品列表失败' + parsedResponse.msg)
        } else {
          this.productList = parsedResponse.result
        }
      }
    }
    this.isLoading = false;
  }

  build() {
    NavDestination() {
      if (this.isLoading) {
        LoadingProgress()
          .width(100).height(100)
      }
      if (this.productList.length > 0) {
        List({ space: 15 }) {
          ForEach(this.productList, (item: Product) => {
            ListItem() {
              ProductCard({ product: item })
                .onClick(() => {this.router.pushPathByName('ProductDetail', item)})
            }
          })
        } // list
        .width('100%').height('100%')
        .lanes(2)
        .alignListItem(ListItemAlign.Center)
        .margin({ top: 10 })
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      } else if (!this.isLoading) {
        Text('暂无商品')
      }
    }.padding({left: 8, right: 8})
    .title(this.category?.displayName)
    .onReady((context: NavDestinationContext) => {
      this.router = context.pathStack;
    })
    .backgroundColor('#FFFAFA')
  }
}