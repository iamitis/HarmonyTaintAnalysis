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
import geoLocationManager from '@ohos.geoLocationManager'

export const AppConstants = {
  GeoRequestInfo: {
    'priority': geoLocationManager.LocationRequestPriority?.FIRST_FIX,
    'scenario': geoLocationManager.LocationRequestScenario?.NAVIGATION,
    'timeInterval': 0,
    'distanceInterval': 0,
    'maxAccuracy': 0
  },
  WeekString: [$r('app.string.day_today'), $r('app.string.day_monday'), $r('app.string.day_tuesday'), $r('app.string.day_thursday'), $r('app.string.day_wednesday'), $r('app.string.day_friday'), $r('app.string.day_saturday'), $r('app.string.day_sunday')],
  UnitSettingString: [$r('app.string.setting_item_unit_metric'), $r('app.string.setting_item_unit_imperial')]
}