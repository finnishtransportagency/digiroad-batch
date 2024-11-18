const delay = async (delayTimeMs: number) => new Promise((resolve) => setTimeout(resolve, delayTimeMs));

export const retry = async <T>(
    fn: () => Promise<T>,
    retryIfTest?: (err: Error) => boolean,
    retries = 3,
    delayTimeMs = 5000,
    err?: Error
): Promise<T> => {
    if (!retries) {
        return Promise.reject(err);
    }
    return fn().catch((err: Error) => {
        console.log('err', err);
        if (!retryIfTest || retryIfTest(err)) {
            console.log(`Retries left: ${retries}`);
            return delay(delayTimeMs).then(() => retry(fn, retryIfTest, retries - 1, delayTimeMs, err));
        }
        throw err;
    });
};

export const retryTimeout = async <T>(fn: () => Promise<T>, retries = 3, delayTimeMs = 5000): Promise<T> => {
    const timeoutTest = (err: Error) => {
        console.log(err)
        if ('code' in err) return (err as unknown as { code: string }).code === 'ETIMEDOUT'
        
        return err.message.includes('network timeout') || err.message.includes('Gateway Time-out');
    }
    return retry(fn, timeoutTest, retries, delayTimeMs);
};
// When using in promise, you should be mindfull what you are measuring, are you measuring resolving of promise or actual operation.
// Best to use in non async method.
export const timer = <R>(operationName: string, operation: () => R): R => {
    const begin = performance.now();
    try {
        const result = operation();
        const duration = performance.now() - begin;
        console.log(`Call to ${operationName} took: ${(duration / 1000).toFixed(4)} s.`);
        return result;
    } catch (e: any) {
        const duration = performance.now() - begin;
        console.log(`Call to ${operationName} failed at ${(duration / 1000).toFixed(4)} s.`,e);
        throw e;
    }
    
};

export const chunkData = <T>(array: T[], chunkSize: number): T[][] => {
    const R: T[][] = [];
    for (let i = 0, len = array.length; i < len; i += chunkSize) {
        R.push(array.slice(i, i + chunkSize));
    }
    return R;
};