import { A, B, Book, Container1, Container2, DataClass, FirstLevel, MyArrayList, SecondLevel, Y } from "./HeapTestCode";
import { AccountManager, AppLocation, ConnectionManager, LocationManager, TelephonyManager } from "./UtilClasses";

class DebugBasicTest {
    debugOverwriteInCalleeTest2(): void {
        let loc: AppLocation = LocationManager.getLastKnownLocation();
        this.debugCalleeOverwriteNull(loc);

        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLatitude().toString());
    }

    private debugCalleeOverwriteNull(loc: AppLocation): void {
        console.log(loc);
        loc = null as unknown as AppLocation;
    }

    debugOverwriteBaseObjectTest2(): void {
        let loc: AppLocation = new AppLocation(LocationManager.getLongitude(), LocationManager.getLongitude());
        loc = loc.clearLongitude();
        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLongitude().toString());
    }
}

class DebugHeapTest {
    b1: B | null = null;
    b2: B | null = null;
    alias: Book | null = null;
    static staticB1: B | null = null;
    static staticB2: B | null = null;

    debugNegativeTest(): void {
        const taint = TelephonyManager.getDeviceId();

        const notRelevant = new MyArrayList();
        const list = new MyArrayList();
        notRelevant.add(taint);
        list.add('test');

        const cm = new ConnectionManager();
        cm.publish(list.get());
    }

    debugMultiLevelTaint(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        const a = b.attr;
        this.debugTaintLevel1(tainted, b);
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    debugTaintLevel1(data: string, b: B): void {
        this.debugTaintLevel2(data, b.attr);
    }

    debugTaintLevel2(data: string, a: A): void {
        a.b = data;
    }

    debugSimpleTest(): void {
        const taint = TelephonyManager.getDeviceId();
        const a = new Y();
        const b = new Y();

        a.set(taint);
        b.set('notaint');
        const cm = new ConnectionManager();
        cm.publish(b.f);
    }

    debugReturnAliasTest(): void {
        const tainted = TelephonyManager.getDeviceId();
        const b = new B();
        const c = b;
        const a = this.debugAliasMethod(c);
        c.attr.b = tainted;
        b.attr.b = tainted;
        const cm = new ConnectionManager();
        cm.publish(a.b);
    }

    debugAliasMethod(b: B): A {
        return b.attr;
    }

    debugTwoLevelTest(): void {
        const l2 = new SecondLevel();
        const l1 = new FirstLevel();

        const x = l1.getValue(l2, TelephonyManager.getDeviceId());
        const y = l1.getValue(l2, 'test');
        x.toString();
        const cm = new ConnectionManager();
        cm.publish(y);
    }

    debugFooB(b1: B, b2: B): void {
        this.b1 = b1;
        this.b2 = b2;
    }

    debugBarA(a: A): A {
        this.b1!.attr = a;
        return this.b2!.attr;
    }

    debugTestAliases(): void {
        const b = new B();
        const a = new A();
        a.b = TelephonyManager.getDeviceId();

        this.debugFooB(b, b);
        const tainted = this.debugBarA(a).b;

        const cm = new ConnectionManager();
        cm.publish(tainted);
    }

    debugFunctionAliasTest(): void {
        const tainted = TelephonyManager.getDeviceId();
        const dc1 = new DataClass();
        const dc2 = new DataClass();
        dc1.data = tainted;
        this.debugCopy(dc1, dc2);
        const cm = new ConnectionManager();
        cm.publish(dc2.data);
    }

    private debugCopy(pdc1: DataClass, pdc2: DataClass): void {
        pdc2.data = pdc1.data;
    }

    debugFieldBaseOverwriteTest(): void {
        const a = new A();
        a.b = TelephonyManager.getDeviceId();
        const a2 = a;
        const cm = new ConnectionManager();
        cm.publish(a2.b);
    }

    private debugAliasA(a: A): A {
        return a;
    }

    debugDoubleAliasTest(): void {
        const a = new A();
        const b = this.debugAliasA(a);
        const c = this.debugAliasA(a);
        a.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(b.b);
        cm.publish(c.b);
    }

    debugUnAliasParameterTest(): void {
        const b1 = new B();
        const b2 = new B();

        b2.attr = b1.attr;
        this.debugDoUnalias(b2);
        b1.attr.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(b2.attr.b);
    }

    private debugDoUnalias(b2: B): void {
        b2.attr = new A();
    }

    debugCallSiteCreatesAlias(): void {
        const tainted = TelephonyManager.getDeviceId();

        const book1 = new Book();
        this.debugLeakingCallee(tainted, new Book(), book1);
        this.debugLeakingCallee(tainted, book1, book1);
    }

    debugLeakingCallee(tainted: string, book1: Book, book2: Book): void {
        book1.name = tainted;
        const cm = new ConnectionManager();
        cm.publish(book2.name);
    }

    private debugDoWrite(base: Container2, string: string): void {
        base.f!.g = string;
    }

    debugSummaryTest1(): void {
        const base1 = new Container2();
        const base2 = new Container2();
        base1.f = new Container1();
        base2.f = new Container1();
        const tainted = TelephonyManager.getDeviceId();
        this.debugDoWrite(base1, tainted);

        const z = base2.f;
        this.debugDoWrite(base2, tainted);

        const cm = new ConnectionManager();
        cm.publish(z!.g);
    }

    debugOverwriteAliasedVariableTest5(): void {
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

    debugLhsNotUpwardsInAliasFlow(): void {
        this.alias = new Book();

        const book = new Book();
        const alias2 = this.alias;
        this.alias = book;
        book.name = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(alias2.name);
    }

    private debugAliasStatic(): void {
        DebugHeapTest.staticB2!.attr = DebugHeapTest.staticB1!.attr;
    }

    debugStaticAliasTest(): void {
        DebugHeapTest.staticB1 = new B();
        DebugHeapTest.staticB2 = new B();

        this.debugAliasStatic();

        DebugHeapTest.staticB1!.attr.b = TelephonyManager.getDeviceId();

        const cm = new ConnectionManager();
        cm.publish(DebugHeapTest.staticB2!.attr.b);
    }

    debugStaticAliasTest2(): void {
        DebugHeapTest.staticB1 = new B();
        DebugHeapTest.staticB2 = DebugHeapTest.staticB1;
        DebugHeapTest.staticB1!.attr.b = TelephonyManager.getDeviceId();
        const cm = new ConnectionManager();
        cm.publish(DebugHeapTest.staticB2!.attr.b);
    }
}
