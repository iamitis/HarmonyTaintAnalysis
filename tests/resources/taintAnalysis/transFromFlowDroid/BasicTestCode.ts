import { AppLocation, ConnectionManager, LocationManager, TelephonyManager, IntegerRef } from "./UtilClasses";

/**
 * Test 1: Parameter overwritten in callee
 * Source: LocationManager.getLastKnownLocation() returns tainted Location
 * Sink: ConnectionManager.publish() with tainted latitude
 * 
 * Expected: NEGATIVE (no leak)
 * Reason: The parameter 'loc' is overwritten in calleeOverwrite(), so original taint is lost
 */
class BasicTestCode {
    overwriteInCalleeTest1(): void {
        let loc: AppLocation = new AppLocation();
        this.calleeOverwrite(loc);

        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLatitude().toString());
    }

    private calleeOverwrite(loc: AppLocation): void {
        console.log(loc);
        loc = LocationManager.getLastKnownLocation();
        console.log(loc);
    }

    /**
     * Test 2: Parameter overwritten to null in callee
     * Source: LocationManager.getLastKnownLocation() returns tainted Location
     * Sink: ConnectionManager.publish() with tainted latitude
     * 
     * Expected: POSITIVE (leak found)
     * Reason: The parameter 'loc' is overwritten to null, but the original Location was tainted
     */
    overwriteInCalleeTest2(): void {
        let loc: AppLocation = LocationManager.getLastKnownLocation();
        this.calleeOverwriteNull(loc);

        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLatitude().toString());
    }

    private calleeOverwriteNull(loc: AppLocation): void {
        console.log(loc);
        loc = null as unknown as AppLocation;
    }

    /**
     * Test 3: Base object overwritten via method call
     * Source: LocationManager.getLongitude() returns tainted longitude
     * Sink: ConnectionManager.publish() with tainted longitude
     * 
     * Expected: NEGATIVE (no leak)
     * Reason: loc.clear() clears the longitude, returning the same object but with cleared field
     */
    overwriteBaseObjectTest1(): void {
        let loc: AppLocation = new AppLocation(LocationManager.getLongitude(), 0);
        loc = loc.clear();
        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLongitude().toString());
    }

    /**
     * Test 4: Base object overwritten via method call returning new object
     * Source: LocationManager.getLongitude() returns tainted longitude
     * Sink: ConnectionManager.publish() with tainted longitude
     * 
     * Expected: NEGATIVE (no leak)
     * Reason: loc.clearLongitude() returns a new Location object with cleared longitude
     */
    overwriteBaseObjectTest2(): void {
        let loc: AppLocation = new AppLocation(LocationManager.getLongitude(), LocationManager.getLongitude());
        loc = loc.clearLongitude();
        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLongitude().toString());
    }

    /**
     * Test 5: Simple arithmetic with tainted value
     * Source: TelephonyManager.getIMEI() returns tainted integer
     * Sink: ConnectionManager.publish() with tainted integer
     * 
     * Expected: POSITIVE (leak found)
     * Reason: Taint should propagate through arithmetic operations
     */
    simpleArithmeticTest1(): void {
        let i: number = TelephonyManager.getIMEI();
        i++;
        let cm: ConnectionManager = new ConnectionManager();
        cm.publishInt(i);
    }

    /**
     * Test 6: Arithmetic in loop
     * Source: TelephonyManager.getIMEI() returns tainted integer
     * Sink: ConnectionManager.publish() with tainted integer after loop
     * 
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through loop iterations
     */
    arithmeticLoopTest1(): void {
        let i: number = TelephonyManager.getIMEI();
        while (i < 100) {
            i = this.increment(i);
        }
        let cm: ConnectionManager = new ConnectionManager();
        cm.publishInt(i);
    }

    /**
     * Test 7: Swapped variables in loop
     * Source: TelephonyManager.getIMEI() returns tainted integer
     * Sink: ConnectionManager.publish() with tainted integer after loop
     * 
     * Expected: POSITIVE (leak found)
     * Reason: Even with variable swapping, taint should propagate
     */
    arithmeticLoopTest2(): void {
        let j: number = 0;
        let i: number = TelephonyManager.getIMEI();
        while (i < 100) {
            i = j;
            j = this.increment(i);
        }
        let cm: ConnectionManager = new ConnectionManager();
        cm.publishInt(i);
    }

    private increment(i: number): number {
        return i + 1;
    }

    /**
     * Test 8: Basic alias test
     * Source: TelephonyManager.getIMEI() returns tainted integer
     * Sink: ConnectionManager.publish() with tainted value through alias
     *
     * Expected: POSITIVE (leak found)
     * Reason: Taint propagates through alias 'j' to 'i.value'
     */
    basicAliasTest(): void {
        let i: IntegerRef = new IntegerRef();
        let j: IntegerRef = i;
        j.value = TelephonyManager.getIMEI();

        let cm: ConnectionManager = new ConnectionManager();
        cm.publishInt(i.value);
    }

    /**
     * Test 9: Simple source-to-sink
     * Source: LocationManager.getLastKnownLocation() returns tainted Location
     * Sink: ConnectionManager.publish() with tainted latitude
     * 
     * Expected: POSITIVE (leak found)
     * Reason: Direct taint propagation from source to sink
     */
    simpleTest(): void {
        let loc: AppLocation = LocationManager.getLastKnownLocation();
        let cm: ConnectionManager = new ConnectionManager();
        cm.publish(loc.getLatitude().toString());
    }
}
