import { Stmt } from "../../core/base/Stmt";

export class Postdominator {
    private stmt?: Stmt;

    getStmt(): Stmt | undefined {
        return this.stmt;
    }
}
