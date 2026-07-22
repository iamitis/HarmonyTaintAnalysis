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
import { Logger } from '../Logger';

let TAG = "ManagerConstants";

export const ManagerConstants = {
  PREFER_STORE_KEY: 'nmc_store',
  SETTING_KEY: {
    UNIT: {
      NAME: 'unit',
      DEFAULT: 'm',
      RANGE_DISPLAY: ["公制", "英制"],
      RANGE_SET: ["m", "i"]
    },
    LANGUAGE: {
      NAME: 'lang',
      DEFAULT: 'zh-hans',
      RANGE_DISPLAY: ["简体中文", "繁体中文", "英文", "德语", "西班牙语", "法语", "意大利语", "日语", "韩语", "俄语"],
      RANGE_SET: ['zh-hans', 'zh-hant', 'en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'ru']
    },
    REQUEST_DAY_NUM: {
      NAME: 'forecast_day_num',
      DEFAULT: 7,
      RANGE_DISPLAY: ["3日", "7日", "10日", "15日", "30日"],
      RANGE_SET: [3, 7, 10, 15, 30]
    },
    REQUEST_HOUR_NUM: {
      NAME: 'forecast_hour_num',
      DEFAULT: 24,
      RANGE_DISPLAY: ["24小时", "72小时", "168小时"],
      RANGE_SET: [24, 72, 168]
    },
    _LAST_REQUEST_TIME: {
      NAME: '_reserved_last_request_time',
      DEFAULT: 0
    },
    CACHE_VALID_TIME: {
      NAME: 'cache_valid_time',
      DEFAULT: 1800000,
      RANGE_DISPLAY: ["10min", "30min", "1h", "3h", "6h", "12h"],
      RANGE_SET: [600000, 1800000, 3600000, 10800000, 21600000, 43200000]
    },
    POI_TYPE: {
      NAME: 'search_poi_type',
      DEFAULT: 'scenic',
      RANGE_DISPLAY: ['景点', '潮流站点', '潮汐站点'],
      RANGE_SET: ['scenic', 'CSTA', 'TSTA']
    }
  },
  Q_API_KEY_STORE_KEY: 'q_api_key',
  Q_API_ENDPOINT_STORE_KEY: 'q_api_key',
  DB_FILE_NAME: 'nmc.db',
  SECURITY_LEVEL: relationalStore.SecurityLevel.S1,
  SQL: {
    INITIALIZE: "CREATE TABLE IF NOT EXISTS CITY (ID TEXT NOT NULL, NAME TEXT NOT NULL, ADM2 TEXT NOT NULL, ADM1 TEXT NOT NULL, LAT TEXT NOT NULL,LON TEXT NOT NULL, COUNTRY TEXT NOT NULL, TIMEZONE TEXT NOT NULL, UTC_OFFSET TEXT NOT NULL, IS_DST TEXT NOT NULL, TYPE TEXT NOT NULL, RANK TEXT NOT NULL, FX_LINK TEXT NOT NULL);",
    INITIALIZE_CACHE: "CREATE TABLE IF NOT EXISTS WEATHER_CACHE (ID TEXT NOT NULL PRIMARY KEY, NAME TEXT NOT NULL, WARNINGS TEXT, DAILY TEXT, HOURLY TEXT, REALTIME TEXT);",
    GET_ALL_CITES: "SELECT * FROM CITY;",
    SEARCH_CITES: "SELECT * FROM CITY WHERE COUNTRY LIKE '%?%' OR NAME LIKE '%?%' OR ADM2 LIKE '%?%' OR ADM1 LIKE '%?%';",
    GET_CACHE: (cityId: string): string => {
      let sql = `SELECT * FROM WEATHER_CACHE WHERE ID = '${cityId}' OR NAME = '${cityId}';`;
      Logger.log(TAG, "GET_CACHE CALLED", sql);
      return sql;
    },
    ADD_CACHE: (cacheType: string, cityId: string, cache: string): string => {
      let sql = `INSERT INTO WEATHER_CACHE (ID, NAME, ${cacheType}) VALUES ('${cityId}', '${cityId}', '${cache}');`;
      Logger.log(TAG, "ADD_CACHE CALLED", sql);
      return sql;
    },
    UPDATE_CACHE: (cacheType: string, cityId: string, cache: string): string => {
      let sql = `UPDATE WEATHER_CACHE SET ${cacheType} = '${cache}' WHERE NAME = '${cityId}' OR ID = '${cityId}';`;
      Logger.log(TAG, "UPDATE_CACHE CALLED", sql);
      return sql;
    }
  },
  TABLE: {
    CITY: {
      NAME: "CITY",
      COLUMN: {
        NAME: 'NAME',
        ID: 'ID',
        LATITUDE: 'LAT',
        LONGITUDE: 'LON',
        ADM1: 'ADM1',
        ADM2: 'ADM2',
        COUNTRY: 'COUNTRY',
        TIMEZONE: 'TZ',
        UTC_OFFSET: 'UTC_OFFSET',
        IS_DST: 'IS_DST',
        TYPE: 'TYPE',
        RANK: 'RANK',
        FX_LINK: 'FX_LINK',
      }
    },
    CACHE: {
      NAME: 'CACHE',
      COLUMN: {
        ID: 'ID',
        NAME: 'NAME',
        WARNINGS: 'WARNINGS',
        DAILY: 'DAILY',
        HOURLY: 'HOURLY',
        REALTIME: 'REALTIME'
      }
    }
  },
}