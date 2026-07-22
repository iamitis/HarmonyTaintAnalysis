/**
 * 登录接口的传参
 */
export interface LoginParam {
  /**
   * 账号
   */
  account: string
  /**
   * 密码
   */
  password: string
}


/**
 * 用户信息
 */
export interface UserInfo {
  /**
   * 用户id
   */
  id: number
  /**
   * 账号
   */
  account: string
  /**
   * 昵称
   */
  nickname: string
  /**
   * 头像
   */
  avatarUri: string

}

/**
 * 修改用户昵称接口入参
 */
export interface UserNicknameUpdateParam {
  /**
   * 昵称
   */
  nickname: string
}