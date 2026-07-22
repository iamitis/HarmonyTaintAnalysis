import { CommonConstant } from '../../contants/CommonConstant'
import { ArticleContentData } from '../../api/ArticleContentApi.type'
import { ArticleComponent } from '../../components/ArticleComponent'
import { router } from '@kit.ArkUI'
import { RouterConstant } from '../../contants/RouterConstant'
import { LoadingComponent } from '../../components/LoadingComponent'
import articleContentApi from '../../api/ArticleContentApi'
import { showToast } from '../../utils/Toast'

@Entry
@Component
struct MineCollect {
  // 文章数据数组
  @State articleContentList: ArticleContentData[] = []
  // 控制当前页面展示
  @State isShow: boolean = false
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false
  // 是否展示文本，列表到底
  @State textShow: boolean = false

  /**
   * 生命周期函数
   */
  async aboutToAppear() {
    // 获取文章分类数据
    this.getArticleDataList(false)
  }

  /**
   * 获取文章分类数据
   */
  async getArticleDataList(isUpdate: boolean) {
    // 获取用户收藏的文章数据
    this.articleContentList = await articleContentApi.getUserCollect()
    // 页面展示
    this.isShow = true
    // 节流，防止用户重复下拉
    this.isLoad = false
    this.isRefreshing = false
    // 是否刷新
    if (isUpdate) {
      showToast("已更新")
    }
  }

  build() {
    Navigation() {
      if (this.isShow) {
        Refresh({ refreshing: $$this.isRefreshing }) {
          Column() {
            // 展示数据
            Row({ space: 10 }) {
              Text('只保留当前最近的100条文章收藏记录')
                .fontColor($r('app.color.common_gray'))
                .fontSize($r('app.float.common_font_size_small'))
                .fontWeight(FontWeight.Medium)
            }.width(CommonConstant.WIDTH_FULL)
            .justifyContent(FlexAlign.Start)
            .margin({ bottom: 15 })

            // 展示内容
            List() {
              ForEach(this.articleContentList, (item: ArticleContentData) => {
                ListItem() {
                  ArticleComponent({ articleContentData: item })
                    .onClick(() => {
                      // 路由到内容详情页
                      router.pushUrl({
                        url: RouterConstant.VIEWS_HOME_ARTICLE_INFO, params: {
                          "articleId": item.id
                        }
                      })
                    })
                }
              })
              if (this.textShow) {
                ListItem() {
                  Text($r('app.string.no_have_article'))
                    .fontColor($r('app.color.common_gray'))
                    .fontSize($r('app.float.common_font_size_small'))
                    .width(CommonConstant.WIDTH_FULL)
                    .textAlign(TextAlign.Center)
                    .margin({ top: 20 })
                }
              }
            }
            .width(CommonConstant.WIDTH_FULL)
            .height(CommonConstant.HEIGHT_FULL)
            .scrollBar(BarState.Off)
            .onReachEnd(() => {
              this.textShow = true
            })
          }.padding($r('app.float.common_padding'))
        }.onRefreshing(() => {
          if (!this.isLoad) {
            this.isLoad = true
            this.textShow = false
            this.getArticleDataList(true)
          }
        })
      } else {
        // 加载组件
        LoadingComponent()
      }
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.mine_collect_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}