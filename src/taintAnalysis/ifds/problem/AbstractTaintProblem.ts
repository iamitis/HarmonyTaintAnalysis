import { LOG_MODULE_TYPE, Logger } from "../../..";
import { Local } from "../../../core/base/Local";
import { ArkAssignStmt, ArkReturnStmt, ArkReturnVoidStmt, Stmt } from "../../../core/base/Stmt";
import { DataflowProblem, FlowFunction } from "../../../core/dataflow/DataflowProblem";
import { PathEdge, PathEdgePoint } from "../../../core/dataflow/Edge";
import { ArkMethod } from "../../../core/model/ArkMethod";
import { IFDSManager } from "../IFDSManager";
import { TaintFact } from "../TaintFact";

export interface TaintFlowFunction extends FlowFunction<TaintFact> {
    getDataFactsWithCtxNode?(ctxPoint: PathEdgePoint<TaintFact>, currFact: TaintFact): Set<TaintFact>;
    getDataFactsWithCallerEdge?(callerEdge: PathEdge<TaintFact>, currFact: TaintFact): Set<TaintFact>;
    getDataFactsWithCallees?(callees: Set<ArkMethod>, currFact: TaintFact): Set<TaintFact>;
}

const logger = Logger.getLogger(LOG_MODULE_TYPE.TOOL, 'AbstractTaintProblem');

export abstract class AbstractTaintProblem extends DataflowProblem<TaintFact> {
    protected entryMethod: ArkMethod;
    protected entryPoint: Stmt = new ArkReturnVoidStmt(); // 占位

    protected ifdsManager: IFDSManager;

    /**
     * 保存方法的 return 语句
     */
    private methodToReturnStmtsMap: Map<ArkMethod, readonly Stmt[]> = new Map();

    /**
     * 保存在 method 内被定义的 Local, 可用于快速检查参数是否被覆写
     */
    private methodToDefLocalMap: Map<ArkMethod, Set<Local>> = new Map();

    constructor(ifdsManager: IFDSManager, entryMethod: ArkMethod) {
        super();
        this.ifdsManager = ifdsManager;
        this.entryMethod = entryMethod;
    }

    abstract getNormalFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): TaintFlowFunction;

    abstract getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): TaintFlowFunction;

    abstract getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): TaintFlowFunction;

    abstract getCallToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt): TaintFlowFunction;


    /**
     * 判断是否是无需进入的方法
     * TODO: 库方法
     */
    public isExcludedMethod(stmt: Stmt, method?: ArkMethod): boolean {
        const isSourceMethod = this.ifdsManager.getSourceSinkManager()?.getSources().some((source) => source.matches(stmt)) ?? false;
        if (isSourceMethod) {
            return true;
        }

        const isSinkMethod = this.ifdsManager.getSourceSinkManager()?.getSinks().some((sink) => sink.matches(stmt)) ?? false;
        if (isSinkMethod) {
            return true;
        }

        return false;
    }

    /**
     * 寻找方法的 return 语句
     */
    public findReturnStmts(method: ArkMethod): readonly Stmt[] {
        if (!this.methodToReturnStmtsMap.has(method)) {
            const returnStmts = method.getCfg()?.getStmts().filter(stmt => {
                return stmt instanceof ArkReturnStmt || stmt instanceof ArkReturnVoidStmt;
            }) ?? [];
            this.methodToReturnStmtsMap.set(method, returnStmts);
            return returnStmts;
        }
        return this.methodToReturnStmtsMap.get(method)!;
    }

    /**
     * 获取方法的第 i 个参数对应的 Local
     */
    protected findParamLocal(method: ArkMethod, index: number): Local | undefined {
        const body = method.getBody();
        if (!body) {
            return undefined;
        }
        const params = method.getParameters();
        if (index < params.length) {
            const paramName = params[index].getName();
            return body.getLocals().get(paramName);
        }
        return undefined;
    }

    /**
     * 检查 paramLocal 是否在方法内被覆写
     */
    protected isParamLocalOverwritten(method: ArkMethod, paramLocal: Local): boolean {
        if (!this.methodToDefLocalMap.get(method)) {
            this.cacheDefLocals(method);
        }

        const defLocals = this.methodToDefLocalMap.get(method)!;
        return defLocals.has(paramLocal);
    }

    private cacheDefLocals(method: ArkMethod): void {
        if (this.methodToDefLocalMap.has(method)) {
            return;
        }

        const cfg = method.getCfg();
        if (!cfg) {
            logger.warn('Method has no Cfg', method.getName());
            return;
        }

        const idxOfNormalStmtStart: number = method.getParameters().length + 1;
        const stmts = cfg.getStmts();
        const defLocals = new Set<Local>();
        for (let i = idxOfNormalStmtStart; i < stmts.length; ++i) {
            const s = stmts[i];
            if (s instanceof ArkAssignStmt) {
                const leftOp = s.getLeftOp();
                leftOp instanceof Local && defLocals.add(leftOp);
            }
        }

        this.methodToDefLocalMap.set(method, defLocals);
    }

    /**
     * 获取分析入口点
     * @override
     */
    getEntryPoint(): Stmt {
        return this.entryPoint;
    }

    /**
     * 获取入口方法
     * @override
     */
    getEntryMethod(): ArkMethod {
        return this.entryMethod;
    }

    /**
     * 判断两个 fact 是否相等
     * @override
     */
    factEqual(d1: TaintFact, d2: TaintFact): boolean {
        return d1.equals(d2);
    }

    /**
     * 创建零值（特殊的初始 fact）
     * @override
     */
    createZeroValue(): TaintFact {
        return TaintFact.createZeroFact();
    }
}
