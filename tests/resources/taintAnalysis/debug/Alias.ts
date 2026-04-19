/**
 * 测试场景：别名分析
 * 验证污点通过别名传播的场景
 */

class Child {
    childField: string = '';
}

class Parent {
    parentField: Child = new Child();
}

function sourceField(): string {
    return "sensitive_field";
}

function sinkField(arg: string): void {
    console.log(arg);
}

/**
 * 后向寻找别名
 */
function testFieldAlias() {
    const a = new Child();
    const b = a;
    b.childField = sourceField();
    sinkField(a.childField);
}

/**
 * 后向寻找别名
 */
function testFieldAlias2() {
    const p = new Parent();
    const c = new Child();
    p.parentField = c;
    p.parentField.childField = sourceField();
    sinkField(c.childField);
}

/**
 * 后向寻找别名
 */
function testFieldAlias3() {
    const a = new Child();
    const b = a;
    a.childField = sourceField();
    sinkField(b.childField);
}

/**
 * 后向寻找别名
 */
function testFieldAlias4() {
    const p = new Parent();
    p.parentField = new Child();
    const c = p.parentField;
    p.parentField.childField = sourceField();
    sinkField(c.childField);
}

/**
 * 后向寻找别名, 流敏感
 */
function testFieldAlias5() {
    const a = new Child();
    const b = a;
    b.childField = 'a';
    sinkField(a.childField);
    b.childField = sourceField();
    sinkField(a.childField);
}

/**
 * 后向寻找别名, 流敏感
 */
function testFieldAlias6() {
    const p = new Parent();
    const c = new Child();
    p.parentField = c;
    p.parentField.childField = 'p';
    sinkField(c.childField);
    p.parentField.childField = sourceField();
    sinkField(c.childField);
}


/**
 * 后向寻找别名, 流敏感
 */
function testFieldAlias7() {
    const a = new Child();
    const b = a;
    a.childField = '';
    sinkField(b.childField);
    a.childField = sourceField();
    sinkField(b.childField);
}

/**
 * 后向寻找别名, 流敏感
 */
function testFieldAlias8() {
    const p = new Parent();
    p.parentField = new Child();
    const c = p.parentField;
    c.childField = '';
    sinkField(p.parentField.childField);
    c.childField = sourceField();
    sinkField(p.parentField.childField);
}

/**
 * 后向寻找别名, 适时杀死污点
 */
function testFieldAlias9() {
    const a = new Child();
    const b = a;
    a.childField = sourceField();
    a.childField = 'a';
    sinkField(b.childField);
}

/**
 * 后向寻找别名, 适时杀死污点
 */
function testFieldAlias10() {
    const p = new Parent();
    p.parentField = new Child();
    const c = p.parentField;
    p.parentField.childField = sourceField();
    p.parentField.childField = 'p';
    sinkField(c.childField);
}

/**
 * 后向寻找别名, 适时杀死污点
 */
function testFieldAlias11() {
    const a = new Child();
    const b = a;
    b.childField = sourceField();
    b.childField = 'b';
    sinkField(a.childField);
}

/**
 * 后向寻找别名, 适时杀死污点
 */
function testFieldAlias12() {
    const p = new Parent();
    const c = new Child();
    p.parentField = c;
    c.childField = sourceField(); // 未激活, 杀
    c.childField = 'c';
    sinkField(p.parentField.childField)
}

/**
 * 后向寻找别名, 适时杀死污点
 */
function testFieldAlias13() {
    const c = new Child();
    const p3 = new Parent();
    const p2 = p3;
    p2.parentField = c;
    p3.parentField = new Child(); // 未激活, 杀
    c.childField = sourceField();
    sinkField(p2.parentField.childField);
}

class Grand {
    grandField: Parent = new Parent();
}

/**
 * 未激活, 不杀
 */
function testFieldAlias14() {
    const g = new Grand();
    const p = new Parent();
    const c = new Child();

    g.grandField = p;
    p.parentField = c;
    p.parentField.childField = 'pc'; // 未激活, 不杀

    c.childField = sourceField();
    sinkField(g.grandField.parentField.childField);
}

/**
 * 未激活, 杀
 */
function testFieldAlias15() {
    const g = new Grand();
    const p = new Parent();
    const c = new Child();

    g.grandField = p;
    p.parentField = c;
    p.parentField = new Child(); // 未激活, 杀

    c.childField = sourceField();
    sinkField(g.grandField.parentField.childField);
}

function functionAliasTest(): void {
    const tainted = sourceField();
    const dc1 = new Child();
    const dc2 = new Child();
    dc1.childField = tainted;
    copy(dc1, dc2);
    sinkField(dc2.childField);
}

function copy(pdc1: Child, pdc2: Child): void {
    pdc2.childField = pdc1.childField;
}
