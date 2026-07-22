import { ArticleContentData } from '../../api/ArticleContentApi.type';
import { ArticleExtraInfoComponent } from '../../components/ArticleExtraInfoComponent'
import { LearnRichText } from '../../components/LearnRichText';
import { LoadingComponent } from '../../components/LoadingComponent';
import { CommonConstant } from '../../contants/CommonConstant'
import { router } from '@kit.ArkUI';
import articleContentApi from '../../api/ArticleContentApi';
import { showToast } from '../../utils/Toast';

@Entry
@Component
struct ArticleInfo {
  // 文章数据数组
  @Prop articleInfo: ArticleContentData
  // 控制当前页面展示
  @State isShow: boolean = false
  // 文章id
  @State articleId: number = 1
  // 节流，防止用户重复点击
  isLoad: boolean = false

  /**
   * 生命周期函数
   */
  async aboutToAppear() {
    // 获取路由传递的文章id
    const param = router.getParams() as object
    if (param) {
      this.articleId = param["articleId"] as number
      // 根据文章id查询文章数据
      this.articleInfo = await articleContentApi.getArticleContentInfo(this.articleId)
      // 展示数据
      this.isShow = true
    }
  }

  /**
   * 点赞
   * @param id
   */
  async likeArticle(id: number) {
    // 点赞或者取消点赞
    if (this.articleInfo.isLike) {
      // 取消点赞
      await articleContentApi.likeArticleContent(id)
      this.articleInfo.isLike = false
      this.articleInfo.likeCount--
      this.isLoad = false
      showToast('取消点赞成功')
    } else {
      // 点赞
      await articleContentApi.likeArticleContent(id)
      this.articleInfo.isLike = true
      this.articleInfo.likeCount++
      this.isLoad = false
      showToast('点赞成功')
    }
  }

  /**
   * 收藏
   * @param id
   */
  async collectArticle(id: number) {
    // 收藏或者取消收藏
    if (this.articleInfo.isCollect) {
      // 取消收藏
      await articleContentApi.collectArticleContent(id)
      this.articleInfo.isCollect = false
      this.articleInfo.collectCount--
      this.isLoad = false
      showToast('取消收藏成功')
    } else {
      // 收藏
      await articleContentApi.collectArticleContent(id)
      this.articleInfo.isCollect = true
      this.articleInfo.collectCount++
      this.isLoad = false
      showToast('收藏成功')
    }
  }

  build() {
    Navigation() {
      if (this.isShow) {
        Column({ space: 15 }) {
          Flex() {
            Text(this.articleInfo.title)
              .fontSize($r('app.float.common_font_size_medium'))
              .maxLines(3)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .fontColor(Color.Black)
              .fontWeight(FontWeight.Medium)
          }

          Row({ space: 10 }) {
            // 头像
            Image(this.articleInfo.avatarUri)
              .width(30)
              .aspectRatio(1)
              .borderRadius(20)
            // 昵称
            Text(this.articleInfo.nickname)
              .fontSize($r('app.float.common_font_size_medium'))
              .width('80%')
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }.width(CommonConstant.WIDTH_FULL)

          // 展示阅读、点赞、收藏数
          Row() {
            // 文章额外信息组件
            ArticleExtraInfoComponent({ articleInfo: this.articleInfo })
            Row({ space: 15 }) {
              // 点赞
              Image(this.articleInfo.isLike ? $r('app.media.icon_like_selected') : $r('app.media.icon_like_default'))
                .width(15)
                .onClick(() => {
                  // 点赞
                  if (!this.isLoad) {
                    this.isLoad = true
                    this.likeArticle(this.articleInfo.id)
                  }
                })
              // 收藏
              Image(this.articleInfo.isCollect ? $r('app.media.icon_collect_selected') :
              $r('app.media.icon_collect_default')).width(15)
                .onClick(() => {
                  // 收藏
                  if (!this.isLoad) {
                    this.isLoad = true
                    this.collectArticle(this.articleInfo.id)
                  }
                })
            }
          }.width(CommonConstant.WIDTH_FULL)
          .justifyContent(FlexAlign.SpaceBetween)

        }.padding($r('app.float.common_padding'))

        // 分割线
        Divider()
          .strokeWidth((4))
          .color('#e6f2fe')
        // 内容正文
        LearnRichText({ richTextContent: this.articleInfo.content })
          .padding($r('app.float.common_padding'))
      } else {
        // 加载组件
        LoadingComponent()
      }
    }
    .height(CommonConstant.HEIGHT_FULL)
    .width(CommonConstant.WIDTH_FULL)
    .title($r('app.string.article_info_title'))
    .titleMode(NavigationTitleMode.Mini)
    .mode(NavigationMode.Stack)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])

  }
}
