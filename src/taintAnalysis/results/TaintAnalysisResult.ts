import { LOG_MODULE_TYPE, Logger } from "../..";
import { Stmt } from "../../core/base/Stmt";
import { AccessPath } from "../ifds/AccessPath";
import { FactAtSink } from "../ifds/FactAtSink";
import { SinkDefinition, SourceDefinition } from "../sourcesAndSinks/SourceSinkDefinition";

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'SourceToSinkInfo')

export class SourceToSinkInfo {
    private sourceDefinition: SourceDefinition;

    private sinkDefinition: SinkDefinition;

    /* 于 sink 处被泄漏的污点 */
    private taintAtSink: AccessPath;

    private taintingStmtOfTaintAtSink: Stmt;

    /* 被泄漏污点的前序污点 */
    private preTaints: AccessPath[];

    /* 污点传播路径, 即污点的 taintingStmt */
    private propagationStmts: Stmt[];

    /* sink 语句 */
    private sinkStmt: Stmt;

    constructor(sourceDefinition: SourceDefinition, sinkDefinition: SinkDefinition, taintAtSink: AccessPath, taintingStmtOfTaintAtSink: Stmt, preTaints: AccessPath[], propagationStmts: Stmt[], sinkStmt: Stmt) {
        this.sourceDefinition = sourceDefinition;
        this.sinkDefinition = sinkDefinition;
        this.taintAtSink = taintAtSink;
        this.taintingStmtOfTaintAtSink = taintingStmtOfTaintAtSink;
        this.preTaints = preTaints;
        this.propagationStmts = propagationStmts;
        this.sinkStmt = sinkStmt;
    }

    public toString(): string {
        const str: string[] = [];
        str.push('Found leak:');
        str.push(`\tSource def: ${this.sourceDefinition.toString()}`);

        // 前序污点和传播路径
        if (this.preTaints.length > 0) {
            str.push('\tPropagation Path:');
            this.preTaints.forEach((pre, idx) => {
                str.push(`\t\t-> ${pre.toString()}`);
                str.push(`\t\t\tFROM ${this.propagationStmts[idx] ?? 'NO TAINTING STMT'}`);
            });
        }

        // 被泄漏污点
        str.push(`\t\t-> ${this.taintAtSink.toString()}`);
        str.push(`\t\t\tFROM ${this.taintingStmtOfTaintAtSink}`);

        str.push(`\tTo sink ${this.sinkStmt.toString()}`);
        str.push(`\tSink def ${this.sinkDefinition.toString()} at line ${this.sinkStmt.getOriginPositionInfo().getLineNo()}`);

        return str.join('\n');
    }

    public static from(factAtSinks: FactAtSink): SourceToSinkInfo | undefined {
        if (factAtSinks.fact.isZeroFact() || !factAtSinks.fact.isActive()) {
            logger.warn('FactAtSink is zero fact or inactive')
            return undefined;
        }

        const srcDef = factAtSinks.fact.getSourceDefinition();
        if (srcDef === undefined) {
            logger.warn('Source definition is undefined')
            return undefined;
        }

        const sinkDef = factAtSinks.sink;
        const sourceAtSink = factAtSinks.fact.getAccessPath();
        const sinkStmt = factAtSinks.sinkStmt;
        const taintingStmtOfTaintAtSink = factAtSinks.fact.getTaintingStmt();
        if (taintingStmtOfTaintAtSink === undefined) {
            logger.warn('FactAtSink has no tainting stmt')
            return undefined;
        }

        // 递归解析前序污点和传播路径
        const preTaints: AccessPath[] = [];
        const propagationStmts: Stmt[] = [];
        let currFact = factAtSinks.fact;
        while (currFact.getPreTaintFact() !== undefined) {
            const pre = currFact.getPreTaintFact()!;
            preTaints.push(pre.getAccessPath());
            if (pre.getTaintingStmt() !== undefined) {
                propagationStmts.push(pre.getTaintingStmt()!);
            } else {
                logger.warn(`Taint ${pre.toString()} has no tainting stmt`)
                return undefined;
            }
            currFact = pre;
        }

        // 扭正前序污点和传播路径的顺序
        preTaints.reverse();
        propagationStmts.reverse();

        return new SourceToSinkInfo(srcDef, sinkDef, sourceAtSink, taintingStmtOfTaintAtSink, preTaints, propagationStmts, sinkStmt);
    }
}
