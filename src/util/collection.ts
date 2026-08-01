/**
 * Represents a collection that extends the built-in Map class.
 * @template K The type of the keys in the collection.
 * @template V The type of the values in the collection.
 */
export class Collection<K, V> extends Map<K, V> {
    /**
     * Removes elements from the collection based on a filter function.
     * @param fn The filter function that determines which elements to remove.
     * @param thisArg The value to use as `this` when executing the filter function.
     * @returns The number of elements removed from the collection.
     * @example
     * const collection = new Collection<number, string>();
     * collection.set(1, 'one');
     * collection.set(2, 'two');
     * collection.set(3, 'three');
     * const removedCount = collection.sweep((value, key) => key % 2 === 0);
     * console.log(removedCount); // Output: 1
     * console.log(collection.size); // Output: 2
     */
    public sweep(fn: (value: V, key: K, collection: this) => unknown): number {
        if (typeof fn !== "function") throw new TypeError("The filter function must be a function.");

        const previous = this.size;
        for (const [key, val] of this) {
            if (fn(val, key, this)) this.delete(key);
        }
        return previous - this.size;
    }

    /**
     * Creates a new array with the results of calling a provided function on every element in the collection.
     * @param fn The function that produces an element of the new array.
     * @param thisArg The value to use as `this` when executing the map function.
     * @returns A new array with the results of calling the provided function on every element in the collection.
     * @example
     * const collection = new Collection<number, string>();
     * collection.set(1, 'one');
     * collection.set(2, 'two');
     * collection.set(3, 'three');
     * const mappedArray = collection.map((value, key) => `${key}: ${value}`);
     * console.log(mappedArray); // Output: ['1: one', '2: two', '3: three']
     */
    public map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
        if (typeof fn !== "function") throw new TypeError("The filter function must be a function.");

        const result: T[] = [];

        for (const [key, value] of this.entries()) {
            result.push(fn(value, key, this));
        }

        return result;
    }

    /**
     * Creates a new array with all elements that pass the test implemented by the provided function.
     * @param fn The function to test each element of the collection.
     * @param thisArg The value to use as `this` when executing the filter function.
     * @returns A new array with the elements that pass the test.
     * @example
     * const collection = new Collection<number, string>();
     * collection.set(1, 'one');
     * collection.set(2, 'two');
     * collection.set(3, 'three');
     * const filteredArray = collection.filter((value, key) => key % 2 === 0);
     * console.log(filteredArray); // Output: ['two']
     */
    public filter(fn: (value: V, key: K, collection: this) => boolean): V[] {
        if (typeof fn !== "function") throw new TypeError("The filter function must be a function.");

        const result: V[] = [];

        for (const [key, value] of this.entries()) {
            if (fn(value, key, this)) result.push(value);
        }

        return result;
    }

    /**
     * Tests whether at least one element in the collection passes the test implemented by the provided function.
     * @param fn The function to test each element of the collection.
     * @returns `true` if the callback returns truthy for any element, otherwise `false`.
     * @example
     * const collection = new Collection<number, string>();
     * collection.set(1, 'one');
     * collection.set(2, 'two');
     * collection.set(3, 'three');
     * const hasEvenKey = collection.some((_, key) => key % 2 === 0);
     * console.log(hasEvenKey); // Output: true
     */
    public some(fn: (value: V, key: K, collection: this) => boolean): boolean {
        if (typeof fn !== "function") throw new TypeError("The filter function must be a function.");

        for (const [key, value] of this.entries()) {
            if (fn(value, key, this)) return true;
        }

        return false;
    }

    /**
     * Returns the value of the first element in the collection that satisfies the provided testing function.
     * @param fn The function to test each element of the collection.
     * @returns The value of the first element that passes the test. `undefined` if no element passes the test.
     * @example
     * const collection = new Collection<number, number>();
     * collection.set(1, 1);
     * collection.set(2, 2);
     * collection.set(3, 3);
     * const firstEvenValue = collection.find(value => value % 2 === 0);
     * console.log(firstEvenValue); // Output: 2
     */
    public find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
        if (typeof fn !== "function") throw new TypeError("The filter function must be a function.");

        for (const [key, value] of this.entries()) {
            if (fn(value, key, this)) {
                return value;
            }
        }

        return undefined;
    }
}
