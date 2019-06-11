import { core } from './core';
import { assertParam  } from './assert-param';
import { BreezeEvent } from './event';

/** @hidden */
export interface AdapterCtor<T extends BaseAdapter> { new (...args: any[]): T; }
/** @hidden */
export interface IDef<T extends BaseAdapter> { ctor: AdapterCtor<T>; defaultInstance?: T; }

export type AdapterType = 'dataService'|'modelLibrary'|'ajax'|'uriBuilder';

export class InterfaceDef<T extends BaseAdapter> {

    name: string;
    defaultInstance?: T;
    /** @hidden @internal */
    _implMap: { [name: string]: IDef<T> };

    constructor(name: string) {
        this.name = name;
        this.defaultInstance = undefined;
        this._implMap = {};
    }

    /** Define an implementation of the given adaptername */
    registerCtor(adapterName: string, ctor: AdapterCtor<T>): void {
        this._implMap[adapterName.toLowerCase()] = { ctor: ctor, defaultInstance: undefined };
    }

    /** Return the definition for the given adapterName */
    getImpl(adapterName: string): IDef<T> {
        return this._implMap[adapterName.toLowerCase()];
    }

    /** Return the first implementation for this InterfaceDef */
    getFirstImpl(): IDef<T> {
        let kv = core.objectFirst(this._implMap, function () {
            return true;
        });
        return kv ? kv.value : null;
    }

    getDefaultInstance() {
        return this.defaultInstance as T;
    }
}

export interface BaseAdapter {
    /** @hidden @internal */
    _$impl?: any;
    name: string;
    initialize(): void;
    checkForRecomposition?: (context: any) => void;
}

export class BreezeConfig {
    functionRegistry = {};
    typeRegistry = {};
    objectRegistry = {};
    interfaceInitialized: BreezeEvent<{ interfaceName: string, instance: BaseAdapter, isDefault: boolean }>;

    stringifyPad = '';
    /** @hidden @internal */
    _interfaceRegistry: any;  // will be set in adapter-interfaces. untyped here to avoid circularity issues.

    constructor() {
        this.interfaceInitialized = new BreezeEvent("interfaceInitialized", this);
    }

    /**
    Method use to register implementations of standard breeze interfaces.  Calls to this method are usually
    made as the last step within an adapter implementation.
    @method registerAdapter
    @param interfaceName {String} - one of the following interface names "ajax", "dataService" or "modelLibrary"
    @param adapterCtor {Function} - an ctor function that returns an instance of the specified interface.
    **/
    registerAdapter<T extends BaseAdapter>(interfaceName: AdapterType, adapterCtor: AdapterCtor<T>) {
        assertParam(interfaceName, "interfaceName").isNonEmptyString().check();
        assertParam(adapterCtor, "adapterCtor").isFunction().check();
        // this impl will be thrown away after the name is retrieved.
        let impl = new adapterCtor();
        let implName = impl.name;
        if (!implName) {
            throw new Error("Unable to locate a 'name' property on the constructor passed into the 'registerAdapter' call.");
        }
        let idef = this.getInterfaceDef(interfaceName);
        idef.registerCtor(implName, adapterCtor);
    }

    /**
    Returns the ctor function used to implement a specific interface with a specific adapter name.
    @method getAdapter
    @param interfaceName {String} One of the following interface names "ajax", "dataService" or "modelLibrary"
    @param [adapterName] {String} The name of any previously registered adapter. If this parameter is omitted then
    this method returns the "default" adapter for this interface. If there is no default adapter, then a null is returned.
    @return {Function|null} Returns either a ctor function or null.
    **/
    getAdapter(interfaceName: AdapterType, adapterName: string) {
        let idef = this.getInterfaceDef(interfaceName);
        if (adapterName) {
            let impl = idef.getImpl(adapterName);
            return impl ? impl.ctor : null;
        } else {
            return idef.defaultInstance ? idef.defaultInstance._$impl.ctor : null;
        }
    }

    /**
    Initializes a single adapter implementation. Initialization means either newing a instance of the
    specified interface and then calling "initialize" on it or simply calling "initialize" on the instance
    if it already exists.
    @method initializeAdapterInstance
    @param interfaceName {String} The name of the interface to which the adapter to initialize belongs.
    @param adapterName {String} - The name of a previously registered adapter to initialize.
    @param [isDefault=true] {Boolean} - Whether to make this the default "adapter" for this interface.
    @return {an instance of the specified adapter}
    **/
    initializeAdapterInstance(interfaceName: AdapterType, adapterName: string, isDefault: boolean = true) {
        isDefault = isDefault === undefined ? true : isDefault;
        assertParam(interfaceName, "interfaceName").isNonEmptyString().check();
        assertParam(adapterName, "adapterName").isNonEmptyString().check();
        assertParam(isDefault, "isDefault").isBoolean().check();

        let idef = this.getInterfaceDef(interfaceName);
        let impl = idef.getImpl(adapterName);
        if (!impl) {
            throw new Error("Unregistered adapter.  Interface: " + interfaceName + " AdapterName: " + adapterName);
        }

        return this._initializeAdapterInstanceCore(idef, impl, isDefault);
    }

    /**
    Returns the adapter instance corresponding to the specified interface and adapter names.
    @method getAdapterInstance
    @param interfaceName {String} The name of the interface.
    @param [adapterName] {String} - The name of a previously registered adapter.  If this parameter is
    omitted then the default implementation of the specified interface is returned. If there is
    no defaultInstance of this interface, then the first registered instance of this interface is returned.
    @return {an instance of the specified adapter}
    @internal
    **/
    getAdapterInstance<T extends BaseAdapter>(interfaceName: AdapterType, adapterName?: string) {
        let idef = this.getInterfaceDef<T>(interfaceName);
        let impl: IDef<T>;

        let isDefault = adapterName == null || adapterName === "";
        if (isDefault) {
            if (idef.defaultInstance) return idef.defaultInstance;
            impl = idef.getFirstImpl();
        } else {
            impl = idef.getImpl(adapterName!);
        }
        if (!impl) return undefined;
        if (impl.defaultInstance) {
            return impl.defaultInstance;
        } else {
            return this._initializeAdapterInstanceCore(idef, impl, isDefault);
        }
    }

    /** this is needed for reflection purposes when deserializing an object that needs a fn or ctor.
        Used to register validators. */
    registerFunction(fn: Function, fnName: string) {
        assertParam(fn, "fn").isFunction().check();
        assertParam(fnName, "fnName").isString().check();
        if (fn.prototype) {
            fn.prototype._$fnName = fnName;
        }
        this.functionRegistry[fnName] = fn;
    }

    registerType(ctor: Function, typeName: string) {
        assertParam(ctor, "ctor").isFunction().check();
        assertParam(typeName, "typeName").isString().check();
        if (ctor.prototype) {
            ctor.prototype._$typeName = typeName;
        }
        this.typeRegistry[typeName] = ctor;
    }

    getRegisteredFunction(fnName: string) {
        return this.functionRegistry[fnName];
    }

    getInterfaceDef<T extends BaseAdapter>(interfaceName: string) {
        let lcName = interfaceName.toLowerCase();
        // source may be null
        let kv = core.objectFirst(this._interfaceRegistry || {}, function (k, v) {
            return k.toLowerCase() === lcName;
        });
        if (!kv) {
            throw new Error("Unknown interface name: " + interfaceName);
        }
        return <InterfaceDef<T>>kv.value;
    }

    /** @deprecated @internal no-op kept for backward compatibility */
    setQ(q: any) {
        console && console.warn("setQ does nothing; ES6 Promise support is required - use a shim if necessary.");
    }

    /** @hidden @internal */
    _storeObject(obj: Object, type: string | Function, name: string) {
        // uncomment this if we make this public.
        //assertParam(obj, "obj").isObject().check();
        //assertParam(name, "objName").isString().check();
        let key = (typeof (type) === "string" ? type : type.prototype._$typeName) + "." + name;
        this.objectRegistry[key] = obj;
    }

    /** @hidden @internal */
    _fetchObject(type: string | Function, name: string) {
        if (!name) return undefined;
        let key = (typeof (type) === "string" ? type : type.prototype._$typeName) + "." + name;
        let result = this.objectRegistry[key];
        if (!result) {
            throw new Error("Unable to locate a registered object by the name: " + key);
        }
        return result;
    }

    /** @hidden @internal */
    _initializeAdapterInstanceCore<T extends BaseAdapter>(interfaceDef: InterfaceDef<T>, impl: IDef<T>, isDefault: boolean) {
        let instance: T;
        let inst = impl.defaultInstance;
        if (!inst) {
            instance = new (impl.ctor)();
            impl.defaultInstance = instance;
            instance._$impl = impl;
        } else {
            instance = inst;
        }

        instance.initialize();

        if (isDefault) {
            // next line needs to occur before any recomposition
            interfaceDef.defaultInstance = instance;
        }

        // recomposition of other impls will occur here.
        this.interfaceInitialized.publish({ interfaceName: interfaceDef.name, instance: instance, isDefault: true });

        if (instance.checkForRecomposition != null) {
            // now register for own dependencies.
            this.interfaceInitialized.subscribe((interfaceInitializedArgs) => {
                // TODO: why '!'s needed here for typescript to compile correctly???
                instance.checkForRecomposition!(interfaceInitializedArgs);
            });
        }

        return instance;
    }

}

export const config = new BreezeConfig();

// legacy
(core as any).config = config;



