export type PromiseResolvers<T> = Parameters<ConstructorParameters<typeof Promise<T>>[0]>;

export type PromiseWithResolvers<T> = {
    promise: Promise<T>;
    reject: PromiseResolvers<T>[1];
    resolve: PromiseResolvers<T>[0];
};
