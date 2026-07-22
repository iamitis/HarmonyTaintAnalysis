import { Stmt } from '../../../core/base/Stmt';
import { SourceDefinition, SinkDefinition, SourceSinkType } from '../SourceSinkDefinition';

/**
 * 将字符串中所有空格都去掉
 */
function stringTrimAll(str: string): string {
    return str.replace(/\s+/g, '');
}

/**
 * Method 形式的 Source 定义
 * 匹配方法调用语句，通过 methodSignature 进行匹配
 */
export class MethodSourceDefinition implements SourceDefinition {
    readonly type = SourceSinkType.METHOD;

    constructor(
        public readonly methodSigString: string,
        // 返回值作为 source，或参数位置（-1 表示返回值）
        public readonly paramIndices: number[]
    ) { }

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        const invokeExpr = stmt.getInvokeExpr();
        if (!invokeExpr) {
            return false;
        }
        const stmtMethodSignature = invokeExpr.getMethodSignature();
        // 无视字符串中的空格
        return stringTrimAll(stmtMethodSignature.toString()) === stringTrimAll(this.methodSigString);
    }

    /**
     * @override
     */
    toString(): string {
        return `METHOD_SOURCE { ${this.methodSigString} }`;
    }

    getParamIndices(): number[] {
        return this.paramIndices;
    }

}

/**
 * Method 形式的 Sink 定义
 * 匹配方法调用语句，通过 methodSignature 进行匹配
 */
export class MethodSinkDefinition implements SinkDefinition {
    readonly type = SourceSinkType.METHOD;

    constructor(
        public readonly methodSigString: string,
        // 哪些参数位置是 sink
        public readonly paramIndices: number[]
    ) { }

    /**
     * @override
     */
    matches(stmt: Stmt): boolean {
        const invokeExpr = stmt.getInvokeExpr();
        if (!invokeExpr) {
            return false;
        }
        const stmtMethodSignature = invokeExpr.getMethodSignature();
        return stringTrimAll(stmtMethodSignature.toString()) === stringTrimAll(this.methodSigString);
    }

    /**
     * @override
     */
    getParamIndices(): number[] {
        return this.paramIndices;
    }

    /**
     * @override
     */
    toString(): string {
        return `METHOD_SINK { ${this.methodSigString} }`;
    }
}
