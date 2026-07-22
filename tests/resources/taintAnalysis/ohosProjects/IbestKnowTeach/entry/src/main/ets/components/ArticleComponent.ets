import { ArticleContentData } from '../api/ArticleContentApi.type'
import { CommonConstant } from '../contants/CommonConstant'

@Component
export struct ArticleComponent {
  // 文章数据
  @Prop articleContentData: ArticleContentData

  build() {
    Column() {
      Row({ space: 10 }) {
        // 头像
        Image(this.articleContentData.avatarUri)
          .width($r('app.float.common_width_tiny'))
          .aspectRatio(1)
          .borderRadius(10)
        // 姓名
        Text(this.articleContentData.nickname)
          .fontSize($r('app.float.common_font_size_medium'))
          .fontColor($r('app.color.common_gray'))
          .width('70%')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }.width(CommonConstant.WIDTH_FULL)

      Row() {
        // 内容标题
        Text(this.articleContentData.title)
          .fontSize($r('app.float.common_font_size_small'))
          .width('80%')
          .maxLines(3)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Image(this.articleContentData.coverUrl)
          .width($r('app.float.common_width_medium'))
          .aspectRatio(1)
          .objectFit(ImageFit.Contain)
          .borderRadius(5)
      }.width(CommonConstant.WIDTH_FULL)
      .justifyContent(FlexAlign.SpaceBetween)

      // 展示阅读、点赞、收藏
      Row({ space: 3 }) {
        Text(this.articleContentData.readCount + '阅读')
          .textStyles()
        Text('|')
          .textStyles()
        Text(this.articleContentData.time)
          .textStyles()
        Text('|')
          .textStyles()
        // 文章内容标签
        if (this.articleContentData.contentCategory === '1') {
          Text('鸿蒙')
            .textLabelStyles()
        } else if (this.articleContentData.contentCategory === '2') {
          Text('Java')
            .textLabelStyles()
        } else if (this.articleContentData.contentCategory === '3') {
          Text('Web前端')
            .textLabelStyles()
        } else if (this.articleContentData.contentCategory === '4') {
          Text('运维')
            .textLabelStyles()
        } else {
          Text('未知级别')
            .textLabelStyles()
        }
        Text('|')
          .textStyles()
        // 文章难度分类标签
        if (this.articleContentData.difficultyCategory === '1') {
          Text(this.articleContentData.platformCategory === '1' ? '基础知识' : '简单面试题')
            .textLabelStyles()
        } else if (this.articleContentData.difficultyCategory === '2') {
          Text(this.articleContentData.platformCategory === '1' ? '进阶知识' : '中等面试题')
            .textLabelStyles()
        } else if (this.articleContentData.difficultyCategory === '3') {
          Text(this.articleContentData.platformCategory === '1' ? '高级知识' : '困难面试题')
            .textLabelStyles()
        } else {
          Text('未知级别')
            .textLabelStyles()
        }
      }.width(CommonConstant.WIDTH_FULL)

    }
    .padding(10)
    .width(CommonConstant.WIDTH_FULL)
    .height(110)
    .margin({ top: 13 })
    .backgroundColor($r('app.color.common_white'))
    .justifyContent(FlexAlign.SpaceBetween)
    .borderRadius(10)

  }
}

@Extend(Text)
function textStyles() {
  .fontColor($r('app.color.common_gray'))
  .fontSize($r('app.float.common_font_size_tiny'))
}

@Extend(Text)
function textLabelStyles() {
  .fontSize($r('app.float.common_font_size_tiny'))
  .fontColor(Color.Black)
}