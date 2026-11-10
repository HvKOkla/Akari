
export interface Position {
    line: number;
    column: number;
}

export interface Token extends Position {
    type: string;
    value: unknown;
}

export interface AkariOptions {
    maxIterations?: number;
    timeout?: number;
    allow?: string[];
}