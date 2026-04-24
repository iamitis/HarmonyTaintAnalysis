export class IFDSConfig {

    staticFieldTrackingMode: StaticFieldTrackingMode = StaticFieldTrackingMode.ContextFlowSensitive;

    aliasingStrategy: AliasingStrategy = AliasingStrategy.FlowSensitive;

    optimize: boolean = process.env.OPTIMIZE === 'true' || process.env.OPT === 'true';

}

export enum StaticFieldTrackingMode {
    ContextFlowSensitive,
    None
}

export enum AliasingStrategy {
    FlowSensitive,
    None
}

