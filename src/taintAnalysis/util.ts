import { AbstractBinopExpr, ArkCastExpr } from "../core/base/Expr";
import { Local } from "../core/base/Local";
import { AbstractFieldRef, ArkArrayRef } from "../core/base/Ref";
import { Value } from "../core/base/Value";

/**
 * 获取 value 包含的所有基本值, 如多元运算中的所有操作数、数组的 base
 */
export function findBaseValues(value: Value): Value[] {
    // TODO: 检查完善更多类型
    if (value instanceof AbstractBinopExpr) {
        // a * b
        return value.getUses();
    } else if (value instanceof ArkArrayRef) {
        // a[i]
        return [value.getBase()];
    } else if (value instanceof ArkCastExpr) {
        // a as string
        return value.getUses();
    }
    return [value];
}

export const COLORS = new Map<string, string>([
    ['reset', '\x1b[0m'],
    ['red', '\x1b[31m'],
    ['green', '\x1b[32m'],
    ['yellow', '\x1b[33m'],
    ['blue', '\x1b[34m'],
    ['magenta', '\x1b[35m'],
    ['cyan', '\x1b[36m'],
    ['white', '\x1b[37m'],
    ['bgRed', '\x1b[41m'],
]);

export function getColorText(text: string, colorKey?: string) {
    const color = COLORS.get(colorKey ?? 'reset') ?? COLORS.get('reset')!;
    return `${color}${text}${COLORS.get('reset')!}`;
}
