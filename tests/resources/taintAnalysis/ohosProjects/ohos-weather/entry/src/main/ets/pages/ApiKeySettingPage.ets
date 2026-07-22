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
import { ApiEndpoint, ApiManager, ImmersiveUtils, PreferenceManager } from '@ohos/nmc';
import promptAction from '@ohos.promptAction';
import { StyleConstant } from '../constants/StyleConstant'
import router from '@ohos.router';

@Entry
@Component
struct ApiKeySettingPage {
  @State isNotVerifying: boolean = true;
  @State apiKey: string = '';
  @State apiHost: string = '';

  onPageShow() {
    ImmersiveUtils.immersive(globalThis.windowStage, StyleConstant.IMMERSIVE_CONFIG.ABOUT)
  }

  build() {
    Column({ space: 13 }) {
      Text($r('app.string.page_title_api_key_setting'))
        .fontSize(StyleConstant.PAGE_TITLE_FONT_SIZE)
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .width('100%')

      TextInput({ placeholder: $r('app.string.api_host_input_placeholder') })
        .borderRadius(7)
        .height(35)
        .backgroundColor(StyleConstant.SEARCH_BACKGROUND)
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .placeholderColor(StyleConstant.DEFAULT_FONT_COLOR)
        .onChange(v => {
          this.apiHost = v;
        })
      TextInput({ placeholder: $r('app.string.api_key_input_placeholder') })
        .borderRadius(7)
        .height(35)
        .backgroundColor(StyleConstant.SEARCH_BACKGROUND)
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .placeholderColor(StyleConstant.DEFAULT_FONT_COLOR)
        .onChange(v => {
          this.apiKey = v;
        })

      Button({ type: ButtonType.Normal }) {
        if (!this.isNotVerifying) {
          LoadingProgress()
            .width(25)
            .height(25)
        } else {
          Text($r('app.string.api_key_verify'))
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        }
      }
      .enabled(this.isNotVerifying)
      .width('100%')
      .height(53)
      .borderRadius(17)
      .onClick(() => {
        this.isNotVerifying = false;
        PreferenceManager.getInstance().setApiHost(this.apiHost);
        ApiEndpoint.Init().then(()=>{
          ApiManager.getInstance().qVerifyApiKey(this.apiKey)
            .then(valid => {
              this.isNotVerifying = true;
              if (valid) {
                PreferenceManager.getInstance().setApiKey(this.apiKey);
                router.replaceUrl({ url: "pages/Index" })
              } else {
                promptAction.showToast({ message: "校验失败，请检查输入是否有误或请求量是否达到上限" })
              }
            })
        })
      })
    }
    .padding(StyleConstant.ABOUT_PAGE_PADDING)
    .height('100%')
    .backgroundColor(StyleConstant.DEFAULT_PAGE_BACKGROUND_COLOR)
  }
}