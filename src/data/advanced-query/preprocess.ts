// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PreprocessFn = (...args: any[]) => any;

export const preprocessors: Record<string, PreprocessFn> = {};

export function addPreprocessor(name: string, fn: PreprocessFn) {
  preprocessors[name] = fn;
}

interface ExecuteOptions {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
