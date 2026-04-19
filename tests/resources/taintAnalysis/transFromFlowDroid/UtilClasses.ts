export class LocationManager {
    static getLongitude(): number {
        return 3.1415;
    }

    static getLastKnownLocation(): AppLocation {
        return new AppLocation();
    }
}

export class AppLocation {
    private longitude: number = 0;
    private latitude: number = 0;

    constructor();
    constructor(longitude: number, latitude: number);
    constructor(longitude?: number, latitude?: number) {
        if (longitude !== undefined && latitude !== undefined) {
            this.longitude = longitude;
            this.latitude = latitude;
        }
    }

    getLongitude(): number {
        return this.longitude;
    }

    getLatitude(): number {
        return this.latitude;
    }

    clear(): AppLocation {
        this.longitude = 0;
        this.latitude = 0;
        return this;
    }

    clearLongitude(): AppLocation {
        this.longitude = 0;
        return new AppLocation();
    }

    setLongitude(longitude: number): void {
        this.longitude = longitude;
    }
}

export class TelephonyManager {
    static getDeviceId(): string {
        return "I1t359-f";
    }

    static getIMEI(): number {
        return 123;
    }

    static getIMSI(): number {
        return 321;
    }
}

export class ConnectionManager {
    publish(str: string): void {
        console.log(str);
    }

    publishInt(i: number): void {
        console.log(i.toString());
    }

    publishBoolean(b: boolean): void {
        console.log(b.toString());
    }

    publishDouble(dbl: number): void {
        console.log(dbl.toString());
    }
}

export class IntegerRef {
    value: number = 0;
}

export class ClassWithField {
    listField: string[] = [];
    field: string = '';
}

export class ClassWithStatic {
    static staticString: string = '';

    getTitle(): string {
        return ClassWithStatic.staticString;
    }
}

export class AccountManager {
    getPassword(): string {
        return 'secret-password';
    }
}