// This file is part of libNMC, which is the foundation of ohos-weather.
// Copyright (C) 2023  Tingjin<dev@peercat.cn>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import preferences from '@ohos.data.preferences';
import { SettingType } from '../Data/SettingType';
import { Logger } from '../Logger';
import { ManagerConstants } from './ManagerConstants';
import { Context } from '@kit.AbilityKit';

let TAG = "PreferenceManager";

export class PreferenceManager {
  private settingStore: preferences.Preferences;

  public constructor(context: Context,callback?:()=>void) {
    this.settingStore = preferences.getPreferencesSync(context, {
      name:ManagerConstants.PREFER_STORE_KEY
    })
    if(callback!==undefined)callback();
  }

  public static getInstance(context?: Context): PreferenceManager {
    if (globalThis.__settingManager__ == undefined)
      globalThis.__settingManager__ = new PreferenceManager(context??globalThis.context)
    return globalThis.__settingManager__;
  }

  public set(k: string, v: SettingType): void {
    this.settingStore.putSync(k, v);
    this.settingStore.flush()
  }

  public async get<T extends SettingType>(k: string, def: T): Promise<T> {
    return await new Promise((ret) => {
      this.settingStore.has(k, (e, r) => {
          !e && r ?
        this.settingStore.get(k, def, (e, v: T) => {
            !e ? ret(v) : Logger.err(TAG, "error while getting value of", k, e)
        }) : ret(def);
      })
    })
  }

  public async getApiHost():Promise<string>{
    return this.get(ManagerConstants.Q_API_ENDPOINT_STORE_KEY,"");
  }

  public setApiHost(key:string):void{
     this.set(ManagerConstants.Q_API_ENDPOINT_STORE_KEY,key);
  }

  public async getApiKey(): Promise<string> {
    return this.get(ManagerConstants.Q_API_KEY_STORE_KEY, "");
  }

  public setApiKey(key: string): void {
    this.set(ManagerConstants.Q_API_KEY_STORE_KEY, key);
  }

  public getLanguage(): Promise<string> {
    return this.get(ManagerConstants.SETTING_KEY.LANGUAGE.NAME, ManagerConstants.SETTING_KEY.LANGUAGE.DEFAULT);
  }

  public setLanguage(key: string) {
    this.set(ManagerConstants.SETTING_KEY.LANGUAGE.NAME, key);
  }

  public getUnit(): Promise<string> {
    return this.get(ManagerConstants.SETTING_KEY.UNIT.NAME, ManagerConstants.SETTING_KEY.UNIT.DEFAULT);
  }

  public setUnit(unit: string) {
    this.set(ManagerConstants.SETTING_KEY.UNIT.NAME, unit);
  }

  public getDailyRequestDayNum(): Promise<number> {
    return this.get(ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.NAME, ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.DEFAULT);
  }

  public setDailyRequestDayNum(num: number) {
    this.set(ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.NAME, num);
  }

  public getHourlyRequestHourNum(): Promise<number> {
    return this.get(ManagerConstants.SETTING_KEY.REQUEST_HOUR_NUM.NAME, ManagerConstants.SETTING_KEY.REQUEST_HOUR_NUM.DEFAULT);
  }

  public setHourlyRequestHourNum(num: number) {
    this.set(ManagerConstants.SETTING_KEY.REQUEST_HOUR_NUM.NAME, num);
  }

  public getLastRequestTime(): Promise<number> {
    return this.get(ManagerConstants.SETTING_KEY._LAST_REQUEST_TIME.NAME, ManagerConstants.SETTING_KEY._LAST_REQUEST_TIME.DEFAULT);
  }

  public setLastRequestTime(t: number) {
    this.set(ManagerConstants.SETTING_KEY._LAST_REQUEST_TIME.NAME, t);
  }

  public getCacheValidTime(): Promise<number> {
    return this.get(ManagerConstants.SETTING_KEY.CACHE_VALID_TIME.NAME, ManagerConstants.SETTING_KEY.CACHE_VALID_TIME.DEFAULT);
  }

  public setCacheValidTime(t: number) {
    this.set(ManagerConstants.SETTING_KEY.CACHE_VALID_TIME.NAME, t);
  }

  public setPoiType(t: string) {
    this.set(ManagerConstants.SETTING_KEY.POI_TYPE.NAME, t);
  }

  public getPoiType(): Promise<string> {
    return this.get(ManagerConstants.SETTING_KEY.POI_TYPE.NAME, ManagerConstants.SETTING_KEY.POI_TYPE.DEFAULT);
  }
}