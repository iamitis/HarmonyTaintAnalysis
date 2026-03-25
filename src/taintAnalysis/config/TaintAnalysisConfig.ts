import { ArkMethod } from "../../core/model/ArkMethod";
import { IFDSConfig } from "./IFDSConfig";

export class TaintAnalysisConfig {
    /* 数据流分析相关配置 */
    ifdsConfig: IFDSConfig = new IFDSConfig();

    /* 待分析的项目类型 */
    projectType: TaintAnalysisProjectType = TaintAnalysisProjectType.Directory;

    /* source 和 sink 定义文件配置 */
    sourceAndSinkConfig: SourceAndSinkFileConfig = { definitionFilePath: "", definitionFileType: SourceAndSinkFileType.JSON };

    methodToBeAnalyzed?: ArkMethod;
}

export enum TaintAnalysisProjectType {
    OpenHarmony,
    Directory,
}

export interface SourceAndSinkFileConfig {
    definitionFilePath: string;
    /* source 和 sink 定义文件类型, 决定了如何解析定义文件 */
    definitionFileType: SourceAndSinkFileType;
}

export enum SourceAndSinkFileType {
    JSON
}

