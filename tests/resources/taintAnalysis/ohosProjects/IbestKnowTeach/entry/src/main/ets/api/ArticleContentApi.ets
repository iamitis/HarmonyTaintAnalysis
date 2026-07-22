import http from '../request/Request'
import {
  ArticleContentData,
  ArticleContentHotPageParam,
  ArticleContentNewPageParam,
  ArticleContentPageParam,
  PageVo
} from './ArticleContentApi.type'

/**
 * 文章接口
 */
class ArticleContentApi {
  /**
   * 分页查询文章内容
   */
  pageListArticleContent = (data: ArticleContentPageParam): Promise<PageVo<ArticleContentData>> => {
    return http.get('/v1/article/page?page=' + data.page + '&&pageSize=' + data.pageSize + '&&title=' + data.title +
      '&&contentCategory=' + data.contentCategory + '&&platformCategory=' + data.platformCategory +
      '&&difficultyCategory=' + data.difficultyCategory)
  }
  /**
   * 根据文章id查询文章详情
   */
  getArticleContentInfo = (data: number): Promise<ArticleContentData> => {
    return http.get('/v1/article/info?id=' + data)
  }
  /**
   *  用户点赞/取消点赞文章
   */
  likeArticleContent = (data: number) => {
    return http.put('/v1/article/like?id=' + data)
  }
  /**
   *  用户收藏/取消收藏文章
   */
  collectArticleContent = (data: number) => {
    return http.put('/v1/article/collect?id=' + data)
  }
  /**
   * 查看我的点赞,最近100条
   */
  getUserLike = (): Promise<Array<ArticleContentData>> => {
    return http.get('/v1/article/myLike')
  }
  /**
   *查看我的收藏,最近100条
   */
  getUserCollect = (): Promise<Array<ArticleContentData>> => {
    return http.get('/v1/article/myCollect')
  }
  /**
   *分页查看最新文章
   */
  getNewArticle = (data: ArticleContentNewPageParam): Promise<PageVo<ArticleContentData>> => {
    return http.get('/v1/article/new?page=' + data.page + '&&pageSize=' + data.pageSize + '&&title=' + data.title)
  }
  /**
   *分页查看最热文章
   */
  getHotArticle = (data: ArticleContentHotPageParam): Promise<PageVo<ArticleContentData>> => {
    return http.get('/v1/article/hot?page=' + data.page + '&&pageSize=' + data.pageSize + '&&title=' + data.title)
  }
}

const articleContentApi = new ArticleContentApi();

export default articleContentApi as ArticleContentApi;