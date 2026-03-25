function simpleSource() {
    return "simpleSource";
}

function simpleSink(source: string) {
    console.log(source);
}

class A {
    v: string;
    static staticV: string;
}

/**
 * 最简单 case
 */
function simpleTest1() {
    const a = simpleSource();
    simpleSink(a);
}

/**
 * 赋值
 */
function simpleTest2() {
    const a = simpleSource();
    const b = a;
    simpleSink(b);
}

/**
 * 多条赋值
 */
function simpleTest3() {
    const a = simpleSource();
    const b = a + "a";
    simpleSink(b);
}

/**
 * 多条赋值, 有未 sink 污点
 */
function simpleTest4() {
    const a = simpleSource();
    const b = a + 'a';
    const c = b + 'b';
    const d = a + 'a';
    const e = d + 'd';
    simpleSink(e);
}

/**
 * 重复赋值
 */
function simpleTest5() {
    let a = simpleSource();
    a = 'a';
    simpleSink(a);
}

/**
 * 多次 sink
 */
function simpleTest6() {
    let a = simpleSource();
    simpleSink(a);
    simpleSink(a);
}

/**
 * 多次 sink, 重复赋值
 */
function simpleTest7() {
    let a = simpleSource();
    simpleSink(a);
    a = 'a';
    simpleSink(a);
    a = simpleSource();
    simpleSink(a);
}

/**
 * 字段污点
 */
function simpleTest8() {
    const a = new A();
    a.v = simpleSource();
    simpleSink(a.v);
}

/**
 * 字段污点赋值
 */
function simpleTest9() {
    const a = new A();
    a.v = simpleSource();
    const b = a.v;
    simpleSink(b);
}

/**
 * 字段污点赋值
 */
function simpleTest10() {
    const a = new A();
    a.v = simpleSource();
    const b = new A();
    b.v = a.v;
    simpleSink(b.v);
}

class B {
    ba: A;
}

/**
 * 字段污点赋值
 */
function simpleTest11() {
    const b = new B();
    const c = new A();
    c.v = simpleSource();
    b.ba = c;
    simpleSink(b.ba.v);
    b.ba.v = c.v;
    simpleSink(b.ba.v);
}
