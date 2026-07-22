import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from '@ohos/axios'
import { CODE_TYPE, BASE_HOST } from "./Request.type"
import { Logger } from '../utils/Logger';
import { showToast } from '../utils/Toast';
import { CommonConstant } from '../contants/CommonConstant';
import { PreferencesUtil } from '../utils/PreferencesUtil';
import { router } from '@kit.ArkUI';
import { RouterConstant } from '../contants/RouterConstant';


/**
 * axios封装
 */
const http = axios.create({
  baseURL: `http://${BASE_HOST}`,
  headers: {
    'Content-Type': 'application/json',
    "Channel": "B2B"
  }
},)


/**
 * 添加请求拦截器
 */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // 获取数据
  const token: string | undefined = AppStorage.get("token")
  // 获取token
  if (token) {
    config.headers.Authorization = token
  }
  return config;
}, (error: AxiosError) => {
  // 对请求错误做些什么
  return Promise.reject(error);
});


/**
 * 添加响应拦截器
 */
http.interceptors.response.use((response: AxiosResponse) => {
  Logger.info("请求状态码" + response.data.code, JSON.stringify(response.data));
  // 判断响应状态码
  if (response.status === CODE_TYPE.SUCCESS) {
    // 请求成功
    if (response.data.code === CODE_TYPE.SUCCESS) {
      return Promise.resolve(response.data.data);
    } else if (response.data.code === CODE_TYPE.NO_LOGIN) {
      clearLoginInfoAndGoLoginPage();
    }
  }
  // 接口响应报错新信息
  showToast(response.data.message);
  return Promise.reject(response);
}, (error: AxiosError) => {
  showToast('网络错误，换个网络试试');
  return Promise.reject(error);
});

export default http;

/**
 * 清除用户信息并跳到登录页面
 */
async function clearLoginInfoAndGoLoginPage() {
  // 401错误  -> 清理用户信息，跳转到登录页
  // 清理token，返回登录页
  // userInfo有订阅者删不掉，所以重新赋值空的给userInfo
  AppStorage.setOrCreate(CommonConstant.USER_INFO, {
    nickname: '',
    account: '',
    avatarUri: '',
    id: 0
  })
  AppStorage.delete(CommonConstant.TOKEN_NAME)
  await PreferencesUtil.delAllData(CommonConstant.PREFERENCES_NAME, CommonConstant.TOKEN_NAME)
  await PreferencesUtil.delAllData(CommonConstant.PREFERENCES_NAME, CommonConstant.USER_INFO)
  // 跳转登录页面
  router.pushUrl({
    url: RouterConstant.PAGE_LOGIN
  })
}