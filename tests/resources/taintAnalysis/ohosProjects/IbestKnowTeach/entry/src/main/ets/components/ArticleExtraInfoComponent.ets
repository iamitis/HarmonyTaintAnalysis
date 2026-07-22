import { ArticleContentData } from '../api/ArticleContentApi.type'

@Component
export struct ArticleExtraInfoComponent {
  // 文章数据
  @Prop articleInfo: ArticleContentData

  build() {
    // 展示阅读、点赞、收藏数
    Row({ space: 3 }) {
      Text(this.articleInfo.readCount + '阅读')
        .textStyles()
      Text('|')
        .textStyles()
      Text(this.articleInfo.likeCount + '点赞')
        .textStyles()
      Text('|')
        .textStyles()
      Text(this.articleInfo.collectCount + '收藏')
        .textStyles()
      Text('|')
        .textStyles()
      Text(this.articleInfo.time)
        .textStyles()
      Text('|')
        .textStyles()
      // 文章内容标签
      if (this.articleInfo.contentCategory === '1') {
        Text('鸿蒙')
          .textLabelStyles()
      } else if (this.articleInfo.contentCategory === '2') {
        Text('Java')
          .textLabelStyles()
      } else if (this.articleInfo.contentCategory === '3') {
        Text('Web前端')
          .textLabelStyles()
      } else if (this.articleInfo.contentCategory === '4') {
        Text('运维')
          .textLabelStyles()
      } else {
        Text('未知级别')
          .textLabelStyles()
      }
      Text('|')
        .textStyles()
      // 文章难度分类标签
      if (this.articleInfo.difficultyCategory === '1') {
        Text(this.articleInfo.platformCategory === '1' ? '基础知识' : '简单面试题')
          .textLabelStyles()
      } else if (this.articleInfo.difficultyCategory === '2') {
        Text(this.articleInfo.platformCategory === '1' ? '进阶知识' : '中等面试题')
          .textLabelStyles()
      } else if (this.articleInfo.difficultyCategory === '3') {
        Text(this.articleInfo.platformCategory === '1' ? '高级知识' : '困难面试题')
          .textLabelStyles()
      } else {
        Text('未知级别')
          .textLabelStyles()
      }
    }
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