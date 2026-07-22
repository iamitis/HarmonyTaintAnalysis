import http from '../request/Request'
import { FeedbackContentAddParam } from './FeedbackInfoApi.type';

/**
 * 反馈内容接口
 */
class FeedbackInfoApi {
  /**
   * 添加反馈内容
   */
  addFeedbackContent = (data: FeedbackContentAddParam) => {
    return http.post('/v1/feedback/add', data)
  }
}

const feedbackInfoApi = new FeedbackInfoApi();

export default feedbackInfoApi as FeedbackInfoApi;