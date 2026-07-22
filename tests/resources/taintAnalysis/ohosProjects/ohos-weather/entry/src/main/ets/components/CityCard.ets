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
import { City, DataUtils, } from '@ohos/nmc'
import { StyleConstant } from '../constants/StyleConstant';

let TAG = "CityCard";

@Component
export struct CityCard {
  private city: City = DataUtils.emptyCity();

  build() {
    Column() {
      Text(this.city.name)
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .fontSize(24)
        .width('100%')
      Row() {
        Row({ space: 7 }) {
          Text(`${this.city.country}`)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
            .fontSize(StyleConstant.WIDGET_FONT_SIZE)
          Text(this.city.utcOffset)
            .fontSize(StyleConstant.WIDGET_FONT_SIZE)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
            .fontWeight(FontWeight.Lighter)
        }

        Text(`${this.city.adm1} ${this.city.adm2}`)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .fontSize(StyleConstant.WIDGET_FONT_SIZE)
      }
      .width('100%')
      .justifyContent(FlexAlign.SpaceBetween)
    }
    .backgroundColor("#ff303030")
    .justifyContent(FlexAlign.SpaceBetween)
    .height(80)
    .width('100%')
    .padding(13)
    .borderRadius(StyleConstant.DEFAULT_RADIUS)
  }
}