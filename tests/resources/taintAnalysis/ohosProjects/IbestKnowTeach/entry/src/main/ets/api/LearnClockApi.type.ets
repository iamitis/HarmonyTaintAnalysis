/**
 * 学习打卡入参
 */
export interface LearnClockParam {
  /**
   * 打卡地点
   */
  location: string
  /**
   * 打卡内容
   */
  content: string
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
 * 分页响应参数
 */
export interface PageVo<T> {
  current: number,
  size: number,
  total: number,
  records: Array<T>
}

/**
 * 用户打卡记录数据
 */
export interface UserLearnClockData extends BaseTime {

  /**
   * 学习打卡id
   */
  id: number
  /**
   * 打卡地点
   */
  location: string
  /**
   * 打卡内容
   */
  content: string
  /**
   * 用户昵称
   */
  nickname: string
  /**
   * 创建时间字符串格式
   */
  time: string

}


