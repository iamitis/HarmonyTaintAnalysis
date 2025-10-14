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
import { ImportInfo } from '../../model/ArkImport';
import { ModelUtils } from '../../common/ModelUtils';
import { ArkMethod } from '../../model/ArkMethod';
import { FileSignature, MethodSignature } from '../../model/ArkSignature';
import { InferenceBuilder } from '../InferenceBuilder';
import { InferLanguage } from '../Inference';
import { SdkUtils } from '../../common/SdkUtils';


class AbcImportInference extends ImportInfoInference {
    /**
     * get arkFile and assign to from file
     * @param fromInfo
     */
    public preInfer(fromInfo: ImportInfo): void {
        const from = fromInfo.getFrom();
        if (!from) {
            return;
        }
        let file;
        if (/^([^@]*\/)([^\/]*)$/.test(from)) {
            const scene = fromInfo.getDeclaringArkFile().getScene();
            file = scene.getFile(new FileSignature(fromInfo.getDeclaringArkFile().getProjectName(), from));
        } else {
            //sdk path
            file = SdkUtils.getImportSdkFile(from);
        }
        if (file) {
            this.fromFile = file;
        }
    }
}


class AbcMethodInference extends MethodInference {

    public preInfer(arkMethod: ArkMethod): void {

        const implSignature = arkMethod.getImplementationSignature();
        if (implSignature) {
            this.inferArkUIComponentLifeCycleMethod(arkMethod, implSignature);
        }
    }

    private inferArkUIComponentLifeCycleMethod(arkMethod: ArkMethod, impl: MethodSignature): void {
        const arkClass = arkMethod.getDeclaringArkClass();
        const scene = arkClass.getDeclaringArkFile().getScene();
        const classes = arkClass
            .getAllHeritageClasses()
            .filter(cls => scene.getProjectSdkMap().has(cls.getSignature().getDeclaringFileSignature().getProjectName()));
        for (const sdkClass of classes) {
            // findPropertyInClass function will check all super classes recursely to find the method
            const sdkMethod = ModelUtils.findPropertyInClass(arkMethod.getName(), sdkClass);
            if (!sdkMethod || !(sdkMethod instanceof ArkMethod)) {
                continue;
            }
            const sdkDeclareSigs = sdkMethod.getDeclareSignatures();
            // It is difficult to get the exactly declare signature when there are more than 1 declare signatures.
            // So currently only match the SDK with no override.
            if (!sdkDeclareSigs || sdkDeclareSigs.length !== 1) {
                continue;
            }
            const params = impl.getMethodSubSignature().getParameters();
            const sdkMethodSig = sdkDeclareSigs[0];
            const sdkParams = sdkMethodSig.getMethodSubSignature().getParameters();
            params.forEach((param, index) => {
                if (index < sdkParams.length) {
                    param.setType(sdkParams[index].getType());
                }
            });
            impl.getMethodSubSignature().setReturnType(sdkMethodSig.getMethodSubSignature().getReturnType());
            return;
        }
    }
}


export class AbcInferenceBuilder extends InferenceBuilder {

    constructor() {
        super();
    }

    public buildFileInference(): FileInference {
        if (!this.fileInference) {
            this.fileInference = new FileInference(this.buildImportInfoInference(), this.buildClassInference());
        }
        return this.fileInference;
    }

    public buildImportInfoInference(): ImportInfoInference {
        if (!this.importInfoInference) {
            this.importInfoInference = new AbcImportInference();
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
            this.methodInference = new AbcMethodInference(this.buildStmtInference());
        }
        return this.methodInference;
    }

    public buildStmtInference(): StmtInference {
        if (!this.stmtInference) {
            const valueInferences = this.getValueInferences(InferLanguage.COMMON);
            this.stmtInference = new StmtInference(valueInferences);
        }
        return this.stmtInference;
    }
}
