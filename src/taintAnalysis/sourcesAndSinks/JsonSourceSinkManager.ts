import fs from 'fs';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { SourceSinkManager } from './SourceSinkManager';
import { Stmt } from '../../core/base/Stmt';
import { SinkDefinition, SourceDefinition } from './SourceSinkDefinition';
import { MethodSinkDefinition, MethodSourceDefinition } from './matchers/MethodMatcher';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'JsonSourceSinkManager');

/**
 * JSON 定义文件中方法签名的通用格式
 */
export interface MethodDefinitionJson {
    type?: 'METHOD';
    methodSigString: string;
    paramIndices?: number[];
}

/**
 * 基于 JSON 配置的 SourceSink 管理器
 * 支持从 JSON 文件加载 Method 和 Field 形式的 source/sink 定义
 */
export class JsonSourceSinkManager implements SourceSinkManager {
    private sources: SourceDefinition[] = [];
    private sinks: SinkDefinition[] = [];
    private sourceSinkJsonPath: string = '';

    public addSource(source: SourceDefinition): void {
        this.sources.push(source);
    }

    public addSink(sink: SinkDefinition): void {
        this.sinks.push(sink);
    }

    /**
     * @override
     */
    public getSources(): SourceDefinition[] {
        return this.sources;
    }

    /**
     * @override
     */
    public getSinks(): SinkDefinition[] {
        return this.sinks;
    }

    /**
     * 判断 stmt 是否是 source
     * 使用统一的 matches 方法进行匹配，支持 Method 和 Field 等多种形式
     * @param stmt 要检查的语句
     * @returns 如果是 source 返回对应的 SourceDefinition，否则返回 undefined
     * @override
     */
    public getSourceIfIs(stmt: Stmt): SourceDefinition | undefined {
        return this.sources.find(source => source.matches(stmt));
    }

    /**
     * 判断 stmt 是否是 sink
     * 使用统一的 matches 方法进行匹配，支持 Method 和 Field 等多种形式
     * @param stmt 要检查的语句
     * @returns 如果是 sink 返回对应的 SinkDefinition，否则返回 undefined
     * @override
     */
    public getSinkIfIs(stmt: Stmt): SinkDefinition | undefined {
        return this.sinks.find(sink => sink.matches(stmt));
    }

    /**
     * 获取配置文件路径
     */
    public getSourceSinkJsonPath(): string {
        return this.sourceSinkJsonPath;
    }

    /**
     * 设置配置文件路径
     */
    public setSourceSinkJsonPath(path: string): void {
        this.sourceSinkJsonPath = path;
    }

    /**
     * 从 JSON 定义文件加载 source、sink 配置
     * 支持加载 Method 和 Field 两种形式的定义
     * @param filePath JSON 定义文件的路径
     */
    public loadFromFile(filePath: string): void {
        this.sourceSinkJsonPath = filePath;

        if (!fs.existsSync(filePath)) {
            logger.error(`Taint definition file not found: ${filePath}`);
            return;
        }

        let fileContent: string;
        try {
            fileContent = fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            logger.error(`Failed to read taint definition file: ${error}`);
            return;
        }

        let json: any;
        try {
            json = JSON.parse(fileContent) as any;
        } catch (error) {
            logger.error(`Failed to parse taint definition file: ${error}`);
            return;
        }

        let srcCnt = 0;
        let sinkCnt = 0;

        if (json.sources) {
            for (const sourceJson of json.sources) {
                const source = this.createSourceFromJson(sourceJson);
                if (source) {
                    this.addSource(source);
                    srcCnt++;
                }
            }
        }

        if (json.sinks) {
            for (const sinkJson of json.sinks) {
                const sink = this.createSinkFromJson(sinkJson);
                if (sink) {
                    this.addSink(sink);
                    sinkCnt++;
                }
            }
        }

        logger.info(`Loaded taint definitions from ${filePath}: ` +
            `${srcCnt} sources, ${sinkCnt} sinks`);
    }

    /**
     * 从 JSON 格式创建 SourceDefinition
     * @param json Source 配置的 JSON 对象
     * @returns SourceDefinition 实例
     */
    public createSourceFromJson(json: any): SourceDefinition | undefined {
        if (this.isMethodDefinitionJSON(json)) {
            return this.createMethodSourceFromJson(json as MethodDefinitionJson);
        } else {
            logger.error(`Failed to create SourceDefinition from JSON: ${JSON.stringify(json)}`);
        }
    }

    /**
     * 从 JSON 格式创建 SinkDefinition
     * @param json Sink 配置的 JSON 对象
     * @returns SinkDefinition 实例
     */
    public createSinkFromJson(json: any): SinkDefinition | undefined {
        if (this.isMethodDefinitionJSON(json)) {
            return this.createMethodSinkFromJson(json as MethodDefinitionJson);
        } else {
            logger.error(`Failed to create SinkDefinition from JSON: ${JSON.stringify(json)}`);
        }
    }

    /**
     * 从 JSON 格式创建 MethodSourceDefinition
     */
    private createMethodSourceFromJson(json: MethodDefinitionJson): MethodSourceDefinition {
        const paramIndices = json.paramIndices ?? [-1];
        return new MethodSourceDefinition(json.methodSigString, paramIndices);
    }

    /**
     * 从 JSON 格式创建 MethodSinkDefinition
     */
    private createMethodSinkFromJson(json: MethodDefinitionJson): MethodSinkDefinition {
        const paramIndices = json.paramIndices ?? [-1];
        return new MethodSinkDefinition(json.methodSigString, paramIndices);
    }

    private isMethodDefinitionJSON(json: any): json is MethodDefinitionJson {
        return json.methodSigString !== undefined;
    }
}
