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
import { StyleConstant } from '../constants/StyleConstant';
import { ImmersiveUtils } from '@ohos/nmc';

@Entry
@Component
struct AboutPage {
  onPageShow() {
    ImmersiveUtils.immersive(globalThis.windowStage, StyleConstant.IMMERSIVE_CONFIG.ABOUT)
  }

  @Builder
  AboutItem(icon: Resource, title: ResourceStr, content: ResourceStr, onclick?: () => void) {
    Row() {
      Row({ space: 13 }) {
        Image(icon)
          .size({ width: 24, height: 24 })
        Column() {
          Text(title)
            .fontSize(StyleConstant.DEFAULT_FONT_SIZE)
            .fontWeight(FontWeight.Regular)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          Text(content)
            .fontSize(StyleConstant.WIDGET_FONT_SIZE)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        }
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.SpaceBetween)
      }

      if (onclick) {
        Image($r('app.media.ic_public_arrow_right'))
          .size({ width: 24, height: 24 })
      }
    }
    .onClick(() => {
      if (onclick) onclick();
    })
    .width('100%')
    .justifyContent(FlexAlign.SpaceBetween)
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
          Span($r('app.string.about'))
        }
        .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
        .fontSize(StyleConstant.PAGE_TITLE_FONT_SIZE_SECONDARY)
      }
      .width('100%')
      .justifyContent(FlexAlign.Start)

      Column({ space: 13 }) {
        Image($r('app.media.icon'))
          .size({ width: 64, height: 64 })
        Text($r('app.string.EntryAbility_label'))
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .fontSize(StyleConstant.DEFAULT_FONT_SIZE)
        Text($r('app.string.EntryAbility_desc'))
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .fontSize(StyleConstant.DEFAULT_FONT_SIZE)
      }

      Column({ space: 13 }) {
        this.AboutItem($r('app.media.icon'), "应用作者", "梨猫先生(Ericple)")
        Divider()
          .backgroundColor(StyleConstant.DEFAULT_FONT_COLOR)
        this.AboutItem($r('app.media.ic_public_gitee'), "Gitee", "https://gitee.com/ericple")
        Divider()
          .backgroundColor(StyleConstant.DEFAULT_FONT_COLOR)
        this.AboutItem($r('app.media.ic_public_atom'), "AtomGit", "https://atomgit.com/ericple")
      }
      .borderRadius(StyleConstant.DEFAULT_RADIUS)
      .padding(17)
      .backgroundColor(StyleConstant.EDIT_MENU_BACKGROUND)
    }
    .padding(StyleConstant.ABOUT_PAGE_PADDING)
    .width('100%')
    .height('100%')
    .backgroundColor(StyleConstant.DEFAULT_PAGE_BACKGROUND_COLOR)
  }
}