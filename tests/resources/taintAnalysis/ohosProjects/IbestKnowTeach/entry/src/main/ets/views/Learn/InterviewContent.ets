import { CommonConstant } from '../../contants/CommonConstant'
import { router } from '@kit.ArkUI'
import { RouterConstant } from '../../contants/RouterConstant'
import { ArticleComponent } from '../../components/ArticleComponent'
import { showToast } from '../../utils/Toast'
import { ArticleContentData } from '../../api/ArticleContentApi.type'
import articleContentApi from '../../api/ArticleContentApi'
import { LoadingComponent } from '../../components/LoadingComponent'

@Entry
@Component
struct InterviewContent {
  // 页面标题
  @State pageTitle: string = ''
  // 文章数据数组
  @State articleContentList: ArticleContentData[] = []
  // 是否展示全部标题的下划线
  @State allDividerShow: boolean = true
  // 是否展示简单标题的下划线
  @State simpleDividerShow: boolean = false
  // 是否展示中等标题的下划线
  @State mediumDividerShow: boolean = false
  // 是否展示困难标题的下划线
  @State hardDividerShow: boolean = false
  // 搜索词
  @State keyword: string = ''
  // 文章总记录数
  @State total: number = 0
  // 当前页
  @State page: number = 1
  // 每一页大小
  @State pageSize: number = 7
  // 控制当前页面展示
  @State isShow: boolean = false
  // 定义一个状态属性，用来和Refresh组件进行双向数据绑定
  @State isRefreshing: boolean = false
  // 节流, false表示未请求, true表示正在请求
  isLoad: boolean = false
  // 是否展示文本，列表到底
  @State textShow: boolean = false
  // 当前文章分类id
  @State contentCategory: string = ''
  // 标题
  @State title: string = ''
  // 文章难度分类
  @State difficultyCategory: string = ''

  /**
   * 生命周期
   */
  aboutToAppear() {
    // 获取路由传递的文章id
    const param = router.getParams() as object
    if (param) {
      this.contentCategory = param["contentCategory"] as string
      this.pageTitle = param["pageTitle"] as string
      // 根据文章内容分类查询文章数据
      this.getArticleList(true, false)
    }
  }

  /**
   * 获取文章分类数据
   * @param isFlushed
   * @param isUpdate
   */
  async getArticleList(isFlushed: boolean, isUpdate: boolean) {
    // 判断当前文章难度分类
    if (this.allDividerShow) {
      this.difficultyCategory = ''
    } else if (this.simpleDividerShow) {
      this.difficultyCategory = '1'
    } else if (this.mediumDividerShow) {
      this.difficultyCategory = '2'
    } else if (this.hardDividerShow) {
      this.difficultyCategory = '3'
    } else {
      showToast('文章难度分类错误')
      return
    }
    // 获取文章分类数据
    const articleDataList = await articleContentApi.pageListArticleContent({
      page: this.page,
      pageSize: this.pageSize,
      title: this.title,
      contentCategory: this.contentCategory,
      platformCategory: '2',
      difficultyCategory: this.difficultyCategory
    })
    isFlushed ? this.articleContentList = articleDataList.records :
    this.articleContentList.push(...articleDataList.records)
    this.total = articleDataList.total
    // 判断总数据
    if (this.total > this.page * this.pageSize) {
      this.textShow = false
    } else {
      this.textShow = true
    }
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
      Column() {
        // 搜索
        Search({ placeholder: '请输入关键字', value: $$this.keyword })
          .placeholderFont({ size: 14 })
          .textFont({ size: 14 })
          .onSubmit(() => {
            if (this.keyword != '') {
              // 处理标题
              this.title = encodeURIComponent(this.keyword)
              // 分页查询文章内容
              this.isShow = false
              this.page = 1
              this.getArticleList(true, true)
            }
          })
          .width(CommonConstant.WIDTH_FULL)
          .height(30)
          .margin({ bottom: 13 })

        // 条件刷选
        Row({ space: 10 }) {
          Column() {
            Text($r('app.string.all_condition'))
              .textStyles()
            // 选中标题会出现下划线
            if (this.allDividerShow) {
              Divider().dividerStyles()
            }
          }
          .onClick(() => {
            // 展示下划线
            this.simpleDividerShow = false
            this.mediumDividerShow = false
            this.hardDividerShow = false
            this.allDividerShow = true
            // 查询最新文章数据
            this.isShow = false
            this.page = 1
            this.getArticleList(true, true)
          })

          Column() {
            Text($r('app.string.sample_condition'))
              .textStyles()
            // 选中标题会出现下划线
            if (this.simpleDividerShow) {
              Divider().dividerStyles()
            }
          }
          .onClick(() => {
            this.allDividerShow = false
            this.mediumDividerShow = false
            this.hardDividerShow = false
            this.simpleDividerShow = true
            // 查询最新文章数据
            this.isShow = false
            this.page = 1
            this.getArticleList(true, true)
          })

          Column() {
            Text($r('app.string.medium_condition'))
              .textStyles()
            // 选中标题会出现下划线
            if (this.mediumDividerShow) {
              Divider().dividerStyles()
            }
          }
          .onClick(() => {
            // 展示下划线
            this.allDividerShow = false
            this.simpleDividerShow = false
            this.hardDividerShow = false
            this.mediumDividerShow = true
            // 查询最新文章数据
            this.isShow = false
            this.page = 1
            this.getArticleList(true, true)
          })

          Column() {
            Text($r('app.string.hard_condition'))
              .textStyles()
            // 选中标题会出现下划线
            if (this.hardDividerShow) {
              Divider().dividerStyles()
            }
          }
          .onClick(() => {
            // 展示下划线
            this.allDividerShow = false
            this.simpleDividerShow = false
            this.mediumDividerShow = false
            this.hardDividerShow = true
            // 查询最新文章数据
            this.isShow = false
            this.page = 1
            this.getArticleList(true, true)
          })

        }.justifyContent(FlexAlign.Start)
        .width(CommonConstant.WIDTH_FULL)

        // 内容组件
        if (this.isShow) {
          Refresh({ refreshing: $$this.isRefreshing }) {
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
                    .margin({ top: 50 })
                }
              }
            }
            .width(CommonConstant.WIDTH_FULL)
            .height(CommonConstant.HEIGHT_FULL)
            .scrollBar(BarState.Off)
            .onReachEnd(() => {
              if (!this.isLoad) {
                if (this.total > this.page * this.pageSize) {
                  this.isLoad = true
                  this.page++
                  // 分页查询文章数据
                  this.getArticleList(false, false)
                } else {
                  this.textShow = true
                }

              }
            })
          }.onRefreshing(() => {
            if (!this.isLoad) {
              this.isLoad = true
              this.textShow = false
              // 页面恢复到1
              this.page = 1
              this.getArticleList(true, true)
            }
          })
        } else {
          // 加载组件
          LoadingComponent()
        }
      }.padding($r('app.float.common_padding'))
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title(this.pageTitle)
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .backgroundColor($r('app.color.background_color_gray'))
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
  }
}

@Extend(Text)
function textStyles() {
  .fontSize($r('app.float.common_font_size_medium'))
  .fontWeight(FontWeight.Medium)
}

@Extend(Divider)
function dividerStyles() {
  .color(Color.Black)
  .width($r('app.float.common_width_tiny'))
  .strokeWidth(3)
}
