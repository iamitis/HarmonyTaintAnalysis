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
import router from '@ohos.router'
import { StyleConstant } from '../constants/StyleConstant'
import { ImmersiveUtils, ManagerConstants, PreferenceManager } from '@ohos/nmc';

@Entry
@Component
struct SettingPage {
  @State requestDay: number = 0;
  @State requestHour: number = 0;
  @State lastRequestTime: number = 0;
  @State cacheValidTime: number = 0;

  onPageShow() {
    ImmersiveUtils.immersive(globalThis.windowStage, StyleConstant.IMMERSIVE_CONFIG.ABOUT)
  }

  aboutToAppear() {
    this.refreshSetting();
  }

  refreshSetting() {
    PreferenceManager.getInstance().getDailyRequestDayNum()
      .then(r => {
        ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_SET.forEach((v, i) => {
          if (r == v) this.requestDay = i;
        })
      })
    PreferenceManager.getInstance().getHourlyRequestHourNum()
      .then(r => {
        ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_SET.forEach((v, i) => {
          if (r == v) this.requestHour = i;
        })
      })
    PreferenceManager.getInstance().getLastRequestTime()
      .then(r => {
        ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_SET.forEach((v, i) => {
          if (r == v) this.lastRequestTime = i;
        })
      })
    PreferenceManager.getInstance().getCacheValidTime()
      .then(r => {
        ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_SET.forEach((v, i) => {
          if (r == v) this.cacheValidTime = i;
        })
      })
  }

  @Builder
  SettingItem(title: ResourceStr, callback: () => void, value?: string) {
    Button({ type: ButtonType.Normal }) {
      Row() {
        Text(title)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .fontSize(StyleConstant.DEFAULT_FONT_SIZE)
        Row({ space: 13 }) {
          if (value) {
            Text(value)
              .fontSize(StyleConstant.DEFAULT_FONT_SIZE)
              .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          }
          Image($r('app.media.ic_public_arrow_right'))
            .size({ width: 24, height: 24 })
        }
      }
      .padding(17)
      .height(64)
      .width('100%')
      .justifyContent(FlexAlign.SpaceBetween)
    }
    .onClick(callback)
    .borderRadius(StyleConstant.DEFAULT_RADIUS)
    .backgroundColor(StyleConstant.EDIT_MENU_BACKGROUND)
    .width('100%')
  }

  build() {
    Column({ space: 17 }) {
      Row({ space: 17 }) {
        Button({ type: ButtonType.Normal }) {
          Image($r('app.media.ic_public_back'))
            .size({ width: 24, height: 24 })
        }
        .borderRadius(7)
        .width(36)
        .height(36)
        .backgroundColor(Color.Transparent)
        .onClick(() => {
          router.back();
        })

        Text() {
          Span($r('app.string.page_title_setting'))
        }
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .fontSize(StyleConstant.PAGE_TITLE_FONT_SIZE_SECONDARY)
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)

      this.SettingItem($r('app.string.setting_request_day'), () => {
        TextPickerDialog.show({
          range: ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_DISPLAY,
          onAccept: (v) => {
            if(!Array.isArray(v.index))
            PreferenceManager.getInstance()
              .setDailyRequestDayNum(ManagerConstants.SETTING_KEY.REQUEST_DAY_NUM.RANGE_SET[v.index])
          },
          selected: this.requestDay
        })
      })
      this.SettingItem($r('app.string.setting_request_hour_count'), () => {
        TextPickerDialog.show({
          range: ManagerConstants.SETTING_KEY.REQUEST_HOUR_NUM.RANGE_DISPLAY,
          onAccept: (v) => {
            if(!Array.isArray(v.index))
            PreferenceManager.getInstance()
              .setHourlyRequestHourNum(ManagerConstants.SETTING_KEY.REQUEST_HOUR_NUM.RANGE_SET[v.index])
          },
          selected: this.requestHour
        })
      })
      this.SettingItem($r('app.string.setting_last_request'), () => {
        AlertDialog.show({
          title: "归零",
          message: `确定要将上次刷新时间归零吗?`,
          confirm: {
            value: "确认",
            action: () => {
              PreferenceManager.getInstance().setLastRequestTime(0);
            },
            fontColor: Color.Red
          },
          cancel: () => {
            return
          }
        })
      })
      this.SettingItem($r('app.string.setting_cache_valid_time'), () => {
        TextPickerDialog.show({
          range: ManagerConstants.SETTING_KEY.CACHE_VALID_TIME.RANGE_DISPLAY,
          onAccept: (v) => {
            if(!Array.isArray(v.index))
            PreferenceManager.getInstance()
              .setHourlyRequestHourNum(ManagerConstants.SETTING_KEY.CACHE_VALID_TIME.RANGE_SET[v.index])
          },
          selected: this.cacheValidTime
        })
      })
      this.SettingItem($r('app.string.page_title_api_key_setting'), () => {
        router.pushUrl({ url: 'pages/ApiKeySettingPage' })
      })
    }
    .width('100%')
    .height('100%')
    .padding(StyleConstant.ABOUT_PAGE_PADDING)
    .backgroundColor(StyleConstant.DEFAULT_PAGE_BACKGROUND_COLOR)
  }
}