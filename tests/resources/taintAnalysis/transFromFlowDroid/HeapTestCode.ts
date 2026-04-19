import { AccountManager, ClassWithField, ClassWithStatic, ConnectionManager, TelephonyManager } from './UtilClasses';

// ========== Inner Classes for HeapTestCode ==========

export class Y {
    f: string = '';

    set(s: string): void {
        this.f = s;
    }
}

export class A {
    b: string = 'Y';
    c: string = 'X';
    i: number = 0;
}

export class X {
    e: string[] = [];

    xx(o: A): string {
        return o.b;
    }

    save(f: string): void {
        this.e = f.split('');
    }
}

export class B {
    attr: A;

    constructor() {
        this.attr = new A();
    }

    setAttr(attr: A): void {
        this.attr = attr;
    }
}

export class Worker {
    mParams: string = '';

    call(): void {}
}

export class FutureTask {
    private wo: Worker;

    constructor(w: Worker) {
        this.wo = w;
    }

    run(): void {
        this.wo.call();
    }
}

export class WrapperClass {
    callIt(): void {
        ClassWithStatic.staticString = TelephonyManager.getDeviceId();
    }

    sink(): void {
        const cm = new ConnectionManager();
        cm.publish(ClassWithStatic.staticString);
    }
}

export class DataClass {
    data: string = '';
    next: DataClass | null = null;
}

export class RecursiveDataClass {
    child: RecursiveDataClass | null = null;
    data: string = '';

    leakIt(): void {
        const cm = new ConnectionManager();
        cm.publish(this.data);
        if (this.child !== null) {
            this.child.leakIt();
        }
    }
}

export class FirstLevel {
    getValue(l: SecondLevel, c: string): string {
        return l.id(c);
    }
}

export class SecondLevel {
    id(i: string): string {
        return i;
    }
}

export class MyArrayList {
    elements: string[] | null = null;

    add(obj: string): void {
        if (this.elements === null) {
            this.elements = ['', '', ''];
        }
        this.elements[0] = obj;
    }

    get(): string {
        return this.elements![0];
    }
}

export class SimpleTree {
    data: string = '';
    left: SimpleTree | null = null;
    right: SimpleTree | null = null;
}

export class Tree {
    left: Tree | null = null;
    right: Tree | null = null;
    data: string = '';
}

export class SeparatedTree {
    left: TreeElement | null = null;
    right: TreeElement | null = null;
}

export class TreeElement {
    child: SeparatedTree | null = null;
    data: string = '';
}

export class Data {
    next: Data | null = null;
}

export class C {
    b: B | null = null;
}

export class D {
    e: E | null = null;

    read(): void {
        this.e = new E();
        this.e.read();
    }

    setF(e: E): void {
        this.e = e;
        this.e.setF(e);
    }
}

export class E {
    str: string = '';

    read(): void {
        this.str = '';
        this.str = TelephonyManager.getDeviceId();
    }

    setF(e: E): void {
        e.str = '';
        e.str = TelephonyManager.getDeviceId();
    }
}

export class F {
    g: G | null = null;

    read(): void {
        this.g = new G();
        this.g.read();
    }
}

export class G {
    str: string = '';

    read(): void {
        this.str = TelephonyManager.getDeviceId();
    }
}

export class H {
    i: I | null = null;

    read(): void {
        this.i = new I();
        this.i.read();
    }
}

export class I {
    str: string = '';
    str2: string = '';

    read(): void {
        this.str = '';
        this.str2 = this.str;
        this.str = TelephonyManager.getDeviceId();
    }
}

export class J {
    e: E | null = null;
    f: E | null = null;

    read(): void {
        this.e = new E();
        this.f = this.e;
        this.e.read();
    }
}

export class Inner {
    secret: string = '';
}

export class Book {
    name: string = '';
}

export class Container1 {
    g: string = '';
}

export class Container2 {
    f: Container1 | null = null;
}

export class OuterClass {
    i: InnerClass | null = null;
}

export class InnerClass {
    o: OuterClass | null = null;
    str: string = '';

    leakIt(): void {
        const cm = new ConnectionManager();
        cm.publish(this.str);
    }
}

// ========== Helper Classes (Static or External) ==========



// ========== Main HeapTestCode Class ==========

/**
 * Heap test code converted from FlowDroid Java test cases
 * Tests for aliasing of heap references
 */
export class HeapTestCode {
    // Instance Fields
    private b1: B | null = null;
    private b2: B | null = null;
    field: Inner = new Inner();
    alias: Book | null = null;
    private intData: number = 0;
    private static staticB1: B | null = null;
    private static staticB2: B | null = null;
    private taintedBySourceSinkManager: Data | null = null;
    private static myTree: Tree | null = null;

    // ========== Test Methods ==========

    simpleTest(): void {
        const taint = TelephonyManager.getDeviceId();
        const a = new Y();
        const b = new Y();

        a.set(taint);
        b.set('notaint');
        const cm = new ConnectionManager();
        cm.publish(b.f);
    }

    argumentTest(): void {
        const x = new ClassWithField();
        HeapTestCode.run(x);
        x.listField = [];
        x.listField.push(TelephonyManager.getDeviceId());
    }

    static run(o: ClassWithField): void {
        o.listField = [];
        o.listField.push('empty');
        const cm = new ConnectionManager();
        cm.publish(o.field);
    }

    negativeTest(): void {
        const taint = TelephonyManager.getDeviceId();

        const notRelevant = new MyArrayList();
        const list = new MyArrayList();
        notRelevant.add(taint);
        list.add('test');

        const cm = new ConnectionManager();
        cm.publish(list.get());
    }

    doubleCallTest(): void {
        const a = new X();
        const b = new X();
        a.save('neutral');
        b.save(TelephonyManager.getDeviceId());
        const cm = new ConnectionManager();
        cm.publish(a.e.join(''));
    }

    methodTest0(): void {
        const taint = TelephonyManager.getDeviceId();
        const x = new X();
        const a = new A();
        const str = x.xx(a);
        a.b = taint;
        const cm = new ConnectionManager();
        cm.publish(str);
    }

    methodTest0b(): void {
        const taint = TelephonyManager.getDeviceId();
        const a = new A();
        const str = a.b;
        a.b = taint;
        const cm = new ConnectionManager();
        cm.publish(str);
    }

    methodTest1(): void {
        const tainted = TelephonyManager.getDeviceId();
        new AsyncTask().execute(tainted);
    }

    methodTest2(): void {
        const tainted = TelephonyManager.getDeviceId();
        const wo = new (class extends Worker {
            override call(): void {
                const cm = new ConnectionManager();
                cm.publish(this.mParams);
            }
        })();
        wo.mParams = tainted;
        new FutureTask(wo).run();
    }

    methodTest3(): void {
        const tainted = TelephonyManager.getDeviceId();
        new AsyncTask2().execute(tainted);
    }

    testForWrapper(): void {
        const cm = new ConnectionManager();
        cm.publish('');
        const cws = new ClassWithStatic();
        let i = 4 + 3;
        while (true) {
            cws.getTitle();
            if (i === 8) {
                break;
            }
        }
        ClassWithStatic.staticString = TelephonyManager.getDeviceId();
    }

    testForLoop(): void {
        while (true) {
            const f = new WrapperClass();
            f.sink();

            const w = new WrapperClass();
            w.callIt();
        }
    }

    testForEarlyTermination(): void {
        const cm = new ConnectionManager();
        cm.publish(ClassWithStatic.staticString);

        new ClassWithStatic();

        const w1 = new WrapperClass();
        w1.callIt();
    }

    methodReturn(): void {
        const b = new B();
        const b2 = b;
        b.attr = this.m();
        const cm = new ConnectionManager();
        cm.publish(b2.attr.b);
    }

    m(): A {
        const a = new A();
        a.b = TelephonyManager.getDeviceId();
        return a;
    }

    twoLevelTest(): void {
        const l2 = new SecondLevel();
        const l1 = new FirstLevel();

        const x = l1.getValue(l2, TelephonyManager.getDeviceId());
        const y = l1.getValue(l2, 'test');
        x.toString();
        const cm = new ConnectionManager();
        cm.publish(y);
    }

    multiAliasTest(): void {
        const dc = new DataClass();
        let dc2: DataClass | null = null;
        const dc3 = new DataClass();

        dc2 = dc3;

        dc2.next = dc;

        const a = TelephonyManager.getDeviceId();
        dc.data = a;

        const cm = new ConnectionManager();
        cm.publish(dc3.next!.data);
    }

    overwriteAliasTest(): void {
        const dc = new DataClass();
        let dc2: DataClass | null = null;
        const dc3 = new DataClass();

        dc2 = dc3;

        dc2.next = dc;
        dc3.next = null;

        const a = TelephonyManager.getDeviceId();
        dc.data = a;

        const cm = new ConnectionManager();
        cm.publish(dc3.next!.data);
    }

    arrayAliasTest(): void {
        const a: string[] = [''];
        const b = a;
        a[0] = TelephonyManager.getDeviceId();
        const c = b;
        const cm = new ConnectionManager();
        cm.publish(c[0]);
    }

    arrayAliasTest2(): void {
        const tainted = TelephonyManager.getDeviceId();
        const arr: string[] = ['foo', 'bar'];
        const arr2 = arr;
        const size = arr.length;
        arr[1] = tainted;
        const x = arr2[1];

        const cm = new ConnectionManager();
        cm.publish(x);
        console.log(size);
    }

    functionAliasTest(): void {
        const tainted = TelephonyManager.getDeviceId();
        const dc1 = new DataClass();
        const dc2 = new DataClass();
        dc1.data = tainted;
        this.copy(dc1, dc2);
        const cm = new ConnectionManager();
        cm.publish(dc2.data);
    }

    private copy(pdc1: DataClass, pdc2: DataClass): void {
        pdc2.data = pdc1.data;
    }

    functionAliasTest2(): void {
        const dc1 = new DataClass();
        const dc2 = new DataClass();
        this.taintMe(dc1);
        this.copy(dc1, dc2);
        const cm = new ConnectionManager();
        cm.publish(dc2.data);
    }

    taintMe(dc: DataClass): void {
        const tainted = TelephonyManager.getDeviceId();
        dc.data = tainted;
    }

    multiLevelTaint(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        const a = b.attr;
        this.taintLevel1(tainted, b);
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    private taintLevel1(data: string, b: B): void {
        this.taintLevel2(data, b.attr);
    }

    private taintLevel2(data: string, a: A): void {
        a.b = data;
    }

    negativeMultiLevelTaint(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        const a = b.attr;
        const cm = new ConnectionManager();
        cm.publish(a.b);
        this.taintLevel1(tainted, b);
    }

    negativeMultiLevelTaint2(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        this.taintLevel1b(tainted, b);
    }

    private taintLevel1b(data: string, b: B): void {
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
        this.taintLevel2(data, b.attr);
    }

    multiLevelTaint2(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        this.taintLevel1c(tainted, b);
    }

    private taintLevel1c(data: string, b: B): void {
        this.taintLevel2(data, b.attr);
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    threeLevelTest(): void {
        const b = new B();
        const a = b.attr;
        this.taintOnNextLevel(b, a);
    }

    private taintMeB(b: B): void {
        b.attr.b = TelephonyManager.getDeviceId();
    }

    private taintOnNextLevel(b: B, a: A): void {
        this.taintMeB(b);
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    recursionTest(): void {
        const rdc = new RecursiveDataClass();
        rdc.data = TelephonyManager.getDeviceId();
        rdc.leakIt();
    }

    activationUnitTest1(): void {
        const b = new B();

        const a = b.attr;
        const tainted = TelephonyManager.getDeviceId();
        a.b = tainted;

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    activationUnitTest2(): void {
        const b = new B();
        b.attr = new A();

        const a = b.attr;
        const tainted = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);

        a.b = tainted;
    }

    activationUnitTest3(): void {
        const b = new B();
        b.attr = new A();

        const b2 = new B();
        b2.attr = new A();

        const tainted = TelephonyManager.getDeviceId();

        b.attr.b = tainted;
        b2.attr.b = b.attr.b;

        const cm = new ConnectionManager();
        cm.publish(b2.attr.b);
    }

    activationUnitTest4(): void {
        const b = new B();
        b.attr = new A();

        const b2 = new B();
        b2.attr = new A();

        const tainted = TelephonyManager.getDeviceId();

        b2.attr.b = tainted;

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);

        b.attr.b = tainted;
    }

    activationUnitTest4b(): void {
        const b = new B();
        b.attr = new A();

        const b2 = new B();
        b2.attr = new A();

        const tainted = TelephonyManager.getDeviceId();

        b2.attr.b = tainted;

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);

        b.attr = b2.attr;
    }

    activationUnitTest5(): void {
        const b = new B();
        b.attr = new A();

        const b2 = new B();
        b2.attr = new A();

        const cm = new ConnectionManager();
        const tainted = TelephonyManager.getDeviceId();

        cm.publish(b.attr.b);
        cm.publish(b2.attr.b);

        b.attr = b2.attr;

        cm.publish(b.attr.b);
        cm.publish(b2.attr.b);

        b.attr.b = tainted;
    }

    returnAliasTest(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        const c = b;
        const a = this.aliasMethod(c);
        c.attr.b = tainted;
        b.attr.b = tainted;
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    private aliasMethod(b: B): A {
        return b.attr;
    }

    callPerformanceTest(): void {
        const a = new A();
        a.b = this.getDeviceId();
        const b = new B();
        b.attr = a;

        this.doIt(b);
    }

    private doIt(b: B): void {
        this.throwAround(b);
        console.log(b.attr.b);
    }

    private getDeviceId(): string {
        const tainted = TelephonyManager.getDeviceId();
        return tainted;
    }

    private throwAround(b: B): void {
        this.throwAround2(b.attr);
    }

    private throwAround2(a: A): void {
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    private fooB(b1: B, b2: B): void {
        this.b1 = b1;
        this.b2 = b2;
    }

    private foo2B(b1: B, b2: B): void {
        //
    }

    private barA(a: A): A {
        this.b1!.attr = a;
        return this.b2!.attr;
    }

    private bar2A(a: A): A | null {
        return null;
    }

    testAliases(): void {
        const b = new B();
        const a = new A();
        a.b = TelephonyManager.getDeviceId();

        this.fooB(b, b);
        const tainted = this.barA(a).b;

        const cm = new ConnectionManager();
        cm.publish(tainted);
    }

    testWrapperAliases(): void {
        const b = new B();
        const a = new A();
        a.b = TelephonyManager.getDeviceId();

        this.foo2B(b, b);
        const tainted = this.bar2A(a)!.b;

        const cm = new ConnectionManager();
        cm.publish(tainted);
    }

    negativeTestAliases(): void {
        const b = new B();
        const a = new A();
        a.b = TelephonyManager.getDeviceId();

        this.fooB(b, b);
        const untainted = this.barA(a).c;

        const cm = new ConnectionManager();
        cm.publish(untainted);
    }

    private aliasB(b1: B, b2: B): void {
        b2.attr = b1.attr;
    }

    private setB(a: B, secret: string, b: B): void {
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
        a.attr.b = secret;
        cm.publish(b.attr.b);
    }

    private fooA(a: B): void {
        console.log(a);
    }

    aliasPerformanceTest(): void {
        const a = new B();
        const b = new B();
        this.aliasB(a, b);
        this.setB(a, TelephonyManager.getDeviceId(), b);
        this.fooA(a);
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    backwardsParameterTest(): void {
        const b1 = new B();
        b1.attr = new A();
        const b2 = new B();

        this.aliasB(b1, b2);

        b2.attr.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b1.attr.b);
    }

    aliasTaintLeakTaintTest(): void {
        const b = new B();
        b.attr = new A();
        const a = b.attr;
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
        b.attr.b = TelephonyManager.getDeviceId();
        cm.publish(a.b);
    }

    fieldBaseOverwriteTest(): void {
        const a = new A();
        a.b = TelephonyManager.getDeviceId();
        const a2 = a;
        const cm = new ConnectionManager();
        cm.publish(a2.b);
    }

    private aliasA(a: A): A {
        return a;
    }

    doubleAliasTest(): void {
        const a = new A();
        const b = this.aliasA(a);
        const c = this.aliasA(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
        cm.publish(c.b);
    }

    private alias2A(a: A): A {
        const a2 = a;
        return a2;
    }

    doubleAliasTest2(): void {
        const a = new A();
        const b = this.alias2A(a);
        const c = this.alias2A(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
        cm.publish(c.b);
    }

    tripleAliasTest(): void {
        const a = new A();
        const b = this.aliasA(a);
        const c = this.aliasA(a);
        const d = this.aliasA(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
        cm.publish(c.b);
        cm.publish(d.b);
    }

    singleAliasTest(): void {
        const a = new A();
        const b = this.aliasA(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
    }

    negativeSingleAliasTest(): void {
        const a = new A();
        const b = this.fakeAlias(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
    }

    doNotFold(): A {
        const a = new A();
        console.log('XXX');
        return a;
    }

    private fakeAlias(a: A): A {
        return this.doNotFold();
    }

    private setIntData(): void {
        this.intData = TelephonyManager.getIMEI();
    }

    intAliasTest(): void {
        this.setIntData();
        const cm = new ConnectionManager();
        cm.publishInt(this.intData);
    }

    private aliasStatic(): void {
        HeapTestCode.staticB2!.attr = HeapTestCode.staticB1!.attr;
    }

    staticAliasTest(): void {
        HeapTestCode.staticB1 = new B();
        HeapTestCode.staticB2 = new B();

        this.aliasStatic();

        HeapTestCode.staticB1!.attr.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(HeapTestCode.staticB2!.attr.b);
    }

    staticAliasTest2(): void {
        HeapTestCode.staticB1 = new B();
        HeapTestCode.staticB2 = HeapTestCode.staticB1;
        HeapTestCode.staticB1!.attr.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(HeapTestCode.staticB2!.attr.b);
    }

    unAliasParameterTest(): void {
        const b1 = new B();
        const b2 = new B();

        b2.attr = b1.attr;
        this.doUnalias(b2);
        b1.attr.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(b2.attr.b);
    }

    private doUnalias(b2: B): void {
        b2.attr = new A();
    }

    overwriteParameterTest(): void {
        const b = new B();
        b.attr.b = TelephonyManager.getDeviceId();

        this.overwriteParameter(b);

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    private overwriteParameter(b: B): void {
        console.log(b);
        // Note: In Java, this was `b = new B()`, but parameter reassignment doesn't affect caller
    }

    multiAliasBaseTest(): void {
        const a = new A();
        const b1 = new B();
        const b2 = new B();

        b1.setAttr(a);
        b2.setAttr(a);

        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b1.attr.b);
        cm.publish(b2.attr.b);
    }

    innerClassTest(): void {
        // Simplified version - inner class semantics differ in TS
        const a = { obj: { data: '' } };
        const b = { obj: { data: '' } };

        a.obj.data = TelephonyManager.getDeviceId();
        const untainted = b.obj.data;
        const cm = new ConnectionManager();
        cm.publish(untainted);
    }

    innerClassTest2(): void {
        // Simplified version
        const a = { obj: { data: '' } };
        const b = { obj: { data: '' } };

        a.obj.data = TelephonyManager.getDeviceId();
        const untainted = b.obj.data;
        const cm = new ConnectionManager();
        cm.publish(untainted);
    }

    innerClassTest3(): void {
        // Simplified version
        const a = { obj: { data: '' } };
        const b = { obj: { data: '' } };

        b.obj.data = TelephonyManager.getDeviceId();
        const untainted = a.obj.data;
        const cm = new ConnectionManager();
        cm.publish(untainted);
    }

    innerClassTest4(): void {
        // Simplified version
        const a = { obj: { data: '' } };
        const b = { obj: { data: '' } };

        a.obj.data = TelephonyManager.getDeviceId();
        const untainted = b.obj.data;
        const cm = new ConnectionManager();
        cm.publish(untainted);
    }

    innerClassTest5(): void {
        // Simplified version
        const a = { obj2: { foo: { set: () => {} } } };
        const b = {};

        // Simplified
    }

    innerClassTest6(): void {
        // Simplified version
        const a = { obj: {}, parentData: TelephonyManager.getDeviceId() };

        const inner = a.obj;
        const cm = new ConnectionManager();
        cm.publish(a.parentData);
    }

    datastructureTest(): void {
        const root = new SimpleTree();
        root.left = new SimpleTree();
        root.right = new SimpleTree();
        root.left.data = TelephonyManager.getDeviceId();
        root.right!.data = 'foo';
        const cm = new ConnectionManager();
        cm.publish(root.left.data);
    }

    datastructureTest2(): void {
        const root = new SimpleTree();
        root.left = new SimpleTree();
        root.right = new SimpleTree();
        root.left.data = TelephonyManager.getDeviceId();
        root.right!.data = 'foo';
        const cm = new ConnectionManager();
        cm.publish(root.right!.data);
    }

    staticAccessPathTest(): void {
        HeapTestCode.myTree = new Tree();
        HeapTestCode.myTree!.left = new Tree();
        HeapTestCode.myTree!.left!.right = new Tree();
        HeapTestCode.myTree!.left!.right!.left = HeapTestCode.myTree;
        HeapTestCode.myTree!.data = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(HeapTestCode.myTree!.left!.right!.left!.data);
    }

    separatedTreeTest(): void {
        const myTree = new SeparatedTree();
        myTree.left = new TreeElement();
        myTree.left!.child = new SeparatedTree();
        myTree.left!.child!.right = new TreeElement();
        myTree.left!.child!.right!.data = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(myTree.left!.child!.right!.data);
    }

    overwriteAliasedVariableTest(): void {
        let y2: Y;
        const y1 = new Y();
        y2 = y1;
        y1.f = TelephonyManager.getDeviceId();
        y2 = new Y();
        const cm = new ConnectionManager();
        cm.publish(y1.f);
        cm.publish(y2.f);
    }

    overwriteAliasedVariableTest2(): void {
        const y1 = new Y();
        let y2 = y1;
        y1.f = TelephonyManager.getDeviceId();
        y2.f = '';
        const cm = new ConnectionManager();
        cm.publish(y1.f);
        cm.publish(y2.f);
    }

    overwriteAliasedVariableTest3(): void {
        const y1 = new Y();
        let y2 = y1;
        y1.f = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(y1.f);
        y2.f = '';
        cm.publish(y2.f);
    }

    overwriteAliasedVariableTest4(): void {
        const y1 = new Y();
        let y2 = y1;
        y1.f = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(y1.f);
        cm.publish(y2.f);
        y2.f = '';
    }

    overwriteAliasedVariableTest5(): void {
        const cm = new ConnectionManager();
        const x: unknown = TelephonyManager.getDeviceId();
        const y: unknown = new AccountManager().getPassword();

        let z = '';

        z = x as string;
        const z2 = z;

        z = y as string;
        const z3 = z;

        cm.publish(z2);
        cm.publish(z3);
    }

    overwriteAliasedVariableTest6(): void {
        const y1 = new Y();
        y1.f = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(y1.f);
        // Note: TypeScript null check - we skip the null assignment part
    }

    aliasFlowTest(): void {
        let x: B;
        let y: A;

        const a = new B();
        const p = new B();

        const b = new A();
        const q = new A();

        if (Math.random() < 0.5) {
            x = a;
            y = b;
        } else {
            x = p;
            y = q;
        }
        x.attr = y;
        q.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(a.attr.b);
    }

    private getSecretData(): Data {
        return new Data();
    }

    private leakData(e: Data): void {
        console.log(e);
    }

    aliasStrongUpdateTest(): void {
        let d = this.getSecretData();
        d = d.next!;
        let e = d;

        const x = new Data();
        x.next = e;
        const y = x;
        e = y.next!;
        e = e.next!;
        this.leakData(e);
    }

    aliasStrongUpdateTest2(): void {
        let d = this.getSecretData();
        d = d.next!;
        let e = d;

        const x = new Data();
        const y = x;
        x.next = e;
        e = y.next!;
        e = e.next!;
        this.leakData(e);
    }

    aliasStrongUpdateTest3(): void {
        let d = this.taintedBySourceSinkManager;
        d = d!.next!;
        let e = d;

        const x = new Data();
        const y = x;
        x.next = e;
        e = y.next!;
        e = e.next!;
        this.leakData(y.next!);
    }

    arrayLengthAliasTest1(): void {
        const tainted = TelephonyManager.getDeviceId();
        const arr: string[] = ['foo', 'xx', 'bar'];
        const size = arr.length;
        arr[1] = tainted;

        const cm = new ConnectionManager();
        cm.publishInt(size);
    }

    arrayLengthAliasTest2(): void {
        const tainted = TelephonyManager.getDeviceId();
        const arr: string[] = ['foo', 'xx', 'bar'];
        const arr2 = arr;
        const size = arr.length;
        arr[1] = tainted;
        const size2 = arr2.length;

        const cm = new ConnectionManager();
        cm.publishInt(size2);
        console.log(size);
    }

    arrayLengthAliasTest3(): void {
        const tainted = TelephonyManager.getDeviceId();
        const arr: string[] = new Array(tainted.length);
        const size = arr.length;
        arr[1] = tainted;

        const cm = new ConnectionManager();
        cm.publishInt(size);
    }

    arrayLengthAliasTest4(): void {
        const tainted = TelephonyManager.getDeviceId();
        const arr: string[] = new Array(tainted.length);
        const arr2 = arr;
        const size = arr.length;
        arr[1] = tainted;
        const size2 = arr2.length;

        const cm = new ConnectionManager();
        cm.publishInt(size2);
        console.log(size);
    }

    taintPrimitiveFieldTest1(): void {
        const a = new A();
        const b = a;
        a.i = TelephonyManager.getIMEI();
        const cm = new ConnectionManager();
        cm.publishInt(b.i);
    }

    taintPrimitiveFieldTest2(): void {
        const b = new B();
        const a = new A();
        b.attr = a;
        a.i = TelephonyManager.getIMEI();
        const cm = new ConnectionManager();
        cm.publishInt(b.attr.i);
    }

    multiContextTest1(): void {
        const a = new A();
        a.b = TelephonyManager.getDeviceId();
        a.c = TelephonyManager.getDeviceId();
        const data = this.id(a.b);
        const data2 = this.id(a.c);
        const cm = new ConnectionManager();
        cm.publish(data);
        cm.publish(data2);
    }

    private id(val: string): string {
        return val;
    }

    recursiveFollowReturnsPastSeedsTest1(): void {
        const cm = new ConnectionManager();
        cm.publish(this.doTaintRecursively(new A()));
    }

    private doTaintRecursively(a: A): string {
        if (Math.random() < 0.5) {
            a.b = TelephonyManager.getDeviceId();
            return '';
        } else {
            const a2 = new A();
            this.doTaintRecursively(a2);
            return a2.b;
        }
    }

    doubleAliasTest1(): void {
        const a1 = new A();
        a1.b = TelephonyManager.getDeviceId();
        const a2 = new A();
        a2.b = new AccountManager().getPassword();

        const b = new B();
        if (Math.random() < 0.5) {
            b.attr = a1;
        } else {
            b.attr = a2;
        }

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    longAPAliasTest1(): void {
        const c = new C();
        c.b = new B();
        c.b!.attr = new A();

        const a = c.b!.attr;
        a.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(c.b!.attr.b);
    }

    simpleFieldTest1(): void {
        const a = new A();
        const b = new B();
        b.attr = a;
        a.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    contextTest1(): void {
        const a = new A();
        const b = new A();
        const data = TelephonyManager.getDeviceId();
        this.copyA(a, data);
        this.copyA(b, 'Hello World');
        const cm = new ConnectionManager();
        cm.publish(b.b);
    }

    private copyA(b: A, string: string): void {
        const c = b;
        c.b = string;
    }

    contextTest2(): void {
        const data = TelephonyManager.getDeviceId();
        const a = this.copyData(data);
        const b = this.copyData('Hello World');
        const cm = new ConnectionManager();
        cm.publish(b.b);
        console.log(a);
    }

    private copyData(data: string): A {
        const a = new A();
        const b = a;
        b.b = data;
        return a;
    }

    contextTest3(): void {
        const data = TelephonyManager.getDeviceId();
        const a = this.copyContext(data, new AccountManager().getPassword());
        const b = this.copyContext('Hello World', 'Foobar');
        const cm = new ConnectionManager();
        cm.publish(b.b);
        console.log(a);
    }

    private copyContext(context: string, data: string): A {
        console.log(context);
        const a = new A();
        const b = a;
        b.b = data;
        return a;
    }

    private doWrite(base: Container2, string: string): void {
        base.f!.g = string;
    }

    summaryTest1(): void {
        const base1 = new Container2();
        const base2 = new Container2();
        base1.f = new Container1();
        base2.f = new Container1();
        const tainted = TelephonyManager.getDeviceId();
        this.doWrite(base1, tainted);

        const z = base2.f;
        this.doWrite(base2, tainted);

        const cm = new ConnectionManager();
        cm.publish(z!.g);
    }

    delayedReturnTest1(): void {
        const a = new A();
        const b = new B();
        this.doAlias(b, a);

        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.attr.b);
    }

    private doAlias(b: B, a: A): void {
        b.attr = a;
    }

    aliasWithOverwriteTest1(): void {
        const d = new D();
        d.read();
        const cm = new ConnectionManager();
        cm.publish(d.e!.str);
    }

    aliasWithOverwriteTest2(): void {
        const f = new F();
        f.read();
        const cm = new ConnectionManager();
        cm.publish(f.g!.str);
    }

    aliasWithOverwriteTest3(): void {
        const h = new H();
        h.read();
        const cm = new ConnectionManager();
        cm.publish(h.i!.str2);
    }

    aliasWithOverwriteTest4(): void {
        const j = new J();
        j.read();
        const cm = new ConnectionManager();
        cm.publish(j.f!.str);
    }

    aliasWithOverwriteTest5(): void {
        const d = new D();
        const e = new E();
        d.setF(e);
        const cm = new ConnectionManager();
        cm.publish(d.e!.str);
    }

    innerFieldReductionTestNegative(): void {
        const local = new Inner();
        local.secret = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(this.field.secret);
    }

    innerFieldReductionTestNegative2(): void {
        this.field.secret = TelephonyManager.getDeviceId();
        const local = new Inner();
        const cm = new ConnectionManager();
        cm.publish(local.secret);
    }

    activationStatementTest1(): void {
        const b = new Book();
        const a = b;
        const specialName = b.name + '123';
        a.name = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(specialName);
    }

    callSiteCreatesAlias(): void {
        const tainted = TelephonyManager.getDeviceId();

        const book1 = new Book();
        this.leakingCallee(tainted, new Book(), book1);
        this.leakingCallee(tainted, book1, book1);
    }

    leakingCallee(tainted: string, book1: Book, book2: Book): void {
        book1.name = tainted;
        const cm = new ConnectionManager();
        cm.publish(book2.name);
    }

    lhsNotUpwardsInAliasFlow(): void {
        this.alias = new Book();

        const book = new Book();
        const alias2 = this.alias;
        this.alias = book;
        book.name = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(alias2.name);
    }

    identityStmtIsNotAGoodHandoverPoint(): void {
        const book = new Book();
        this.callee(book);
        book.name = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(book.name);
    }

    callee(b: Book): void {
        console.log(b);
    }

    testRecursiveAccessPath(): void {
        const o = new OuterClass();
        o.i = new InnerClass();
        o.i!.o!.i!.str = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(o.i!.o!.i!.str);
    }

    removeEntailedAbstractionsTest1(): void {
        const rdc = new RecursiveDataClass();
        rdc.data = TelephonyManager.getDeviceId();
        rdc.leakIt();
        rdc.child = new RecursiveDataClass();
        rdc.child.data = TelephonyManager.getDeviceId();
        rdc.child.leakIt();
    }

    removeEntailedAbstractionsTest2(): void {
        const o = new OuterClass();
        o.i = new InnerClass();
        o.i!.str = TelephonyManager.getDeviceId();
        o.i!.leakIt();
        const i = new InnerClass();
        i.str = TelephonyManager.getDeviceId();
        i.leakIt();
    }
}

// ========== AsyncTask classes (need special handling for anonymous classes) ==========

class AsyncTask {
    mWorker: Worker;
    mFuture: FutureTask;

    constructor() {
        this.mWorker = new (class extends Worker {
            override call(): void {
                const cm = new ConnectionManager();
                cm.publish(this.mParams);
            }
        })();
        this.mFuture = new FutureTask(this.mWorker);
    }

    execute(t: string): void {
        this.mWorker.mParams = t;
        this.mFuture.run();
    }
}

class AsyncTask2 {
    mWorker: Worker;

    constructor() {
        this.mWorker = new (class extends Worker {
            override call(): void {
                const cm = new ConnectionManager();
                cm.publish(this.mParams);
            }
        })();
    }

    execute(t: string): void {
        this.mWorker.mParams = t;
        this.mWorker.call();
    }
}
