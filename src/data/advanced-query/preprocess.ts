/* eslint-disable @typescript-eslint/no-explicit-any */
type PreprocessFn = (...args: any[]) => any;

export const preprocessors: Record<string, PreprocessFn> = {
  concat: (...args: string[]) => args.join(""),
  substring: (input: string, start: number, end?: number) =>
    input.substring(start, end),
  toLength: (input: any) => input.length,
  toLower: (input: string) => input.toLocaleLowerCase(),
  toNumber: (input: any) => Number(input),
  toString: (input: any) => input.toString(),
  toUpper: (input: string) => input.toLocaleUpperCase(),
};

export function addPreprocessor(name: string, fn: PreprocessFn) {
  preprocessors[name] = fn;
}

interface ExecuteOptions {
  name: string;
  args: any[];
  defaultValue: unknown;
}

export function preProcess({ name, args, defaultValue }: ExecuteOptions) {
  if (!preprocessors[name]) {
    return defaultValue;
  }

  try {
    return preprocessors[name](...args);
  } catch (e) {
    return defaultValue;
  }
}
