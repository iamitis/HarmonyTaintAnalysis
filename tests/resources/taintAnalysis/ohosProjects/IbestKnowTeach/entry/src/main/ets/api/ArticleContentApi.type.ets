/**
 * 时间
 */
export interface BaseTime {
  /**
   * 创建时间
   */
  createTime?: Date
  /**
   * 更新时间
   */
  updateTime?: Date
}

/**
 * 分页参数
 */
export interface PageParam {
  /**
   * 当前页
   */
  page?: number
  /**
   * 每一页展示的数据条数
   */
  pageSize?: number
}


/**
 * 分页响应参数
 */
export interface PageVo<T> {
  current: number,
  size: number,
  total: number,
  records: Array<T>
}

/**
 * 分页查询文章内容
 */
export interface ArticleContentPageParam extends PageParam {
  /**
   * 标题
   */
  title?: string
  /**
   * 内容分类:1鸿蒙 2 Java 3 web 4 运维
   */
  contentCategory?: string
  /**
   * 平台分类：1学习平台 2面试题
   */
  platformCategory?: string
  /**
   * 难度分类：1 简单 2 中等 3 困难
   */
  difficultyCategory?: string
}

/**
 * 分页查询最新文章内容入参
 */
export interface ArticleContentNewPageParam extends PageParam {
  /**
   * 标题
   */
  title: string

}

/**
 * 分页查询最热文章内容入参
 */
export interface ArticleContentHotPageParam extends PageParam {
  /**
   * 标题
   */
  title: string

}

/**
 * 文章内容数据
 */
export interface ArticleContentData extends BaseTime {
  /**
   * 文章id
   */
  id: number
  /**
   * 用户头像
   */
  avatarUri: string
  /**
   * 用户昵称
   */
  nickname: string
  /**
   * 文章标题
   */
  title: string
  /**
   * 文章内容
   */
  content: string
  /**
   * 阅读数
   */
  readCount: number
  /**
   * 点赞数
   */
  likeCount: number
  /**
   * 收藏数
   */
  collectCount: number
  /**
   * 封面url
   */
  coverUrl: string
  /**
   * 内容分类:1鸿蒙 2 Java 3 web 4 运维
   */
  contentCategory: string
  /**
   * 平台分类：1学习平台 2面试题
   */
  platformCategory: string
  /**
   * 难度分类：1 简单 2 中等 3 困难
   */
  difficultyCategory: string
  /**
   * 用户是否点赞
   */
  isLike: boolean
  /**
   * 用户是否收藏
   */
  isCollect: boolean
  /**
   * 创建时间字符串格式
   */
  time: string
}


