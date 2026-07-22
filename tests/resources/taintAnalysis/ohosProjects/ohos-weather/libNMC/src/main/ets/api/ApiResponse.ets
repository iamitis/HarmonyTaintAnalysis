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
export interface Province {
  code: string;
  name: string;
  url: string;
}

export interface Station {
  code: string;
  province: string;
  city: string;
  url: string;
}

export interface WeatherBundle {
  msg: string;
  code: number;
  data: WeatherData;
}

export interface WeatherData {
  real: WeatherRealTimeData;
  predict: WeatherPredictData;
  air: AirConditionData;
  tempchart: TempChartData[];
  passedchart: PassedChartData[];
  climate: IClimate,
  radar: IRadar
}

export interface IRadar{
  title: string;
  image: string;
  url: string;
}

export interface IClimate {
  time: string;
  month: ClimateMonthDataUnit[]
}

export interface WeatherRealTimeData {
  station: Station;
  _publish_time: string;
  weather: IRealtimeWeatherData,
  wind: IRealtimeWindData,
  warn: IWeatherWarning
}

export interface IRealtimeWeatherData{
  temperature: number;
  temperatureDiff: number;
  airPressure: number;
  humidity: number;
  rain: number;
  rComfort: number;
  iComfort: number;
  info: string;
  img: string;
  fellST: string;
}

export interface IRealtimeWindData {
  direct: string;
  degree: number;
  power: string;
  speed: number;
}

export interface IWeatherWarning{
  alert: string;
  pic: string;
  province: string;
  city: string;
  url: string;
  issueContent: string;
  fMeans: string;
  signalType: string;
  signalLevel: string;
  pic2: string;
}

export interface WeatherPredictData {
  station: Station,
  _publish_time: string;
  detail: PredictDetailData[];
}

export interface PredictDetailData {
  date: string;
  pt: string;
  day: IDayNightInfo,
  night: IDayNightInfo
}

export interface IDayNightInfo {
  weather: IWeatherInfo,
  wind: IWindInfo
}

export interface IWeatherInfo {
  info: string;
  img: string;
  temperature: string;
}

export interface IWindInfo {
  direct: string;
  power: string;
}

export interface AirConditionData {
  forecastTime: string;
  aqi: number;
  aq: number;
  text: string;
  aqiCode: string;
}

export interface TempChartData {
  time: string;
  max_temp: number;
  min_temp: number;
  day_img: string;
  day_text: string;
  night_img: string;
  night_text: string;
}

export interface PassedChartData {
  rain1h: number;
  rain24h: number;
  rain12h: number;
  rain6h: number;
  temperature: number;
  tempDiff: string;
  humidity: number;
  pressure: number;
  windDirection: number;
  windSpeed: number;
  time: string;
}

export interface ClimateMonthDataUnit {
  month: number;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
}