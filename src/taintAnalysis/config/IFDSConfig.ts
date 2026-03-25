export class IFDSConfig {

    staticFieldTrackingMode: StaticFieldTrackingMode = StaticFieldTrackingMode.None;

    aliasingStrategy: AliasingStrategy = AliasingStrategy.None;

}

export enum StaticFieldTrackingMode {
    ContextFlowSensitive,
    None
}

export enum AliasingStrategy {
    FlowSensitive,
    None
}

