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
import relationalStore from '@ohos.data.relationalStore';
import { CacheBundle } from '../Data/CacheBundle';
import { City } from '../Data/City';
import { Warning } from '../Data/Warning';
import { WeatherDaily } from '../Data/WeatherDaily';
import { WeatherHourly } from '../Data/WeatherHourly';
import { WeatherRealTime } from '../Data/WeatherRealTime';
import { Logger } from '../Logger';
import { DataUtils } from '../Utils/DataUtils';
import { ManagerConstants } from './ManagerConstants';
import { BusinessError } from '@kit.BasicServicesKit';

let TAG = "RdbManager";

export class RdbManager {
  private storeInstance?: relationalStore.RdbStore;

  public constructor(context: Context) {
    relationalStore.getRdbStore(context, {
      name: ManagerConstants.DB_FILE_NAME,
      securityLevel: ManagerConstants.SECURITY_LEVEL
    })
      .then(store => {
        this.storeInstance = store;
        store.executeSql(ManagerConstants.SQL.INITIALIZE)
          .catch((e:BusinessError) => {
            Logger.err(TAG, "error while initializing db", e);
          })
          .then(() => {
            return store.executeSql(ManagerConstants.SQL.INITIALIZE_CACHE)
          })
          .catch((e:BusinessError) => {
            Logger.err(TAG, "error while initializing db", e);
          })
          .then(() => {
            Logger.info(TAG, "database initialized")
          })

      })
      .catch((e:BusinessError) => {
        Logger.err(TAG, "error while creating dbManager instance:", e);
      });
  }

  public static getInstance(context?: Context): RdbManager {
    if (globalThis.__rdbManager__ == undefined)
      globalThis.__rdbManager__ = new RdbManager(context??globalThis.context);
    return globalThis.__rdbManager__;
  }

  public async getAllStoredCities(): Promise<City[]> {
    return await new Promise<City[]>(ret => {
      if(this.storeInstance==undefined) {
        ret([]);
        return;
      }
      this.storeInstance.querySql(ManagerConstants.SQL.GET_ALL_CITES)
        .then(v => {
          let cities = DataUtils.createCityArrayFromResultSet(v);
          v.close();
          ret(cities);
        })
        .catch((e:BusinessError) => {
          Logger.err(TAG, "error when getting all stored cities", e);
          ret([]);
        });
    });
  }

  public async removeCity(id: string): Promise<number> {
    if(this.storeInstance==undefined){
      return 0;
    }
    let predicate: relationalStore.RdbPredicates = new relationalStore.RdbPredicates(ManagerConstants.TABLE.CITY.NAME);
    predicate.equalTo(ManagerConstants.TABLE.CITY.COLUMN.NAME, id)
      .or()
      .equalTo(ManagerConstants.TABLE.CITY.COLUMN.ID, id);
    let affected = await this.storeInstance.delete(predicate);
    return affected;
  }
  public async addCity(...cities: City[]): Promise<number> {
    return await new Promise<number>(ret => {
      if(this.storeInstance==undefined){
        ret(0);
        return;
      }
      for (let i = 0;i < cities.length; i++) {
        let city = cities[i];
        let bucket: relationalStore.ValuesBucket = {
          'NAME': city.name,
          'ID': city.id,
          'LAT': city.lat,
          'LON': city.lon,
          'ADM1': city.adm1,
          'ADM2': city.adm2,
          'COUNTRY': city.country,
          'TIMEZONE': city.tz,
          'UTC_OFFSET': city.utcOffset,
          'IS_DST': city.isDst,
          'TYPE': city.type,
          'RANK': city.rank,
          'FX_LINK': city.fxLink
        };
        this.storeInstance.insert(ManagerConstants.TABLE.CITY.NAME, bucket)
          .then(v => {
            Logger.info(TAG, "insert success", v)
            if (i == cities.length - 1) ret(v);
          })
          .catch((e:BusinessError) => {
            Logger.err(TAG, "error when adding city", e, bucket);
            ret(-1);
          });
      }

    });
  }

  public async setWarningCache(cityId: string, cache: Warning[]) {
    return await new Promise<number>(ret => {
      if(this.storeInstance==undefined){
        ret(0);
        return;
      }
      // 查找表中是否有符合cityId的数据
      Logger.log(TAG, "setting warning cache for", cityId, ", warning length:", cache.length);
      let predicate: relationalStore.RdbPredicates = new relationalStore.RdbPredicates(ManagerConstants.TABLE.CACHE.NAME);
      predicate.equalTo(ManagerConstants.TABLE.CACHE.COLUMN.ID, cityId)
        .or()
        .equalTo(ManagerConstants.TABLE.CACHE.COLUMN.NAME, cityId);
      this.storeInstance.query(predicate, [])
        .then(resultSet => {
          if (resultSet.rowCount > 0) { // 数据存在
            Logger.log(TAG, "cache not exist, updating");
            this.storeInstance!.update({
              'WARNINGS': JSON.stringify(cache)
            }, predicate)
              .then(num => {
                Logger.log(TAG, "cache updated, affected rows:", num)
                ret(num);
              }).catch((e:BusinessError) => {
              Logger.err(TAG, "error fetch cache:", e);
            })
          } else { // 数据不存在
            Logger.log(TAG, "cache not exist, creating");
            this.storeInstance!.insert(ManagerConstants.TABLE.CACHE.NAME, {
              'ID': cityId,
              'WARNINGS': JSON.stringify(cache),
              'NAME': cityId
            })
              .then(num => {
                Logger.log(TAG, "cache created, affected rows:", num)
                ret(num);
              }).catch((e:BusinessError) => {
              Logger.err(TAG, "error fetch cache:", e);
            })
          }
        });
    });
  }

  public async setDailyCache(cityId: string, cache: WeatherDaily[]) {
    return await new Promise<number>(ret => {
      if(this.storeInstance==undefined){
        ret(0);
        return;
      }
      // 查找表中是否有符合cityId的数据
      Logger.log(TAG, "setting daily cache for: ", cityId, ", cache length:", cache.length);
      this.storeInstance.querySql(ManagerConstants.SQL.GET_CACHE(cityId))
        .then(resultSet => {
          if (resultSet.rowCount > 0) { // 数据存在
            Logger.log(TAG, "cache exist, updating");
            this.storeInstance!.executeSql(ManagerConstants.SQL.UPDATE_CACHE('DAILY', cityId, JSON.stringify(cache)))
              .then(() => {
                Logger.log(TAG, "cache added");
                ret(1)
              })
              .catch((e:BusinessError) => {
                Logger.err(TAG, "error setting cache:", e);
                ret(-1)
              })
          } else { // 数据不存在
            Logger.log(TAG, "cache not exist, creating");
            let sql = ManagerConstants.SQL.ADD_CACHE('DAILY', cityId, JSON.stringify(cache));
            Logger.log(TAG, sql);
            this.storeInstance!.executeSql(ManagerConstants.SQL.ADD_CACHE('DAILY', cityId, JSON.stringify(cache)))
              .then(() => {
                Logger.log(TAG, "cache added");
                ret(1);
              })
              .catch((e:BusinessError) => {
                Logger.err(TAG, "error setting cache:", e);
                ret(-1);
              })
          }
        })

    })
  }

  public async setCache(cityId: string, type: keyof CacheBundle, cache: Warning[] | WeatherDaily[] | WeatherHourly[] | WeatherRealTime): Promise<number> {
    let cacheType = type.toUpperCase();
    return await new Promise<number>(ret => {
      if(this.storeInstance==undefined){
        ret(0);
        return;
      }
      this.storeInstance.querySql(ManagerConstants.SQL.GET_CACHE(cityId))
        .then((resultSet => {
          Logger.log(TAG, "cache verified,", resultSet.rowCount, "presented in resultSet");
          if (resultSet.rowCount > 0) {
            this.storeInstance!.executeSql(ManagerConstants.SQL.UPDATE_CACHE(cacheType, cityId, JSON.stringify(cache)))
              .then(() => ret(1))
              .catch((e:BusinessError) => {
                Logger.err(TAG, "executeSql failed, catch error:", e);
                ret(-1);
              })
          } else {
            this.storeInstance!.executeSql(ManagerConstants.SQL.ADD_CACHE(cacheType, cityId, JSON.stringify(cache)))
              .then(() => ret(1))
              .catch((e:BusinessError) => {
                Logger.err(TAG, "executeSql failed, catch error:", e);
                ret(-1);
              })
          }
        }))
        .catch((e:BusinessError) => {
          Logger.err(TAG, "error attempting to query sql to check if there exist cache for", cityId, e);
          ret(-1);
        })
    })
  }

  public async getCache(cityId: string): Promise<CacheBundle> {
    return await new Promise<CacheBundle>(ret => {
      Logger.log(TAG, "Fetching cache for", cityId);
      if(this.storeInstance==undefined){
        ret(DataUtils.emptyCacheBundle());
        return;
      }
      this.storeInstance.querySql(ManagerConstants.SQL.GET_CACHE(cityId))
        .then(resultSet => {
          Logger.log(TAG, "Cache queried, rowCount:", resultSet.rowCount, "columnCount:", resultSet.columnCount);
          if (resultSet.rowCount > 0) {
            resultSet.goToFirstRow();
            let cache: CacheBundle = {
              warnings: JSON.parse(resultSet.getString(2)),
              daily: JSON.parse(resultSet.getString(3)),
              hourly: JSON.parse(resultSet.getString(4)),
              realtime: JSON.parse(resultSet.getString(5))
            }
            ret(cache);
          } else {
            ret(DataUtils.emptyCacheBundle());
          }
        }).catch((e:BusinessError) => {
        Logger.err(TAG, "error fetch cache:", e);
      })
    });
  }

  public async setHourlyCache(cityId: string, cache: WeatherHourly[]) {
    if(this.storeInstance==undefined){
      return 0;
    }
    // 查找表中是否有符合cityId的数据
    let predicate: relationalStore.RdbPredicates = new relationalStore.RdbPredicates(ManagerConstants.TABLE.CACHE.NAME);
    predicate.equalTo(ManagerConstants.TABLE.CACHE.COLUMN.ID, cityId)
      .or()
      .equalTo(ManagerConstants.TABLE.CACHE.COLUMN.NAME, cityId);
    let resultSet = await this.storeInstance.query(predicate, [])
    if (resultSet.rowCount > 0) { // 数据存在
      return await this.storeInstance.update({
        'HOURLY': JSON.stringify(cache)
      }, predicate);
    } else { // 数据不存在
      return await this.storeInstance.insert(ManagerConstants.TABLE.CACHE.NAME, {
        'ID': cityId,
        'HOURLY': JSON.stringify(cache),
        'NAME': cityId
      });
    }
  }

  public async setRealTimeCache(cityId: string, cache: WeatherRealTime) {
    if(this.storeInstance==undefined){
      return 0;
    }
    // 查找表中是否有符合cityId的数据
    let predicate: relationalStore.RdbPredicates = new relationalStore.RdbPredicates(ManagerConstants.TABLE.CACHE.NAME);
    predicate.equalTo(ManagerConstants.TABLE.CACHE.COLUMN.ID, cityId)
      .or()
      .equalTo(ManagerConstants.TABLE.CACHE.COLUMN.NAME, cityId);
    let resultSet = await this.storeInstance.query(predicate, [])
    if (resultSet.rowCount > 0) { // 数据存在
      return await this.storeInstance.update({
        'REALTIME': JSON.stringify(cache)
      }, predicate);
    } else { // 数据不存在
      return await this.storeInstance.insert(ManagerConstants.TABLE.CACHE.NAME, {
        'ID': cityId,
        'REALTIME': JSON.stringify(cache),
        'NAME': cityId
      });
    }
  }
}