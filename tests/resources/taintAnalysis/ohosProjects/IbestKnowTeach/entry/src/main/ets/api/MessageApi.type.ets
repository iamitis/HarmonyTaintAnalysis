/**
 * 最新消息
 */
export interface MessageInfoNew extends BaseTime {
  /**
   * 消息id
   */
  id: number
  /**
   * 消息标题
   */
  title: string
  /**
   * 消息内容
   */
  content: string
  /**
   * 消息类型'1' 系统消息 '2' 通知公告
   */
  type: string

}

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
 * 消息总数量和未读
 */
export interface UserMessageCount {
  /**
   * 总消息数量
   */
  totalQuantity: number
  /**
   * 总未读数量
   */
  totalUnReadQuantity: number
  /**
   * 系统消息未读数量
   */
  systemUnReadQuantity: number
  /**
   * 通知公告消息未读数量
   */
  noticeUnReadQuantity: number
}


/**
 * 用户消息详情
 */
export interface UserMessageInfo extends BaseTime {
  /**
   * 用户消息id
   */
  id: number
  /**
   * 是否查看 '0'未查看 '1'查看
   */
  isLook: string
  /**
   * 消息id
   */
  messageId?: number
  /**
   * 消息标题
   */
  title: string
  /**
   * 消息内容
   */
  content: string
  /**
   * 消息类型'1' 系统消息 '2' 通知公告
   */
  type?: string
  /**
   * 创建时间
   */
  time: string

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
 * 用户根据消息分类查询所有的消息
 */
export interface UserMessagePageParam extends PageParam {
  /**
   * 消息类型
   */
  type: string
}

