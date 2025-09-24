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

import { ClassInference, FileInference, ImportInfoInference, MethodInference, StmtInference } from '../ModelInference';
import { ArkFile } from '../../model/ArkFile';
import { IRInference } from '../../common/IRInference';
import { ImportInfo } from '../../model/ArkImport';
import { getArkFile } from '../../common/ModelUtils';
import { ArkClass } from '../../model/ArkClass';
import { TypeInference } from '../../common/TypeInference';
import { ArkMethod } from '../../model/ArkMethod';
import { MethodSignature } from '../../model/ArkSignature';
import { InferenceBuilder } from '../InferenceBuilder';
import { InferLanguage } from '../Inference';

class ArkTsFileInference extends FileInference {
    /**
     * infer export info
     * @param file
     */
    public postInfer(file: ArkFile): void {
        IRInference.inferExportInfos(file);
    }
}

class ArkTsImportInference extends ImportInfoInference {
    /**
     * get arkFile and assign to from file
     * @param fromInfo
     */
    public preInfer(fromInfo: ImportInfo): void {
        this.fromFile = getArkFile(fromInfo) || null;
    }
}

class ArkTsClassInference extends ClassInference {
    public preInfer(arkClass: ArkClass): void {
        TypeInference.inferGenericType(arkClass.getGenericsTypes(), arkClass);
        super.preInfer(arkClass);
    }

    public infer(arkClass: ArkClass): void {
        arkClass.getFields()
            .filter(p => TypeInference.isUnclearType(p.getType()))
            .forEach(f => {
                const newType = TypeInference.inferUnclearedType(f.getType(), arkClass);
                if (newType) {
                    f.getSignature().setType(newType);
                }
            })
        super.infer(arkClass);
    }
}

class ArkTsMethodInference extends MethodInference {

    public preInfer(arkMethod: ArkMethod): void {
        TypeInference.inferGenericType(arkMethod.getGenericTypes(), arkMethod.getDeclaringArkClass());
        arkMethod.getDeclareSignatures()?.forEach(x => this.inferMethodSignature(x, arkMethod));
        const implSignature = arkMethod.getImplementationSignature();
        if (implSignature) {
            this.inferMethodSignature(implSignature, arkMethod);
        }
    }

    private inferMethodSignature(ms: MethodSignature, arkMethod: ArkMethod) {
        ms.getMethodSubSignature().getParameters().forEach(p => TypeInference.inferParameterType(p, arkMethod));
        TypeInference.inferSignatureReturnType(ms, arkMethod);
    }
}


export class ArkTsInferenceBuilder extends InferenceBuilder {

    constructor() {
        super();
    }

    public buildFileInference(): FileInference {
        if (!this.fileInference) {
            this.fileInference = new ArkTsFileInference(this.buildImportInfoInference(), this.buildClassInference());
        }
        return this.fileInference;
    }

    public buildImportInfoInference(): ImportInfoInference {
        if (!this.importInfoInference) {
            this.importInfoInference = new ArkTsImportInference();
        }
        return this.importInfoInference;
    }

    public buildClassInference(): ClassInference {
        if (!this.classInference) {
            this.classInference = new ArkTsClassInference(this.buildMethodInference());
        }
        return this.classInference;
    }

    public buildMethodInference(): MethodInference {
        if (!this.methodInference) {
            this.methodInference = new ArkTsMethodInference(this.buildStmtInference());
        }
        return this.methodInference;
    }

    public buildStmtInference(): StmtInference {
        if (!this.stmtInference) {
            const valueInferences = this.getValueInferences(InferLanguage.COMMON);
            this.getValueInferences(InferLanguage.ARK_TS1_1).forEach(e => valueInferences.push(e));
            this.stmtInference = new StmtInference(valueInferences);
        }
        return this.stmtInference;
    }
}
