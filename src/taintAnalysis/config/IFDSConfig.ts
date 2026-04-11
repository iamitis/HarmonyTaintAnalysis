export class IFDSConfig {

    staticFieldTrackingMode: StaticFieldTrackingMode = StaticFieldTrackingMode.ContextFlowSensitive;

    aliasingStrategy: AliasingStrategy = AliasingStrategy.FlowSensitive;

}

export enum StaticFieldTrackingMode {
    ContextFlowSensitive,
    None
}

export enum AliasingStrategy {
    FlowSensitive,
    None
}

