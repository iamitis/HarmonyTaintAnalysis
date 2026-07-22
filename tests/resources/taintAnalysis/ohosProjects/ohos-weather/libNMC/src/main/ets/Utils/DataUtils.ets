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
import { WeatherDaily } from '../Data/WeatherDaily';
import { WeatherRealTime } from '../Data/WeatherRealTime';
import { Logger } from '../Logger';

let TAG = "DataUtils";

export class DataUtils {
  public static emptyCity(): City {
    return {
      id: '0',
      name: '',
      adm2: '',
      adm1: '',
      lat: '0',
      lon: '0',
      country: '',
      tz: '',
      utcOffset: '',
      isDst: '',
      type: '',
      rank: '',
      fxLink: ''
    };
  }

  public static emptyWeatherDaily(): WeatherDaily {
    return {
      fxDate: '',
      sunrise: '',
      sunset: '',
      moonrise: '',
      moonset: '',
      moonPhase: '',
      moonPhaseIcon: '',
      tempMax: '',
      tempMin: '',
      iconDay: '',
      textDay: '',
      iconNight: '',
      textNight: '',
      wind360Day: '',
      windDirDay: '',
      windScaleDay: '',
      windSpeedDay: '',
      wind360Night: '',
      windDirNight: '',
      windScaleNight: '',
      windSpeedNight: '',
      humidity: '',
      precip: '',
      pressure: '',
      vis: '',
      cloud: '',
    }
  }

  public static createCityArrayFromResultSet(resultSet: relationalStore.ResultSet): City[] {
    let ret: City[] = [];
    Logger.info(TAG, "read set", resultSet.columnNames);
    resultSet.goToFirstRow();
    try {
      for (let _ = 0;_ < resultSet.rowCount; _++) {
        ret.push(DataUtils.createCityFromResultSet(resultSet));
        resultSet.goToNextRow();
      }
    } catch (e) {
      Logger.err(TAG, "error when parsing result set to City[] ", resultSet.rowIndex, e, resultSet);
    }
    return ret;
  }

  public static createCityFromResultSet(resultSet: relationalStore.ResultSet): City {
    try {
      let ret: City = {
        id: resultSet.getString(0),
        name: resultSet.getString(1),
        adm2: resultSet.getString(2),
        adm1: resultSet.getString(3),
        lat: resultSet.getString(4),
        lon: resultSet.getString(5),
        country: resultSet.getString(6),
        tz: resultSet.getString(7),
        utcOffset: resultSet.getString(8),
        isDst: resultSet.getString(9),
        type: resultSet.getString(10),
        rank: resultSet.getString(11),
        fxLink: resultSet.getString(12)
      };
      return ret;
    } catch (e) {
      Logger.err(TAG, "error when parsing result set to City ", resultSet.rowIndex, e, resultSet);
      return DataUtils.emptyCity();
    }
  }

  public static filterCity(src: City[], keyword: string, code?: string): City[] {
    return src.filter(city => (city.adm2.includes(keyword) || city.adm1.includes(keyword) || city.name.includes(keyword) || (code&&city.id.includes(code))))
  }

  public static emptyWeatherRealTime(): WeatherRealTime {
    return {
      obsTime: '',
      temp: '',
      feelsLike: '',
      icon: '',
      text: '',
      wind360: '',
      windDir: '',
      windSpeed: '',
      humidity: '',
      precip: '',
      pressure: '',
      vis: '',
      cloud: '',
      dew: ''
    };
  }

  public static getCitySearchIdentity(src: City): string {
    if (src.id != '') return src.id;
    return `${src.lat},${src.lon}`;
  }

  public static emptyCacheBundle(): CacheBundle {
    return {
      warnings: [],
      daily: [],
      hourly: [],
      realtime: DataUtils.emptyWeatherRealTime()
    }
  }
}