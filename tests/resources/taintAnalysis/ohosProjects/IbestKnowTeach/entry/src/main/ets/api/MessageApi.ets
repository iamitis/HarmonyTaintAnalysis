import http from '../request/Request'
import { MessageInfoNew, PageVo, UserMessageCount, UserMessageInfo, UserMessagePageParam } from './MessageApi.type'

/**
 * 消息接口
 */
class MessageApi {
  /**
   * 获取最新消息
   */
  getMessageNew = (): Promise<Array<MessageInfoNew>> => {
    return http.get('/v1/message/new')
  }
  /**
   * 查询用户获得的消息总数量和未读
   */
  getUserMessageCount = (): Promise<UserMessageCount> => {
    return http.get('/v1/message/count')
  }
  /**
   * 用户根据消息分类查询分页的消息
   */
  getMessageList = (data: UserMessagePageParam): Promise<PageVo<UserMessageInfo>> => {
    return http.get('/v1/message/list?type=' + data.type + '&&page=' + data.page + '&&pageSize=' + data.pageSize)
  }
  /**
   * 查看消息详情
   */
  getMessageInfo = (data: number): Promise<UserMessageInfo> => {
    return http.get('/v1/message/info?id=' + data)
  }
}

const messageApi = new MessageApi();

export default messageApi as MessageApi;