import http from '../request/Request'
import { LearnClockParam, PageParam, UserLearnClockData } from './LearnClockApi.type'
import { PageVo } from './MessageApi.type'

/**
 * 消息接口
 */
class LearnClockApi {
  /**
   * 学习打卡
   */
  learnClock = (data: LearnClockParam) => {
    return http.post('/v1/learn/clock', data)
  }
  /**
   * 查询用户已打卡的日期
   */
  listClockTime = (): Promise<Array<string>> => {
    return http.get('/v1/learn/listClockTime')
  }
  /**
   * 查询用户今日是否打卡
   */
  isClock = (): Promise<boolean> => {
    return http.get('/v1/learn/isClock')
  }
  /**
   * 分页查询用户打卡记录
   */
  pageListUserClock = (data: PageParam): Promise<PageVo<UserLearnClockData>> => {
    return http.get('/v1/learn/page?page=' + data.page + '&&pageSize=' + data.pageSize)
  }
}

const learnClockApi = new LearnClockApi();

export default learnClockApi as LearnClockApi;