declare module 'papaparse' {
  interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: 'greedy' | boolean;
    transformHeader?: (header: string) => string;
    transform?: (value: string, field: string) => string;
  }

  interface ParseResult<T> {
    data: T[];
    errors: any[];
    meta: any;
  }

  export function parse<T = any>(input: string, config?: ParseConfig): ParseResult<T>;
} 