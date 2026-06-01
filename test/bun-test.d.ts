declare module "bun:test" {
  type AsyncOrSync = () => void | Promise<void>;

  export const describe: (name: string, callback: AsyncOrSync) => void;
  export const test: (name: string, callback: AsyncOrSync) => void;
  export const beforeEach: (callback: AsyncOrSync) => void;

  export const mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };

  export interface RejectionMatchers {
    toThrow(expected?: string | RegExp | Error | ((error: unknown) => boolean)): Promise<void> | void;
  }

  export interface Matchers<T = unknown> {
    toBe(expected: T): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toEqual<TArg>(expected: TArg): void;
    toStartWith(prefix: string): void;
    toThrow(expected?: string | RegExp | Error | ((error: unknown) => boolean)): Promise<void> | void;
    rejects: RejectionMatchers;
  }

  export function expect<T = unknown>(value: T): Matchers<T>;
}
