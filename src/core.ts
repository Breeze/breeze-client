/** See if this comment will make it into .d.ts */
import { BreezeEnum } from './enum';
declare var global: any;
declare var window: any;

export interface ErrorCallback {
    (error: Error): void;
}

export interface Callback {
    (data: any): void;
}

// type Predicate = (i: any) => boolean;
type Predicate<T> = (i: T) => boolean;

let hasOwnProperty: (obj: Object, key: string) => boolean = uncurry(Object.prototype.hasOwnProperty);
let arraySlice: (ar: any[], start?: number, end?: number) => any[] = uncurry(Array.prototype.slice);
let isES5Supported: boolean = function () {
    try {
        return !!(Object.getPrototypeOf && Object.defineProperty({}, 'x', {}));
    } catch (e) {
        return false;
    }
} ();

// iterate over object
function objectForEach(obj: Object, kvFn: (key: string, val: any) => any) {
    for (let key in obj) {
        if (hasOwnProperty(obj, key)) {
            kvFn(key, obj[key]);
        }
    }
}

function objectMap(obj: Object, kvFn?: (key: string, val: any) => any): any[] {
    let results: any[] = [];
    for (let key in obj) {
        if (hasOwnProperty(obj, key)) {
            let result = kvFn ? kvFn(key, obj[key]) : obj[key];
            if (result !== undefined) {
                results.push(result);
            }
        }
    }
    return results;
}

function objectFirst(obj: Object, kvPredicate: (key: string, val: any) => boolean): { key: string, value: any } | null {
    for (let key in obj) {
        if (hasOwnProperty(obj, key)) {
            let value = obj[key];
            if (kvPredicate(key, value)) {
                return { key: key, value: value };
            }
        }
    }
    return null;
}

function arrayFlatMap<T, U>(arr: T[], mapFn: (arg: T) => U[]) {
    return Array.prototype.concat.apply([], arr.map(mapFn)) as U[];
}

function isSettable(obj: Object, propertyName: string): boolean {
    let pd = getPropDescriptor(obj, propertyName);
    if (pd == null) return true;
    return !!(pd.writable || pd.set);
}

function getPropDescriptor(obj: Object, propertyName: string): PropertyDescriptor | undefined {
    if (!isES5Supported) return undefined;

    if (obj.hasOwnProperty(propertyName)) {
        return Object.getOwnPropertyDescriptor(obj, propertyName);
    } else {
        let nextObj = Object.getPrototypeOf(obj);
        if (nextObj == null) return undefined;
        return getPropDescriptor(nextObj, propertyName);
    }
}

// Functional extensions

/** can be used like: persons.filter(propEq("firstName", "John")) */
function propEq(propertyName: string, value: any): (obj: Object) => boolean {
    return function (obj: any) {
        return obj[propertyName] === value;
    };
}

/** can be used like: persons.filter(propEq("firstName", "FirstName", "John")) */
function propsEq(property1Name: string, property2Name: string, value: any): (obj: Object) => boolean {
    return function (obj: any) {
        return obj[property1Name] === value || obj[property2Name] === value;
    };
}

/** can be used like persons.map(pluck("firstName")) */
function pluck(propertyName: any): (obj: Object) => any {
    return function (obj: any) {
        return obj[propertyName];
    };
}

// end functional extensions

/** Return an array of property values from source */
function getOwnPropertyValues(source: Object): any[] {
    let result: any[] = [];
    for (let name in source) {
        if (hasOwnProperty(source, name)) {
            result.push(source[name]);
        }
    }
    return result;
}

/** Copy properties from source to target. Returns target. */
function extend(target: Object, source: Object, propNames?: string[]): Object {
    if (!source) return target;
    if (propNames) {
        propNames.forEach(function (propName) {
            target[propName] = source[propName];
        });
    } else {
        for (let propName in source) {
            if (hasOwnProperty(source, propName)) {
                target[propName] = source[propName];
            }
        }
    }
    return target;
}

/** Copy properties from defaults iff undefined on target.  Returns target. */
function updateWithDefaults(target: Object, defaults: Object): any {
    for (let name in defaults) {
        if (target[name] === undefined) {
            target[name] = defaults[name];
        }
    }
    return target;
}

/** Set ctor.defaultInstance to an instance of ctor with properties from target.
    We want to insure that the object returned by ctor.defaultInstance is always immutable
    Use 'target' as the primary template for the ctor.defaultInstance;
    Use current 'ctor.defaultInstance' as the template for any missing properties
    creates a new instance for ctor.defaultInstance
    returns target unchanged */
function setAsDefault(target: Object, ctor: { new (...args: any[]): any, defaultInstance?: any }): any {
    ctor.defaultInstance = updateWithDefaults(new ctor(target), ctor.defaultInstance);
    return target;
}

/**
    'source' is an object that will be transformed into another
    'template' is a map where the
       keys: are the keys to return
         if a key contains ','s then the key is treated as a delimited string with first of the
         keys being the key to return and the others all valid aliases for this key
       'values' are either
           1) the 'default' value of the key
           2) a function that takes in the source value and should return the value to set
         The value from the source is then set on the target,
         after first passing thru the fn, if provided, UNLESS:
           1) it is the default value
           2) it is undefined ( nulls WILL be set)
    'target' is optional
       - if it exists then properties of the target will be set ( overwritten if the exist)
       - if it does not exist then a new object will be created as filled.
    'target is returned.
*/
function toJson(source: Object, template: Object, target: Object = {}): Object {

    for (let key in template) {
        let aliases = key.split(",");
        let defaultValue = template[key];
        // using some as a forEach with a 'break'
        aliases.some(function (propName) {
            if (!(propName in source)) return false;
            let value = source[propName];
            // there is a functional property defined with this alias ( not what we want to replace).
            if (typeof value === 'function') return false;
            // '==' is deliberate here - idea is that null or undefined values will never get serialized
            // if default value is set to null.
            // tslint:disable-next-line
            if (value == defaultValue) return true;
            if (Array.isArray(value) && value.length === 0) return true;
            if (typeof (defaultValue) === "function") {
                value = defaultValue(value);
            } else if (typeof (value) === "object") {
                if (value && value instanceof BreezeEnum) {
                    value = value.name;
                }
            }
            if (value === undefined) return true;
            target[aliases[0]] = value;
            return true;
        });
    }
    return target;
}

/** Replacer function for toJSONSafe, when serializing entities.  Excludes entityAspect and other internal properties. */
function toJSONSafeReplacer(prop: string, val: any) {
    if (prop === "entityAspect" || prop === "complexAspect" || prop === "entityType" || prop === "complexType"
        || prop === "getProperty" || prop === "setProperty"
        || prop === "constructor" || prop.charAt(0) === '_' || prop.charAt(0) === '$') return;
    return val;
}

/** Safely perform toJSON logic on objects with cycles. */
function toJSONSafe(obj: any, replacer?: (prop: string, value: any) => any): any {
    if (obj !== Object(obj)) return obj; // primitive value
    if (obj._$visited) return undefined;
    if (obj.toJSON) {
        let newObj = obj.toJSON();
        if (newObj !== Object(newObj)) return newObj; // primitive value
        if (newObj !== obj) return toJSONSafe(newObj, replacer);
        // toJSON returned the object unchanged.
        obj = newObj;
    }
    obj._$visited = true;
    let result: any;
    if (obj instanceof Array) {
        result = obj.map(function (o: any) {
            return toJSONSafe(o, replacer);
        });
    } else if (typeof (obj) === "function") {
        result = undefined;
    } else {
        result = {};
        for (let prop in obj) {
            if (prop === "_$visited") continue;
            let val = obj[prop];
            if (replacer) {
                val = replacer(prop, val);
                if (val === undefined) continue;
            }
            val = toJSONSafe(val, replacer);
            if (val === undefined) continue;
            result[prop] = val;
        }
    }
    delete obj._$visited;
    return result;
}

/** Resolves the values of a list of properties by checking each property in multiple sources until a value is found. */
function resolveProperties(sources: Object[], propertyNames: string[]): any {
    let r = {};
    let length = sources.length;
    propertyNames.forEach(function (pn) {
        for (let i = 0; i < length; i++) {
            let src = sources[i];
            if (src) {
                let val = src[pn];
                if (val !== undefined) {
                    r[pn] = val;
                    break;
                }
            }
        }
    });
    return r;
}


// array functions

function toArray(item: any): any[] {
    if (item == null) {
        return [];
    } else if (Array.isArray(item)) {
        return item;
    } else {
        return [item];
    }
}

/** a version of Array.map that doesn't require an array, i.e. works on arrays and scalars. */
// function map<T, U>(items: T | T[], fn: (v: T, ix?: number) => U, includeNull?: boolean): U | U[] {
 function map<T>(items: T | T[], fn: (v: T, ix?: number) => any, includeNull?: boolean): any | any[] {
    // whether to return nulls in array of results; default = true;
    includeNull = includeNull == null ? true : includeNull;
    if (items == null) return items;
    // let result: U[];
    if (Array.isArray(items)) {
        let result: any[] = [];
        items.forEach(function (v: any, ix: number) {
            let r = fn(v, ix);
            if (r != null || includeNull) {
                result[ix] = r;
            }
        });
        return result;
    } else {
        let result = fn(items);
        return result;
    }

}

/** Return first element matching predicate */
function arrayFirst<T>(array: T[], predicate: Predicate<any>): T;
function arrayFirst<T>(array: T[], predicate: Predicate<T>) {
    for (let i = 0, j = array.length; i < j; i++) {
        if (predicate(array[i])) {
            return array[i];
        }
    }
    return null;
}

/** Return index of first element matching predicate */
function arrayIndexOf<T>(array: T[], predicate: Predicate<any>): number;
function arrayIndexOf<T>(array: T[], predicate: Predicate<T>): number {
    for (let i = 0, j = array.length; i < j; i++) {
        if (predicate(array[i])) return i;
    }
    return -1;
}

/** Add item if not already in array */
function arrayAddItemUnique<T>(array: T[], item: T) {
    let ix = array.indexOf(item);
    if (ix === -1) array.push(item);
}

/** Remove items from the array
 * @param array
 * @param predicateOrItem - item to remove, or function to determine matching item
 * @param shouldRemoveMultiple - true to keep removing after first match, false otherwise
 */
function arrayRemoveItem<T>(array: T[], predicateOrItem: T | Predicate<T> , shouldRemoveMultiple?: boolean) {
    let predicate = (isFunction(predicateOrItem) ? predicateOrItem : undefined) as Predicate<T>;
    let lastIx = array.length - 1;
    let removed = false;
    for (let i = lastIx; i >= 0; i--) {
        if (predicate ? predicate(array[i]) : (array[i] === predicateOrItem)) {
            array.splice(i, 1);
            removed = true;
            if (!shouldRemoveMultiple) {
                return true;
            }
        }
    }
    return removed;
}

/** Combine array elements using the callback.  Returns array with length == min(a1.length, a2.length) */
function arrayZip(a1: any[], a2: any[], callback: (x1: any, x2: any) => any): any[] {
    let result: any[] = [];
    let n = Math.min(a1.length, a2.length);
    for (let i = 0; i < n; ++i) {
        result.push(callback(a1[i], a2[i]));
    }
    return result;
}

//function arrayDistinct(array) {
//    array = array || [];
//    let result = [];
//    for (let i = 0, j = array.length; i < j; i++) {
//        if (result.indexOf(array[i]) < 0)
//            result.push(array[i]);
//    }
//    return result;
//}

// Not yet needed
//// much faster but only works on array items with a toString method that
//// returns distinct string for distinct objects.  So this is safe for arrays with primitive
//// types but not for arrays with object types, unless toString() has been implemented.
//function arrayDistinctUnsafe(array) {
//    let o = {}, i, l = array.length, r = [];
//    for (i = 0; i < l; i += 1) {
//        let v = array[i];
//        o[v] = v;
//    }
//    for (i in o) r.push(o[i]);
//    return r;
//}

function arrayEquals(a1: any[], a2: any[], equalsFn?: (x1: any, x2: any) => boolean): boolean {
    //Check if the arrays are undefined/null
    if (!a1 || !a2) return false;

    if (a1.length !== a2.length) return false;

    //go thru all the vars
    for (let i = 0; i < a1.length; i++) {
        //if the let is an array, we need to make a recursive check
        //otherwise we'll just compare the values
        if (Array.isArray(a1[i])) {
            if (!arrayEquals(a1[i], a2[i])) return false;
        } else {
            if (equalsFn) {
                if (!equalsFn(a1[i], a2[i])) return false;
            } else {
                if (a1[i] !== a2[i]) return false;
            }
        }
    }
    return true;
}

// end of array functions

/** Returns an array for a source and a prop, and creates the prop if needed. */
function getArray(source: Object, propName: string): any[] {
    let arr = source[propName];
    if (!arr) {
        arr = [];
        source[propName] = arr;
    }
    return arr;
}

/** Calls requireLibCore on semicolon-separated libNames */
function requireLib(libNames: string, errMessage?: string) {
    let arrNames = libNames.split(";");
    for (let i = 0, j = arrNames.length; i < j; i++) {
        let lib = requireLibCore(arrNames[i]);
        if (lib) return lib;
    }
    if (errMessage) {
        throw new Error("Unable to initialize " + libNames + ".  " + errMessage);
    }
}



/** Returns the 'libName' module if loaded or else returns undefined */
function requireLibCore(libName: string) {
    let win = window || (global ? global.window : undefined);
    if (!win) return; // Must run in a browser. Todo: add commonjs support

    // get library from browser globals if we can
    let lib = win[libName];
    if (lib) return lib;

    // if require exists, maybe require can get it.
    // This method is synchronous so it can't load modules with AMD.
    // It can only obtain modules from require that have already been loaded.
    // Developer should bootstrap such that the breeze module
    // loads after all other libraries that breeze should find with this method
    // See documentation
    let r = win.require;
    if (r) { // if require exists
        if (r.defined) { // require.defined is not standard and may not exist
            // require.defined returns true if module has been loaded
            return r.defined(libName) ? r(libName) : undefined;
        } else {
            // require.defined does not exist so we have to call require('libName') directly.
            // The require('libName') overload is synchronous and does not load modules.
            // It throws an exception if the module isn't already loaded.
            try {
                return r(libName);
            } catch (e) {
                // require('libName') threw because module not loaded
                return;
            }
        }
    }
}

/** Execute fn while obj has tempValue for property */
function using(obj: Object, property: string, tempValue: any, fn: () => any) {
    let originalValue = obj[property];
    if (tempValue === originalValue) {
        return fn();
    }
    obj[property] = tempValue;
    try {
        return fn();
    } finally {
        if (originalValue === undefined) {
            delete obj[property];
        } else {
            obj[property] = originalValue;
        }
    }
}

/** Call state = startFn(), call fn(), call endFn(state) */
function wrapExecution(startFn: () => any, endFn: (state: any) => any, fn: () => any) {
    let state: any;
    try {
        state = startFn();
        return fn();
    } catch (e) {
        if (typeof (state) === 'object') {
            state.error = e;
        }
        throw e;
    } finally {
        endFn(state);
    }
}

/** Remember & return the value of fn() when it was called with its current args */
function memoize(fn: any): any {
    return function () {
        let args = arraySlice(<any>arguments),
            hash = "",
            i = args.length,
            currentArg: any = null;
        while (i--) {
            currentArg = args[i];
            hash += (currentArg === Object(currentArg)) ? JSON.stringify(currentArg) : currentArg;
            fn.memoize || (fn.memoize = {});
        }
        return (hash in fn.memoize) ?
            fn.memoize[hash] :
            fn.memoize[hash] = fn.apply(this, args);
    };
}

function getUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        // tslint:disable-next-line
        let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function durationToSeconds(duration: string) {
    // basic algorithm from https://github.com/nezasa/iso8601-js-period
    if (typeof duration !== "string") throw new Error("Invalid ISO8601 duration '" + duration + "'");

    // regex splits as follows - grp0, grp1, y, m, d, grp2, h, m, s
    //                           0     1     2  3  4  5     6  7  8
    let struct = /^P((\d+Y)?(\d+M)?(\d+D)?)?(T(\d+H)?(\d+M)?(\d+S)?)?$/.exec(duration);
    if (!struct) throw new Error("Invalid ISO8601 duration '" + duration + "'");

    let ymdhmsIndexes = [2, 3, 4, 6, 7, 8]; // -> grp1,y,m,d,grp2,h,m,s
    let factors = [31104000, // year (360*24*60*60)
        2592000,             // month (30*24*60*60)
        86400,               // day (24*60*60)
        3600,                // hour (60*60)
        60,                  // minute (60)
        1];                  // second (1)

    let seconds = 0;
    for (let i = 0; i < 6; i++) {
        let digit = struct[ymdhmsIndexes[i]];
        // remove letters, replace by 0 if not defined
        digit = <any>(digit ? +digit.replace(/[A-Za-z]+/g, '') : 0);
        seconds += <any>digit * factors[i];
    }
    return seconds;

}

// is functions

function noop() {
    // does nothing
}

function identity(x: any): any {
    return x;
}

function classof(o: any) {
    if (o === null) {
        return "null";
    }
    if (o === undefined) {
        return "undefined";
    }
    return Object.prototype.toString.call(o).slice(8, -1).toLowerCase();
}

function isDate(o: any) {
    return classof(o) === "date" && !isNaN(o.getTime());
}

function isDateString(s: string) {
    // let rx = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/;
    let rx = /^((\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)))$/;
    return (typeof s === "string") && rx.test(s);
}

function isFunction(o: any) {
    return classof(o) === "function";
}

// function isString(o: any) {
//     return (typeof o === "string");
// }

// function isObject(o: any) {
//     return (typeof o === "object");
// }

function isGuid(value: any) {
    return (typeof value === "string") && /[a-fA-F\d]{8}-(?:[a-fA-F\d]{4}-){3}[a-fA-F\d]{12}/.test(value);
}

function isDuration(value: any) {
    return (typeof value === "string") && /^(-|)?P[T]?[\d\.,\-]+[YMDTHS]/.test(value);
}

function isEmpty(obj: any) {
    if (obj === null || obj === undefined) {
        return true;
    }
    for (let key in obj) {
        if (hasOwnProperty(obj, key)) {
            return false;
        }
    }
    return true;
}

function isNumeric(n: any) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}



// end of is Functions

// string functions

function stringStartsWith(str: string, prefix: string) {
    // returns true for empty string or null prefix
    if ((!str)) return false;
    if (prefix === "" || prefix == null) return true;
    return str.indexOf(prefix, 0) === 0;
}

function stringEndsWith(str: string, suffix: string) {
    // returns true for empty string or null suffix
    if ((!str)) return false;
    if (suffix === "" || suffix == null) return true;
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Based on fragment from Dean Edwards' Base 2 library
/** format("a %1 and a %2", "cat", "dog") -> "a cat and a dog" */
function formatString(str: string, ...params: any[]) {
    let args = arguments;
    let pattern = RegExp("%([1-" + (arguments.length - 1) + "])", "g");
    return str.replace(pattern, function (match, index) {
        return args[index];
    });
}

// See http://stackoverflow.com/questions/7225407/convert-camelcasetext-to-camel-case-text
/** Change text to title case with spaces, e.g. 'myPropertyName12' to 'My Property Name 12' */
let camelEdges = /([A-Z](?=[A-Z][a-z])|[^A-Z](?=[A-Z])|[a-zA-Z](?=[^a-zA-Z]))/g;
function titleCaseSpace(text: string) {
    text = text.replace(camelEdges, '$1 ');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text;
}

// end of string functions

// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
function uncurry(f: any) {
    let call = Function.call;
    return function () {
        return call.apply(f, arguments);
    };
}

// shims

if (!Object.create) {
    Object.create = function (parent: any) {
        let F = <any>function () {
        };
        F.prototype = parent;
        return new F();
    };
}

// // not all methods above are exported
export const core = {
    isES5Supported: isES5Supported,
    hasOwnProperty: hasOwnProperty,
    getOwnPropertyValues: getOwnPropertyValues,
    getPropertyDescriptor: getPropDescriptor,
    objectForEach: objectForEach,
    objectFirst: objectFirst,
    objectMap: objectMap, // TODO: replace this with something strongly typed.
    extend: extend,
    propEq: propEq,
    propsEq: propsEq,
    pluck: pluck,
    map: map,
    resolveProperties: resolveProperties,
    setAsDefault: setAsDefault,
    updateWithDefaults: updateWithDefaults,
    getArray: getArray,
    toArray: toArray,
    arrayEquals: arrayEquals,
    arraySlice: arraySlice,
    arrayFirst: arrayFirst,
    arrayIndexOf: arrayIndexOf,
    arrayRemoveItem: arrayRemoveItem,
    arrayZip: arrayZip,
    arrayAddItemUnique: arrayAddItemUnique,
    arrayFlatMap: arrayFlatMap,

    requireLib: requireLib,
    using: using,
    wrapExecution: wrapExecution,

    memoize: memoize,
    getUuid: getUuid,
    durationToSeconds: durationToSeconds,

    isSettable: isSettable,

    isDate: isDate,
    isDateString: isDateString,
    isGuid: isGuid,
    isDuration: isDuration,
    isFunction: isFunction,
    isEmpty: isEmpty,
    isNumeric: isNumeric,

    identity: identity,
    noop: noop,

    stringStartsWith: stringStartsWith,
    stringEndsWith: stringEndsWith,
    formatString: formatString,
    titleCase: titleCaseSpace,

    toJson: toJson,
    toJSONSafe: toJSONSafe,
    toJSONSafeReplacer: toJSONSafeReplacer,
};

export interface ErrorCallback {
    (error: any): void;
}


// Unused
/*
// returns true for booleans, numbers, strings and dates
// false for null, and non-date objects, functions, and arrays
function isPrimitive(obj: any) {
    if (obj == null) return false;
    // true for numbers, strings, booleans and null, false for objects
    if (obj != Object(obj)) return true;
    return isDate(obj);
}

*/