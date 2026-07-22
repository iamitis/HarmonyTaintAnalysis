import { session } from '../utils/RequestUtil'

const USERS = 'users';

export interface User {
  id?: number,
  role: string,
  phone: string,
  password: string,
  related_phone: string,
};

export async function getUserById(id: number) {
  return await session.get(`${USERS}/getInformation/${id}`);
}

export interface AddressInfo {
  addressInfoId?: number,
  userId: number,
  areaAddress: string[], // 省市区
  detailAddress: string, // 详细地址
  phone: string,
  receiver: string, // 收件人
  isDefault: boolean, // 是否为默认地址
}
@Concurrent
export async function getAllAddressInfo(userId: number) {
  return await session.get(`users/getAllAddressInfo/${userId}`);
}
export interface LoginInfo {
  phone: string,
  password: string,
};

export interface ResponInfo{
    timestamp: string,
    status: number,
}
export async function login(thePhone: string,thePassword: string) {
  const loginInfo: LoginInfo = {
    phone: thePhone,
    password: thePassword,
  }
  return await session.post(`${USERS}/login`, loginInfo)
}
@Concurrent
export async function register(user:User) {
  return await session.post(`${'users'}/register`,user);
}
@Concurrent
export async function deleteAddressInfo(addressInfoId: number) {
  return await session.delete(`${'users'}/deleteAddressInfo/${addressInfoId}`);
}
export async function addAddressInfo(addressInfo:AddressInfo) {
  return await session.post(`users/addAddressInfo`,addressInfo);
}

export async function logout(userId: number) {
  return await session.post(`${USERS}/logout/${userId}`);
}