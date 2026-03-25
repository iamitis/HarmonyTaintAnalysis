import { Stmt } from "../../core/base/Stmt";
import { SinkDefinition, SourceDefinition } from "./SourceSinkDefinition";

export interface SourceSinkManager {
    getSources(): SourceDefinition[];
    getSinks(): SinkDefinition[];

    /**
     * 判断 stmt 是否是源
     */
    getSourceIfIs(stmt: Stmt): SourceDefinition | undefined;

    /**
     * 判断 stmt 是否是汇
     */
    getSinkIfIs(stmt: Stmt): SinkDefinition | undefined;
}
