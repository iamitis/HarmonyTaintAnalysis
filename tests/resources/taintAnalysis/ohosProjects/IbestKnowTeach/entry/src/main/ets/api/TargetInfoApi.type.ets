/**
 * 用户整体目标完成进度统计
 */
export interface TargetInfoCountVo {
  /**
   * 总目标数量
   */
  totalQuantity: number
  /**
   * 完成目标的数量
   */
  completeQuantity: number
  /**
   * 更新时间
   */
  updateTime: string
}

/**
 * 新增目标
 */
export interface TargetInfoAddParam {
  /**
   * 目标内容
   */
  content: string

}

/**
 * 修改目标
 */
export interface TargetInfoEditParam {
  /**
   * 目标内容
   */
  content: string
  /**
   * 目标内容id
   */
  id: number

}

/**
 * 完成目标
 */
export interface TargetInfoCompleteParam {
  /**
   * 目标内容id
   */
  id: number

}

/**
 * 删除目标
 */
export interface TargetInfoDeleteParam {
  /**
   * 目标内容id
   */
  id: number

}


/**
 * 用户目标内容详情
 */
export interface TargetInfoVo extends BaseTime {
  /**
   * 目标内容id
   */
  id: number
  /**
   * 目标内容
   */
  content: string
  /**
   * 目标状态：0未完成 1完成
   */
  status: string
  /**
   * 创建时间字符串格式
   */
  time: string
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


