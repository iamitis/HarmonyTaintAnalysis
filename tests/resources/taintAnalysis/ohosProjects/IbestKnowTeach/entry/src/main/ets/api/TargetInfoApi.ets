import http from '../request/Request'
import { PageParam, PageVo, TargetInfoAddParam,
  TargetInfoCompleteParam,
  TargetInfoCountVo,
  TargetInfoDeleteParam,
  TargetInfoEditParam,
  TargetInfoVo } from './TargetInfoApi.type'

/**
 * 目标内容接口
 */
class TargetInfoApi {
  /**
   * 获取用户整体目标完成进度统计
   */
  getTargetInfoCount = (): Promise<TargetInfoCountVo> => {
    return http.get('/v1/target/count')
  }
  /**
   * 分页查询用户整体目标
   */
  pageListTargetInfo = (data: PageParam): Promise<PageVo<TargetInfoVo>> => {
    return http.get('/v1/target/page?page=' + data.page + '&&pageSize=' + data.pageSize)
  }
  /**
   * 新增目标
   */
  addTargetInfo = (data: TargetInfoAddParam) => {
    return http.post('/v1/target/add', data)
  }

  /**
   * 修改目标
   */
  editTargetInfo = (data: TargetInfoEditParam) => {
    return http.post('/v1/target/edit', data)
  }

  /**
   * 完成目标
   */
  completeTargetInfo = (data: TargetInfoCompleteParam) => {
    return http.post('/v1/target/complete', data)
  }

  /**
   * 删除目标
   */
  deleteTargetInfo = (data: TargetInfoDeleteParam) => {
    return http.post('/v1/target/delete', data)
  }

}

const targetInfoApi = new TargetInfoApi();

export default targetInfoApi as TargetInfoApi;