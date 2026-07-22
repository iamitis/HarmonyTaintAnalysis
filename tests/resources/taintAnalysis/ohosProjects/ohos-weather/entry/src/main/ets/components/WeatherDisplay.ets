// This file is part of ohos-weather.
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
import {
  ApiEndpoint,
  ApiManager,
  City,
  DataUtils,
  LazyList,
  Logger,
  PreferenceManager,
  StringUtils,
  Warning,
  WeatherDaily,
  WeatherHourly,
  WeatherRealTime
} from '@ohos/nmc';
import { AppConstants } from '../constants/AppConstants';
import { StyleConstant } from '../constants/StyleConstant';

let TAG = "WeatherDisplay"

@Component
export struct WeatherDisplay {
  city: City = DataUtils.emptyCity();
  warnings: LazyList<Warning> = new LazyList([]);
  dailyWeather: WeatherDaily[] = [];
  realTimeWeather: WeatherRealTime = DataUtils.emptyWeatherRealTime();
  hourlyWeather: WeatherHourly[] = [];

  build() {
    Scroll() {
      Column({ space: 13 }) {
        WeatherOverview({
          dailyWeather: this.dailyWeather,
          city: this.city,
          realTimeWeather: this.realTimeWeather
        })
          .margin({ bottom: 32 })
        WarningSwiper({
          warnings: this.warnings
        })
        HourlyView({
          hourlyWeather: this.hourlyWeather
        })
        RecentForecast({
          dailyWeather: this.dailyWeather
        })
      }
      .padding({ top: 17, right: 17, left: 17, bottom: 17 + StyleConstant.BOTTOM_BAR_HEIGHT })
    }
    .width('100%')
    .edgeEffect(EdgeEffect.Spring)
    .scrollBar(BarState.Off)
  }
}

@Component
export struct WeatherOverview {
  dailyWeather: WeatherDaily[] = [DataUtils.emptyWeatherDaily()];
  city: City = DataUtils.emptyCity();
  realTimeWeather: WeatherRealTime = DataUtils.emptyWeatherRealTime();

  build() {
    Column({ space: 3 }) {
      Text(this.city.isCurrentLocation ? $r('app.string.weather_page_my_position') : this.city.name)
        .fontSize(31)
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
      if (this.city.isCurrentLocation) {
        Text(this.city.name)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
      }
      if (this.realTimeWeather) {
        Text(`${this.realTimeWeather.temp}°`)
          .fontSize(StyleConstant.TEMP_FONT_SIZE)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .margin(StyleConstant.TEMP_FONT_MARGIN)
          .fontWeight(FontWeight.Bold)
        Text(this.realTimeWeather.text)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
      }
      if (this.dailyWeather) {
        Text() {
          Span($r('app.string.maximum_temp'))
          Span(`${this.dailyWeather[0].tempMax}° `)
          Span($r('app.string.minimum_temp'))
          Span(`${this.dailyWeather[0].tempMin}°`)
        }
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
      }
    }
    .padding({ top: 32 })
  }
}

@Component
export struct WarningSwiper {
  warnings: LazyList<Warning> = new LazyList([]);
  private swiperController: SwiperController = new SwiperController();

  build() {
    if (this.warnings) {
      if (this.warnings.totalCount() > 0) {
        Swiper(this.swiperController) {
          LazyForEach(this.warnings, (warning: Warning) => {
            Row({ space: 7 }) {
              Column({ space: 7 }) {
                Row({ space: 7 }) {
                  Image($r('app.media.ic_public_warning'))
                    .size({ width: 17, height: 17 })
                  Text(warning.typeName)
                    .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                    .width('100%')
                    .fontWeight(FontWeight.Medium)
                }

                Text(warning.title)
                  .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                  .fontSize(StyleConstant.WIDGET_FONT_SIZE)
                  .width('100%')
                Text(warning.text)
                  .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                  .fontSize(StyleConstant.WIDGET_FONT_SIZE)
                  .width('100%')
              }

              Image(ApiEndpoint.Q_Weather_Image(warning.type))
                .size({ width: 47, height: 47 })
            }
            .justifyContent(FlexAlign.SpaceBetween)
            .width('100%')
          })
        }
        .autoPlay(true)
        .interval(6000)
        .itemSpace(17)
        .indicator(false)
        .indicatorStyle({
          selectedColor: Color.White,
          top: 0,
          right: 0
        })
        .width('100%')
        .backgroundColor($r('app.color.widget_background'))
        .borderRadius(StyleConstant.DEFAULT_RADIUS)
        .padding(15)
      }
    }
  }
}

@Component
export struct HourlyView {
  hourlyWeather: WeatherHourly[] = [];

  build() {
    Column({ space: 7 }) {
      Text($r('app.string.report_hourly'))
        .fontColor($r('app.color.widget_title'))
        .fontSize(StyleConstant.WIDGET_FONT_SIZE)
        .width('100%')
      if (this.hourlyWeather) {
        List({ space: 27 }) {
          ForEach(this.hourlyWeather, (weather: WeatherHourly, index: number) => {
            ListItem() {
              Column({ space: 7 }) {
                Text() {
                  if (index == 0) {
                    Span($r('app.string.now'))
                  } else {
                    Span(`${new Date(weather.fxTime).getHours()}`)
                    Span($r('app.string.hour'))
                  }
                }
                .fontColor(StyleConstant.DEFAULT_FONT_COLOR)

                Image(ApiEndpoint.Q_Weather_Image(weather.icon))
                  .width(24)
                  .height(24)
                Text(`${weather.temp}°`)
                  .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
              }
            }
          })
        }
        .listDirection(Axis.Horizontal)
        .scrollBar(BarState.Off)
        .fadingEdge(true)
      }
    }
    .width('100%')
    .backgroundColor($r('app.color.widget_background'))
    .backdropBlur(24)
    .borderRadius(12)
    .padding(15)
  }
}

@Component
export struct RecentForecast {
  @State forecastDay: number = 0;
  dailyWeather: WeatherDaily[] = [DataUtils.emptyWeatherDaily()];

  aboutToAppear() {
    PreferenceManager.getInstance().getDailyRequestDayNum()
      .then(num => {
        this.forecastDay = num;
      })
  }

  build() {
    Column() {
      Text() {
        Span(`${this.forecastDay}`)
        Span($r('app.string.report_daily'))
      }
      .fontColor($r('app.color.widget_title'))
      .fontSize(StyleConstant.WIDGET_FONT_SIZE)
      .width('100%')

      ForEach(this.dailyWeather, (weather: WeatherDaily) => {
        ForecastDailyWeather({ weather: weather })
      })
    }
    .width('100%')
    .backgroundColor($r('app.color.widget_background'))
    .backdropBlur(24)
    .borderRadius(12)
    .padding(15)
  }
}

@Component
export struct ForecastDailyWeather {
  weather?: WeatherDaily

  build() {
    if(this.weather)
    Column() {
      Divider()
        .backgroundColor(StyleConstant.DIVIDER_COLOR)
        .margin({ bottom: 13 })
      GridRow({ columns: 4 }) {
        GridCol() {
          Text(AppConstants.WeekString[StringUtils.getDaysOfWeek(new Date(this.weather.fxDate))])
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        }

        GridCol() {
          Image(ApiEndpoint.Q_Weather_Image(this.weather.iconDay))
            .height(24)
            .width(24)
        }

        GridCol() {
          Text(`${this.weather.tempMin}°`)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        }

        GridCol() {
          Text(`${this.weather.tempMax}°`)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        }
      }
      .width('100%')
    }
    .width('100%')
    .padding(13)
  }
}