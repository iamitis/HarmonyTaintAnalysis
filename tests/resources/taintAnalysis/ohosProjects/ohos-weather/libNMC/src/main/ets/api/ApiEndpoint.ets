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
import { Logger } from '../Logger';
import { PreferenceManager } from '../manager/PreferenceManager';

let TAG = "ApiEndpoint";

export class ApiEndpoint {
  public static async Init():Promise<void>{
    ApiEndpoint.Q_API_ROOT = await PreferenceManager.getInstance().getApiHost();
  }
  public static ROOT = "http://www.nmc.cn/";
  public static REST_ROOT = "http://www.nmc.cn/rest/";
  public static Q_GEO_API_ROOT = "https://geoapi.qweather.com/v2/";
  public static Q_API_ROOT = "https://devapi.qweather.com/v7/"
  private static Q_GEO_API_CITY = "https://geoapi.qweather.com/v2/city/";
  private static Q_GEO_API_POI = "https://geoapi.qweather.com/v2/poi/";
  private static REST_PROVINCE = "http://www.nmc.cn/rest/province/";
  private static REST_WEATHER_BASE = "http://www.nmc.cn/rest/weather";

  public static REST_PROVINCE_ALL() {
    let timestamp = ApiEndpoint.getTimestamp();
    let url = `${ApiEndpoint.REST_PROVINCE}all?_=${timestamp}`;
    Logger.log(TAG, "REST_PROVINCE_ALL CALLED", url);
    return url;
  }

  public static REST_PROVINCE_P(p: string) {
    let timestamp = ApiEndpoint.getTimestamp();
    let url = `${ApiEndpoint.REST_PROVINCE}${p}?_=${timestamp}`;
    Logger.log(TAG, "REST_PROVINCE_P CALLED", url);
    return url;
  }

  public static REST_WEATHER(s: string) {
    let url = `${ApiEndpoint.REST_WEATHER_BASE}?stationid=${s}`;
    Logger.log(TAG, "REST_WEATHER CALLED", url);
    return url;
  }

  public static REST_POSITION(s?: string) {
    let url = `${ApiEndpoint.REST_ROOT}position?stationid=${s??''}`;
    Logger.log(TAG, "REST_POSITION CALLED", url);
    return url;
  }

  public static Q_CITY_LOOKUP(location: string, key: string, lang: string) {
    let url = `${ApiEndpoint.Q_GEO_API_CITY}lookup?location=${encodeURI(location)}&key=${key}&lang=${lang}`;
    Logger.log(TAG, "Q_CITY_LOOKUP CALLED", url);
    return url;
  }

  public static Q_CITY_TOP(key: string, lang: string) {
    let url = `${ApiEndpoint.Q_GEO_API_CITY}top?key=${key}&lang=${lang}`;
    Logger.log(TAG, "Q_CITY_LOOKUP CALLED", url);
    return url;
  }

  public static Q_POI_LOOKUP(location: string, type: 'scenic' | 'CSTA' | 'TSTA', key: string, city: string = '', number: number = 10, lang: string = '') {
    let url = `${ApiEndpoint.Q_GEO_API_POI}lookup?location=${encodeURI(location)}&key=${key}&city=${city}&type=${type}&number=${number}&lang=${lang}`;
    Logger.log(TAG, "Q_POI_LOOKUP CALLED", url);
    return url;
  }

  public static Q_WEATHER_REALTIME_CITY(location: string, key: string, lang: string = 'zh', unit: 'm' | 'i' = 'm') {
    let url = `${ApiEndpoint.Q_API_ROOT}weather/now?location=${encodeURI(location)}&key=${key}&lang=${lang}&unit=${unit}`;
    Logger.log(TAG, "Q_WEATHER_REALTIME_CITY CALLED", url);
    return url;
  }

  public static Q_WEATHER_DAILY_CITY(location: string, key: string, lang: string = 'zh', unit: 'm' | 'i' = 'm', dayNum: 3 | 7 | 10 | 15 | 30 = 10) {
    let url = `${ApiEndpoint.Q_API_ROOT}weather/${dayNum}d?location=${encodeURI(location)}&key=${key}&lang=${lang}&unit=${unit}`;
    Logger.log(TAG, "Q_WEATHER_DAILY_CITY CALLED", url);
    return url;
  }

  public static Q_WARNING(location: string, key: string, lang: string = 'zh') {
    let url = `${ApiEndpoint.Q_API_ROOT}warning/now?location=${encodeURI(location)}&key=${key}&lang=${lang}`;
    Logger.log(TAG, "Q_WARNING CALLED", url);
    return url;
  }

  public static Q_WEATHER_HOURLY(location: string, key: string, lang: string = 'zh', unit: 'm' | 'i' = 'm', hourNum: 24 | 72 | 168 = 24) {
    let url = `${ApiEndpoint.Q_API_ROOT}weather/${hourNum}h?location=${encodeURI(location)}&key=${key}&lang=${lang}&unit=${unit}`;
    Logger.log(TAG, "Q_WEATHER_HOURLY CALLED", url);
    return url;
  }

  public static Q_Weather_Image(img: string): string {
    let url = `https://a.hecdn.net/img/common/icon/202106d/${img}.png`;
    Logger.log(TAG, "Q_Weather_Image CALLED", url);
    return url;
  }

  public static ApiKeyVerify(key: string): string {
    let url = `https://devapi.qweather.com/v7/weather/now?location=101071001&key=${key}`;
    Logger.log(TAG, "ApiKeyVerify CALLED", url);
    return url;
  }

  private static getTimestamp() {
    let date = new Date();
    let timestamp = date.getTime();
    Logger.log(TAG, "ApiEndpoint calculated timestamp is", timestamp);
    return timestamp;
  }
}