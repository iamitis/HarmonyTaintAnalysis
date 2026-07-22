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
import webview from '@ohos.web.webview';
import { ImmersiveUtils } from '@ohos/nmc';
import { StyleConstant } from '../constants/StyleConstant';

@Entry
@Component
struct WeatherMapPage {
  controller = new webview.WebviewController();

  onPageShow() {
    ImmersiveUtils.immersive(globalThis.windowStage, StyleConstant.IMMERSIVE_CONFIG.WEATHER_MAP)
  }

  build() {
    Column() {
      Web({ src: "https://www.windy.com/", controller: this.controller })
    }
    .width('100%')
    .height('100%')
  }
}