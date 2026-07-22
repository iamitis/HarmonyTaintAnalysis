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
export class Logger {
  public static info(TAG: string, ...args: any[]): void {
    this.logBase(TAG, console.info, args);
  }

  public static warn(TAG: string, ...args: any[]): void {
    this.logBase(TAG, console.warn, args);
  }

  public static log(TAG: string, ...args: any[]): void {
    this.logBase(TAG, console.log, args);
  }

  public static err(TAG: string, ...args: any[]): void {
    this.logBase(TAG, console.error, args);
  }

  private static logBase(TAG: string, logger: Function = console.log, args: any[] = []): void {
    logger("NMC_LOGGER", TAG, this.normalizeArgs(args));
  }

  private static normalizeArgs(args: any[]): string {
    let ret: string[] = [];
    for (let i = 0; i < args.length; i++) {
        typeof args[i] == 'string' ? ret.push(args[i]) : ret.push(JSON.stringify(args[i]));
    }
    return ret.join(" ");
  }
}