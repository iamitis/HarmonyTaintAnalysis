import http from '../request/Request'
import { LoginParam, UserInfo, UserNicknameUpdateParam } from './UserApi.type'

/**
 * 用户接口
 */
class UserApi {
  /**
   * 登录接口
   */
  userLogin = (data: LoginParam): Promise<string> => {
    return http.post('/v1/user/login', data)
  }
  /**
   * 获取用户信息
   */
  getUserInfo = (): Promise<UserInfo> => {
    return http.get('/v1/user/info')
  }
  /**
   * 修改用户昵称
   */
  editNickname = (data: UserNicknameUpdateParam) => {
    return http.post('/v1/user/editNickname', data)
  }
}

const userApi = new UserApi();

export default userApi as UserApi;