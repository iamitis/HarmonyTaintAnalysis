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

import fs from 'fs';
import Logger, { LOG_MODULE_TYPE } from '../../utils/logger';
import { SourceSinkManager } from './SourceSinkManager';
import { Stmt } from '../../core/base/Stmt';
import { SinkDefinition, SourceDefinition } from './SourceSinkDefinition';
import { SourceSinkDefinitionFactory, TaintDefinitionsJson, SourceDefinitionJson, SinkDefinitionJson } from './SourceSinkDefinitionFactory';

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'TaintConfig');

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

        let json: TaintDefinitionsJson;
        try {
            json = JSON.parse(fileContent) as TaintDefinitionsJson;
        } catch (error) {
            logger.error(`Failed to parse taint definition file: ${error}`);
            return;
        }

        if (json.sources) {
            for (const sourceJson of json.sources) {
                const source = SourceSinkDefinitionFactory.createSourceFromJson(sourceJson as SourceDefinitionJson);
                source && this.addSource(source);
            }
        }

        if (json.sinks) {
            for (const sinkJson of json.sinks) {
                const sink = SourceSinkDefinitionFactory.createSinkFromJson(sinkJson as SinkDefinitionJson);
                sink && this.addSink(sink);
            }
        }

        logger.info(`Loaded taint definitions from ${filePath}: ` +
            `${this.sources.length} sources, ${this.sinks.length} sinks`);
    }
}
