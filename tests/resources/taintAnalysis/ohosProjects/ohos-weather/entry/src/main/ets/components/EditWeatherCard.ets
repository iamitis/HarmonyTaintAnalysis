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
import { City, DataUtils, LazyList, Warning, WeatherDaily, WeatherRealTime } from '@ohos/nmc';
import { StyleConstant } from '../constants/StyleConstant';

@Component
export struct EditWeatherCard {
  // @StorageProp('storedCities') cities: City[] = [];
  // @StorageProp('storedWarnings') warnings: LazyList<Warning>[] = [];
  // @StorageProp('storedDailyWeather') dailyWeather: WeatherDaily[][] = [];
  @State cardHeight: number = 100;
  // @StorageProp('storedRealTimeWeather') realTimeWeather: WeatherRealTime[] = [];
  private city: City = DataUtils.emptyCity();
  private warnings: LazyList<Warning> = new LazyList([]);
  private dailyWeather: WeatherDaily[] = [];
  private realTimeWeather: WeatherRealTime = DataUtils.emptyWeatherRealTime();

  build() {
    Row() {
      if (this.city) {
        // Left side info
        Column() {
          Column() {
            Text(this.city.isCurrentLocation ? $r('app.string.weather_page_my_position') : this.city.name)
              .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
              .fontSize(24)

            Text(this.city.isCurrentLocation ? this.city.name : this.city.adm1)
              .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
              .fontSize(StyleConstant.WIDGET_FONT_SIZE)
          }
          .alignItems(HorizontalAlign.Start)
          // Status and warning info
          Column({ space: 7 }) {
            if (this.warnings) {
              if (this.warnings.totalCount() > 0) {
                Image($r('app.media.ic_public_warning'))
                  .size({ width: 17, height: 17 })
                Text(`${this.warnings.getData(0)
                  .typeName}${this.warnings.totalCount() > 1 ? `及其它${this.warnings.totalCount() - 1}则预警` : ''}`)
                  .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                  .fontSize(StyleConstant.WIDGET_FONT_SIZE)
              } else {
                Text(this.realTimeWeather.text)
                  .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                  .fontSize(StyleConstant.WIDGET_FONT_SIZE)
              }
            } else {
              Text(this.realTimeWeather.text)
                .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
                .fontSize(StyleConstant.WIDGET_FONT_SIZE)
            }
          }
          .alignItems(HorizontalAlign.Start)
        }
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.SpaceBetween)
        .height('100%')

        // Right side info
        Column() {
          // Temperature
          if (this.realTimeWeather) {
            Text(`${this.realTimeWeather.temp}°`)
              .fontSize(50)
              .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
              .fontWeight(FontWeight.Bold)
          }
          if (this.dailyWeather) {
            Text() {
              Span($r('app.string.maximum_temp'))
              Span(`${this.dailyWeather[0].tempMax}° `)
              Span($r('app.string.minimum_temp'))
              Span(`${this.dailyWeather[0].tempMin}°`)
            }
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
            .fontSize(StyleConstant.WIDGET_FONT_SIZE)
          }
        }
        .alignItems(HorizontalAlign.End)
        .justifyContent(FlexAlign.SpaceBetween)
        .height('100%')
      }
    }
    .backgroundColor("#ff303030")
    .justifyContent(FlexAlign.SpaceBetween)
    .height(100)
    .width('100%')
    .padding(13)
    .borderRadius(17)
  }
}