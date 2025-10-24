/*
 * Copyright (c) 2024-2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { ClassInference, FileInference, ImportInfoInference, MethodInference, StmtInference } from './ModelInference';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { ValueInference } from './ValueInference';

const valueCtors: Map<Function, InferLanguage> = new Map<Function, InferLanguage>();
const logger = Logger.getLogger(LOG_MODULE_TYPE.ARKANALYZER, 'InferenceBuilder');

export enum InferLanguage {
    COMMON = 0,
    ARK_TS1_1 = 1,
    ARK_TS1_2 = 2,
    CXX = 21,
    ABC = 51
}

export function Bind(lang: InferLanguage = InferLanguage.COMMON) {
    return function <T extends { new(): ValueInference<any> }>(constructor: T) {
        valueCtors.set(constructor, lang);
        logger.info('the ValueInference %s registered.', constructor.name);
        return constructor;
    };
}

import('./ValueInference');

export class InferenceBuilder {

    protected fileInference: FileInference | undefined;
    protected importInfoInference: ImportInfoInference | undefined;
    protected classInference: ClassInference | undefined;
    protected methodInference: MethodInference | undefined;
    protected stmtInference: StmtInference | undefined;
    private valueInferences: Map<Function, ValueInference<any>>;

    constructor() {
        this.valueInferences = new Map();
    }

    public buildFileInference(): FileInference {
        if (!this.fileInference) {
            this.fileInference = new FileInference(this.buildImportInfoInference(), this.buildClassInference());
        }
        return this.fileInference;
    }

    public buildImportInfoInference(): ImportInfoInference {
        if (!this.importInfoInference) {
            this.importInfoInference = new ImportInfoInference();
        }
        return this.importInfoInference;
    }

    public buildClassInference(): ClassInference {
        if (!this.classInference) {
            this.classInference = new ClassInference(this.buildMethodInference());
        }
        return this.classInference;
    }

    public buildMethodInference(): MethodInference {
        if (!this.methodInference) {
            this.methodInference = new MethodInference(this.buildStmtInference());
        }
        return this.methodInference;
    }

    public buildStmtInference(): StmtInference {
        if (!this.stmtInference) {
            this.stmtInference = new StmtInference(this.getValueInferences(InferLanguage.COMMON));
        }
        return this.stmtInference;
    }

    public getValueInferences(lang: InferLanguage): ValueInference<any>[] {
        return Array.from(valueCtors.entries()).filter(entry => entry[1] === lang)
            .map(entry => {
                const valueCtor = entry[0] as any;
                let valueInference = this.valueInferences.get(valueCtor);
                if (!valueInference) {
                    valueInference = new valueCtor() as ValueInference<any>;
                    this.valueInferences.set(valueCtor, valueInference);
                }
                return valueInference;
            });
    }
}
