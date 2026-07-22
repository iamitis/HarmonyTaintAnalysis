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
  ApiManager,
  City,
  DataUtils,
  ImmersiveUtils,
  LazyList,
  Logger,
  ManagerConstants,
  PreferenceManager,
  RdbManager,
  Warning,
  WeatherDaily,
  WeatherHourly,
  WeatherRealTime
} from '@ohos/nmc';
import router from '@ohos.router';
import { EditWeatherCard } from '../components/EditWeatherCard';
import { StyleConstant } from '../constants/StyleConstant';
import { CityCard } from '../components/CityCard';

let TAG = "EditPage";

@Entry
@Component
struct EditPage {
  @StorageLink('storedCities') cities: City[] = [];
  @StorageLink('storedWarnings') warnings: LazyList<Warning>[] = [];
  @StorageLink('storedDailyWeather') dailyWeather: WeatherDaily[][] = [];
  @StorageLink('storedHourlyWeather') hourlyWeather: WeatherHourly[][] = [];
  @StorageLink('storedRealTimeWeather') realTimeWeather: WeatherRealTime[] = [];
  @State selectedUnit: number = 0;
  @State selectedLanguage: number = 0;
  @State selectedPoiType: number = 0;
  @State operationInProgress: boolean = false;
  @State searchResults: City[] = [];
  @State searching: boolean = false;
  @State hotCities: City[] = [];
  @State searchKeyword: string = "";
  @State pageOpacity: number = 1;

  onPageShow() {
    ImmersiveUtils.immersive(globalThis.windowStage, StyleConstant.IMMERSIVE_CONFIG.EDIT_PAGE)
  }

  addCity(city: City) {
    this.operationInProgress = true;
    this.cities.push(city);
    RdbManager.getInstance()
      .addCity(city)
      .then((): Promise<Warning[]> => {
        return ApiManager.getInstance().qGetWarning(DataUtils.getCitySearchIdentity(city));
      })
      .then(warnings => {
        this.warnings.push(new LazyList(warnings));
        return RdbManager.getInstance().setCache(DataUtils.getCitySearchIdentity(city), 'warnings', warnings)
          .then((): Promise<WeatherDaily[]> => {
            return ApiManager.getInstance().qGetWeatherDaily(DataUtils.getCitySearchIdentity(city));
          })
      })
      .then(dailyWeather => {
        this.dailyWeather.push(dailyWeather);
        return RdbManager.getInstance()
          .setCache(DataUtils.getCitySearchIdentity(city), 'daily', dailyWeather)
          .then((): Promise<WeatherHourly[]> => {
            // 获取每小时预报
            return ApiManager.getInstance().qGetWeatherHourly(DataUtils.getCitySearchIdentity(city));
          });
      })
      .then(hourlyWeather => {
        this.hourlyWeather.push(hourlyWeather);
        return RdbManager.getInstance()
          .setCache(DataUtils.getCitySearchIdentity(city), 'hourly', hourlyWeather)
          .then((): Promise<WeatherRealTime> => {
            // 获取实时天气
            return ApiManager.getInstance().qGetWeatherRealTime(DataUtils.getCitySearchIdentity(city));
          });
      })
      .then(realTimeWeather => {
        this.realTimeWeather.push(realTimeWeather);
        RdbManager.getInstance()
          .setCache(DataUtils.getCitySearchIdentity(city), 'realtime', realTimeWeather);
        this.operationInProgress = false;
        this.searching = false;
        this.searchKeyword = "";
      });
  }

  aboutToAppear() {
    PreferenceManager.getInstance().getUnit()
      .then(unit => {
        if (unit == 'i') this.selectedUnit = 1;
      });
    PreferenceManager.getInstance().getPoiType()
      .then(type => {
        this.selectedPoiType = type == 'scenic' ? 0 : type == 'CSTA' ? 1 : 2;
      })
    PreferenceManager.getInstance().getLanguage()
      .then(type => {
        ManagerConstants.SETTING_KEY.LANGUAGE.RANGE_SET.forEach((v, index) => {
          if (v == type) this.selectedLanguage = index;
        })
      })
    ApiManager.getInstance().qTopCity()
      .then(cities => {
        Logger.log(TAG, "find", cities.length, "hot cities")
        this.hotCities = cities;
      });
  }

  @Builder
  CityListSwiperEndAction(index: number) {
    Row() {
      if (index != 0) {
        Image($r('app.media.ic_public_delete'))
          .size({ width: 35, height: 35 })
          .margin(StyleConstant.SwiperActionComponentMargin)
          .onClick(() => {
            AlertDialog.show({
              title: "删除",
              message: `确定要删除城市 - ${this.cities[index].name}吗?`,
              confirm: {
                value: "确认删除",
                action: () => {
                  this.operationInProgress = true;
                  RdbManager.getInstance().removeCity(this.cities[index].id)
                    .then(() => {
                      this.operationInProgress = false;
                      this.cities.splice(index, 1);
                      // 同时需要对Index内作为迭代数组的数组进行处理
                      this.realTimeWeather.splice(index, 1);
                      this.warnings.splice(index, 1);
                      this.dailyWeather.splice(index, 1);
                      this.hourlyWeather.splice(index, 1);
                    })
                },
                fontColor: Color.Red
              },
              cancel: () => {
                return
              }
            })
          })
      }
    }
    .justifyContent(FlexAlign.End)
  }

  @Builder
  EditMenu() {
    Menu() {
      MenuItemGroup() {
        MenuItem({
          content: $r('app.string.page_title_setting'),
        })
          .onClick(() => {
            router.pushUrl({ url: 'pages/SettingPage' })
          })
        MenuItem({
          content: $r('app.string.setting_language')
        })
          .onClick(() => {
            TextPickerDialog.show({
              range: ManagerConstants.SETTING_KEY.LANGUAGE.RANGE_DISPLAY,
              selected: this.selectedLanguage,
              onAccept: (v) => {
                if(!Array.isArray(v.index)) {
                  PreferenceManager.getInstance().setLanguage(ManagerConstants.SETTING_KEY.LANGUAGE.RANGE_SET[v.index]);
                  this.selectedLanguage = v.index;
                }
              }
            });
          })
        MenuItem({
          content: $r('app.string.setting_unit')
        })
          .onClick(() => {
            TextPickerDialog.show({
              range: ManagerConstants.SETTING_KEY.UNIT.RANGE_DISPLAY,
              selected: this.selectedUnit,
              onAccept: (v) => {
                if(!Array.isArray(v.index)) {
                  PreferenceManager.getInstance().setUnit(ManagerConstants.SETTING_KEY.UNIT.RANGE_SET[v.index]);
                  this.selectedUnit = v.index;
                }
              }
            });
          })
        MenuItem({
          content: $r('app.string.setting_poi_type')
        })
          .onClick(() => {
            TextPickerDialog.show({
              range: ManagerConstants.SETTING_KEY.POI_TYPE.RANGE_DISPLAY,
              selected: this.selectedPoiType,
              onAccept: (v) => {
                if(!Array.isArray(v.index)) {
                  PreferenceManager.getInstance().setPoiType(ManagerConstants.SETTING_KEY.POI_TYPE.RANGE_SET[v.index]);
                  this.selectedPoiType = v.index;
                }
              }
            });
          })
      }

      MenuItem({
        content: $r('app.string.setting_about')
      })
        .onClick(() => {
          router.pushUrl({ url: "pages/AboutPage" })
        })
    }
  }

  build() {
    Stack() {
      Column({ space: 12 }) {
        // ToolBar
        Row() {
          Image($r('app.media.ic_public_more'))
            .size({ width: 24, height: 24 })
            .bindMenu(this.EditMenu)
        }
        .width('100%')
        .justifyContent(FlexAlign.End)
        // Page Title
        Text($r('app.string.EntryAbility_label'))
          .fontSize(StyleConstant.PAGE_TITLE_FONT_SIZE)
          .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
          .width('100%')

        if (this.searching) {
          List({ space: 12 }) {
            ForEach(this.searchKeyword == "" ? this.hotCities : this.searchResults, (city: City) => {
              ListItem() {
                CityCard({ city })
                  .onClick(() => {
                    this.addCity(city)
                  })
              }
            }, (city: City) => city.id)
          }
          .borderRadius(StyleConstant.DEFAULT_RADIUS)
          .padding(StyleConstant.EDIT_PAGE_LIST_PADDING)
          .chainAnimation(true)
          .edgeEffect(EdgeEffect.Spring,{alwaysEnabled:true})
          .scrollBar(BarState.Off)
          .height('100%')
        } else {
          List({ space: 12 }) {
            ForEach(this.cities, (city: City, index: number) => {
              ListItem() {
                EditWeatherCard({
                  city,
                  warnings: this.warnings[index],
                  dailyWeather: this.dailyWeather[index],
                  realTimeWeather: this.realTimeWeather[index]
                })
                  .onClick(() => {
                    router.back({ url: 'pages/Index', params: { 'weatherIndex': index } })
                  })
              }
              .swipeAction({
                end: this.CityListSwiperEndAction(index)
              })
            }, (city: City) => city.id)
          }
          .borderRadius(StyleConstant.DEFAULT_RADIUS)
          .padding(StyleConstant.EDIT_PAGE_LIST_PADDING)
          .chainAnimation(true)
          .edgeEffect(EdgeEffect.Spring,{alwaysEnabled:true})
          .scrollBar(BarState.Off)
          .height('100%')
        }
      }
      .onClick(() => {
        this.searching = false
        this.searchKeyword = "";
      })
      .height('100%')
      .padding(25)

      Column() {
        Stack() {
          TextInput({ placeholder: $r('app.string.search_weather_placeholder'), text: this.searchKeyword })
            .borderRadius(7)
            .height(35)
            .padding({ left: 35 })
            .backgroundColor(StyleConstant.SEARCH_BACKGROUND)
            .fontColor(StyleConstant.DEFAULT_FONT_COLOR)
            .placeholderColor(StyleConstant.DEFAULT_FONT_COLOR)
            .onClick(() => this.searching = true)
            .onChange(v => {
              this.searchKeyword = v;
              ApiManager.getInstance().qSearchGeoLocation(this.searchKeyword)
                .then(cities => {
                  this.searchResults = cities;
                })
            })
          Image($r('app.media.ic_public_search'))
            .size({ width: 24, height: 24 })
            .margin({ left: 7 })
        }
        .width('100%')
        .alignContent(Alignment.Start)
      }
      .padding(17)
      .width('100%')
      .height(StyleConstant.BOTTOM_BAR_HEIGHT)
      .linearGradient({
        angle: 180,
        colors: [
          ["#ff242424", 0],
          ["#ff2b2b2b", 1]
        ]
      })
      .border(StyleConstant.BOTTOM_BAR_BORDER)

      if (this.operationInProgress) {
        Row() {
          Column() {
            LoadingProgress()
              .width(35)
              .height(35)
          }
          .width('100%')
        }
        .height('100%')
      }
    }
    .alignContent(Alignment.Bottom)
    .opacity(this.pageOpacity)
    .padding(StyleConstant.EDIT_PAGE_PADDING)
    .backgroundColor(StyleConstant.DEFAULT_PAGE_BACKGROUND_COLOR)
  }
}