function sourceArray(): Array<number> {
    return [];
}

function sourceNum(): number {
    return 1;
}

function sinkArray(arg: Array<number>): void {
    console.log(arg);
}

function sinkArrayNum(arg: number): void {
    console.log(arg);
}

/* 污染数组 base */
function arrayTest1() {
    const a = sourceArray();
    sinkArray(a);
}

/* 污染数组元素 */
function arrayTest2() {
    const a = Array<number>(2);
    a[0] = sourceNum();
    sinkArray(a);
}

/* 污染数组元素 */
function arrayTest3() {
    const a = Array<number>(2);
    a[0] = sourceNum();
    sinkArrayNum(a[1]);
}

/* 数组 base 赋值 */
function arrayTest4() {
    const a = Array<number>(2);
    a[0] = sourceNum();
    const b = a;
    sinkArrayNum(b[1]);
}

/* 数组 element 赋值 */
function arrayTest5() {
    const a = Array<number>(2);
    const b = Array<number>(2);
    a[0] = sourceNum();
    b[0] = a[0];
    sinkArrayNum(b[1]);
}

/* 数组别名 */
function arrayAliasTest1() {
    const b = [1, 2];
    const a = b;
    a[0] = sourceNum();
    sinkArrayNum(b[1]);
}

/* 数组别名 */
function arrayAliasTest2() {
    const b = [1, 2];
    const a = b;
    b[0] = sourceNum();
    sinkArrayNum(a[1]);
}
