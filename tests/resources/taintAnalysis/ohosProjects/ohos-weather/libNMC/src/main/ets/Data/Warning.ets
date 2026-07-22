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
import { ArrayList } from "@kit.ArkTS";

// along with this program.  If not, see <https://www.gnu.org/licenses/>.
export interface Warning {
  id: string,
  sender: string,
  pubTime: string,
  title: string,
  startTime: string,
  endTime: string,
  status: string,
  level: string,
  severity: string,
  severityColor: string,
  type: string;
  typeName: string,
  urgency: string,
  certainty: string,
  text: string,
  related: string
}

export class LazyList<T> implements IDataSource {
  private list: T[] = [];
  private listener: ArrayList<DataChangeListener> =new ArrayList();

  constructor(list: T[]) {
    this.list = list;
  }

  totalCount(): number {
    return this.list.length;
  }

  getData(index: number): T {
    return this.list[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    this.listener.add(listener);
  }

  unregisterDataChangeListener(listener:DataChangeListener) {
    this.listener.remove(listener);
  }
}