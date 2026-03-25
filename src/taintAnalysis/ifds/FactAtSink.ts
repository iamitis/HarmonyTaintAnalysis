import { Stmt } from "../../core/base/Stmt";
import { SinkDefinition } from "../sourcesAndSinks/SourceSinkDefinition";
import { TaintFact } from "./TaintFact";

export class FactAtSink {
    fact: TaintFact;

    sink: SinkDefinition;

    sinkStmt: Stmt;

    constructor(fact: TaintFact, sink: SinkDefinition, sinkStmt: Stmt) {
        this.fact = fact;
        this.sink = sink;
        this.sinkStmt = sinkStmt;
    }
}
