import { core, ErrorCallback } from './core';
import { config } from './config';
import { BreezeEvent } from './event';
import { assertParam, assertConfig, Param } from './assert-param';
import { DataType } from './data-type';
import { EntityAspect, ComplexAspect, IEntity, IComplexObject, IStructuralObject } from './entity-aspect';
import { EntityKey } from './entity-key';
import { Validator } from './validate';
import { BreezeEnum } from './enum';
import { DataService } from './data-service';
import { NamingConvention } from './naming-convention';
import { CsdlMetadataParser } from './csdl-metadata-parser'; // TODO isolate this later;
import { LocalQueryComparisonOptions } from './local-query-comparison-options';
import { defaultPropertyInterceptor } from './default-property-interceptor';

export type EntityProperty = DataProperty | NavigationProperty;
export type StructuralType = EntityType | ComplexType;

/** @hidden @internal */
export interface IStructuralTypeMap {
  [index: string]: StructuralType;
}

// TODO: consider exposing later
/** @hidden @internal */
export interface IMetadataJson {
  metadataVersion: string;
  name: string;
  namingConvention: string;
  localQueryComparisonOptions: string;
  dataServices: Object[]; // IDataServiceJson[]
  structuralTypes: Object[]; // IStructuralTypeJson[]; 
  resourceEntityTypeMap: Object[]; // IResourceEntityTypeJson[]
  incompleteTypeMap: Object[];
}

/** Configuration info to be passed to the [[MetadataStore]] constructor */
export interface MetadataStoreConfig {
  /** The  [[NamingConvention]] associated with this MetadataStore. */
  namingConvention?: NamingConvention;
  /** The  [[LocalQueryComparisonOptions]] associated with this MetadataStore. */
  localQueryComparisonOptions?: LocalQueryComparisonOptions;
  serializerFn?: (prop: EntityProperty, val: any) => any;
}

export interface IMetadataFetchedEventArgs {
  metadataStore: MetadataStore;
  dataService: DataService | string;
  rawMetadata: any;
}

/**
An instance of the MetadataStore contains all of the metadata about a collection of [[EntityType]]'s.
MetadataStores may be shared across [[EntityManager]]'s.  If an EntityManager is created without an
explicit MetadataStore, the MetadataStore from the MetadataStore.defaultInstance property will be used.

**/
export class MetadataStore {
  /** @hidden @internal */
  _$typeName: string; // on proto

  /** @hidden @internal */
  static __id = 0;
  /** @hidden @internal */
  static ANONTYPE_PREFIX = "_IB_";
  /** The version of any MetadataStores created by this class */
  static metadataVersion = '1.0.5';

  name: string;
  dataServices: DataService[];

  /** The  [[NamingConvention]] associated with this MetadataStore. __Read Only__ */
  namingConvention: NamingConvention;
  /** The  [[LocalQueryComparisonOptions]] associated with this MetadataStore. __Read Only__ */
  localQueryComparisonOptions: LocalQueryComparisonOptions;
  serializerFn?: (prop: EntityProperty, val: any) => any;
  /**
  An [[BreezeEvent]] that fires after a MetadataStore has completed fetching metadata from a remote service.
  
  @eventArgs -
    - metadataStore - The MetadataStore into which the metadata was fetched.
    - dataService - The [[DataService]] that metadata was fetched from.
    - rawMetadata - {Object} The raw metadata returned from the service. (It will have already been processed by this point).
  >      let ms = myEntityManager.metadataStore;
  >      ms.metadataFetched.subscribe(function(args) {
  >          let metadataStore = args.metadataStore;
  >          let dataService = args.dataService;
  >      });
  @event
  **/
  metadataFetched: BreezeEvent<IMetadataFetchedEventArgs>;
  /** @hidden @internal */
  _resourceEntityTypeMap: {};
  /** @hidden @internal */
  _entityTypeResourceMap: {};
  /** @hidden @internal */
  _structuralTypeMap: IStructuralTypeMap; // key is qualified structuraltype name - value is structuralType. ( structural = entityType or complexType).
  /** @hidden @internal **/
  _shortNameMap: {}; // key is shortName, value is qualified name - does not need to be serialized.
  /** @hidden @internal **/
  _ctorRegistry: {}; // key is either short or qual type name - value is ctor;
  /** @hidden @internal **/
  _incompleteTypeMap: {}; // key is entityTypeName; value is array of nav props
  /** @hidden @internal **/
  _incompleteComplexTypeMap: {}; //
  /** @hidden @internal **/
  _deferredTypes: {};
  /** @hidden @internal **/
  _id: number;

  /**
  Constructs a new MetadataStore.
  
  >     let ms = new MetadataStore();

  The store can then be associated with an EntityManager
  >     let entityManager = new EntityManager( {
  >         serviceName: "breeze/NorthwindIBModel", 
  >         metadataStore: ms 
  >     });

  or for an existing EntityManager
  >    // Assume em1 is an existing EntityManager
  >    em1.setProperties( { metadataStore: ms });
  
  @param config - Configuration settings .
    - namingConvention - (default=NamingConvention.defaultInstance) NamingConvention to be used in mapping property names
  between client and server. Uses the NamingConvention.defaultInstance if not specified.
    - localQueryComparisonOptions - (default=LocalQueryComparisonOptions.defaultInstance) The LocalQueryComparisonOptions to be
  used when performing "local queries" in order to match the semantics of queries against a remote service.
    - serializerFn - A function that is used to mediate the serialization of instances of this type.
  **/
  constructor(config?: MetadataStoreConfig) {
    config = config || {};
    assertConfig(config)
      .whereParam("namingConvention").isOptional().isInstanceOf(NamingConvention).withDefault(NamingConvention.defaultInstance)
      .whereParam("localQueryComparisonOptions").isOptional().isInstanceOf(LocalQueryComparisonOptions).withDefault(LocalQueryComparisonOptions.defaultInstance)
      .whereParam("serializerFn").isOptional().isFunction()
      .applyAll(this);
    this.dataServices = []; // array of dataServices;
    this._resourceEntityTypeMap = {}; // key is resource name - value is qualified entityType name
    this._structuralTypeMap = {}; // key is qualified structuraltype name - value is structuralType. ( structural = entityType or complexType).
    this._shortNameMap = {}; // key is shortName, value is qualified name - does not need to be serialized.
    this._ctorRegistry = {}; // key is either short or qual type name - value is ctor;

    this._incompleteTypeMap = {}; // key is entityTypeName; value is array of nav props
    this._incompleteComplexTypeMap = {}; // key is complexTypeName; value is array of complexType props
    this._id = MetadataStore.__id++;
    this.metadataFetched = new BreezeEvent("metadataFetched", this);

  }

  // needs to be made avail to dataService.xxx files
  static normalizeTypeName = core.memoize(function (rawTypeName: string) {
    return rawTypeName && MetadataStore.parseTypeName(rawTypeName).typeName;
  });
  // for debugging use the line below instead.
  //ctor.normalizeTypeName = function (rawTypeName) { return parseTypeName(rawTypeName).typeName; };

  /**
  General purpose property set method
  
  >     // assume em1 is an EntityManager containing a number of existing entities.
  >     em1.metadataStore.setProperties( {
  >         version: "6.1.3",
  >         serializerFn: function(prop, value) {
  >         return (prop.isUnmapped) ? undefined : value;
  >         }
  >     )};
  @param config -  An object containing the selected properties and values to set.
  **/
  setProperties(config: MetadataStoreConfig) {
    assertConfig(config)
      .whereParam("name").isString().isOptional()
      .whereParam("serializerFn").isFunction().isOptional()
      .applyAll(this);
  }

  /**
  Adds a DataService to this MetadataStore. If a DataService with the same serviceName is already
  in the MetadataStore an exception will be thrown.
  @param dataService - The [[DataService]] to add
  @param shouldOverwrite - (default=false) Permit overwrite of existing DataService rather than throw exception
  **/
  addDataService(dataService: DataService, shouldOverwrite?: boolean) {
    assertParam(dataService, "dataService").isInstanceOf(DataService).check();
    assertParam(shouldOverwrite, "shouldOverwrite").isBoolean().isOptional().check();
    let ix = this._getDataServiceIndex(dataService.serviceName);
    if (ix >= 0) {
      if (!!shouldOverwrite) {
        this.dataServices[ix] = dataService;
      } else {
        throw new Error("A dataService with this name '" + dataService.serviceName + "' already exists in this MetadataStore");
      }
    } else {
      this.dataServices.push(dataService);
    }
  }

  /** @hidden @internal */
  _getDataServiceIndex(serviceName: string) {
    return core.arrayIndexOf(this.dataServices, function (ds) {
      return ds.serviceName === serviceName;
    });
  }

  /**
  Adds an EntityType to this MetadataStore.  No additional properties may be added to the EntityType after its has
  been added to the MetadataStore.
  @param structuralType - The EntityType or ComplexType to add
  **/
  addEntityType(stype: StructuralType | EntityTypeConfig | ComplexTypeConfig) {
    let structuralType: StructuralType;
    if (stype instanceof EntityType || stype instanceof ComplexType) {
      structuralType = stype;
    } else {
      structuralType = (stype as any).isComplexType ? new ComplexType(stype) : new EntityType(stype);
    }

    // if (!structuralType.isComplexType) { // same as below but isn't a 'type guard'
    if (structuralType instanceof EntityType) {
      if (structuralType.baseTypeName && !structuralType.baseEntityType) {
        let baseEntityType = this._getStructuralType(structuralType.baseTypeName, true);
        // safe cast because we know that baseEntityType must be an EntityType if the structuralType is an EntityType
        structuralType._updateFromBase(baseEntityType as EntityType);
      }
      if (structuralType.keyProperties.length === 0 && !structuralType.isAbstract) {
        throw new Error("Unable to add " + structuralType.name +
          " to this MetadataStore.  An EntityType must have at least one property designated as a key property - See the 'DataProperty.isPartOfKey' property.");
      }
    }

    structuralType.metadataStore = this;
    // don't register anon types
    if (!(structuralType as any).isAnonymous) {
      if (this._structuralTypeMap[structuralType.name]) {
        throw new Error("Type " + structuralType.name + " already exists in this MetadataStore.");
      }

      this._structuralTypeMap[structuralType.name] = structuralType;
      this._shortNameMap[structuralType.shortName] = structuralType.name;
    }

    structuralType.getProperties().forEach(p => {
      structuralType._updateNames(p);
      if (!p.isUnmapped) {
        structuralType._mappedPropertiesCount++;
      }
    });

    structuralType._updateCps();

    // 'isEntityType' is a type guard
    if (structuralType instanceof EntityType) {
      structuralType._updateNps();
      // give the type it's base's resource name if it doesn't have its own.
      let defResourceName = structuralType.defaultResourceName || (structuralType.baseEntityType && structuralType.baseEntityType.defaultResourceName);
      if (defResourceName && !this.getEntityTypeNameForResourceName(defResourceName)) {
        this.setEntityTypeForResourceName(defResourceName, structuralType.name);
      }
      structuralType.defaultResourceName = defResourceName;
      // check if this structural type's name, short version or qualified version has a registered ctor.
      structuralType.getEntityCtor();
    }

  }


  /**
  Exports this MetadataStore to a serialized string appropriate for local storage.   This operation is also called
  internally when exporting an EntityManager.
  >      // assume ms is a previously created MetadataStore
  >      let metadataAsString = ms.exportMetadata();
  >      window.localStorage.setItem("metadata", metadataAsString);
  >      // and later, usually in a different session imported
  >      let metadataFromStorage = window.localStorage.getItem("metadata");
  >      let newMetadataStore = new MetadataStore();
  >      newMetadataStore.importMetadata(metadataFromStorage);
  @return A serialized version of this MetadataStore that may be stored locally and later restored.
  **/
  exportMetadata() {
    let result = JSON.stringify({
      "metadataVersion": MetadataStore.metadataVersion,
      "name": this.name,
      "namingConvention": this.namingConvention.name,
      "localQueryComparisonOptions": this.localQueryComparisonOptions.name,
      "dataServices": this.dataServices,
      "structuralTypes": core.objectMap(this._structuralTypeMap),
      "resourceEntityTypeMap": this._resourceEntityTypeMap
    }, null, config.stringifyPad);
    return result;
  }

  /**
  Imports a previously exported serialized MetadataStore into this MetadataStore.
    
  >      // assume ms is a previously created MetadataStore
  >      let metadataAsString = ms.exportMetadata();
  >      window.localStorage.setItem("metadata", metadataAsString);
  >      // and later, usually in a different session
  >      let metadataFromStorage = window.localStorage.getItem("metadata");
  >      let newMetadataStore = new MetadataStore();
  >      newMetadataStore.importMetadata(metadataFromStorage);
  @param exportedMetadata - A previously exported MetadataStore.
  @param allowMerge -  Allows custom metadata to be merged into existing metadata types.
  @return This MetadataStore.
  @chainable
  **/
  importMetadata(exportedMetadata: string | Object, allowMerge: boolean = false) {
    assertParam(allowMerge, "allowMerge").isOptional().isBoolean().check();
    this._deferredTypes = {};
    let metadataJson = (typeof (exportedMetadata) === "string") ? JSON.parse(exportedMetadata) : exportedMetadata;

    if (metadataJson.schema) {
      return CsdlMetadataParser.parse(this, metadataJson.schema, metadataJson.altMetadata);
    }

    let json = metadataJson as IMetadataJson;
    if (json.metadataVersion && json.metadataVersion !== MetadataStore.metadataVersion) {
      let msg = core.formatString("Cannot import metadata with a different 'metadataVersion' (%1) than the current 'MetadataStore.metadataVersion' (%2) ",
        json.metadataVersion, MetadataStore.metadataVersion);
      throw new Error(msg);
    }

    let ncName = json.namingConvention;
    let lqcoName = json.localQueryComparisonOptions;
    if (this.isEmpty()) {
      this.namingConvention = config._fetchObject(NamingConvention, ncName) || this.namingConvention;
      this.localQueryComparisonOptions = config._fetchObject(LocalQueryComparisonOptions, lqcoName) || this.localQueryComparisonOptions;
    } else {
      if (ncName && this.namingConvention.name !== ncName) {
        throw new Error("Cannot import metadata with a different 'namingConvention' from the current MetadataStore");
      }
      if (lqcoName && this.localQueryComparisonOptions.name !== lqcoName) {
        throw new Error("Cannot import metadata with different 'localQueryComparisonOptions' from the current MetadataStore");
      }
    }

    //noinspection JSHint
    json.dataServices && json.dataServices.forEach((ds) => {
      let realDs = DataService.fromJSON(ds);
      this.addDataService(realDs, true);
    });

    json.structuralTypes && json.structuralTypes.forEach((stype) => {
      structuralTypeFromJson(this, stype, allowMerge);
    });
    core.extend(this._resourceEntityTypeMap, json.resourceEntityTypeMap);
    core.extend(this._incompleteTypeMap, json.incompleteTypeMap);

    return this;
  }

  /**
  Creates a new MetadataStore from a previously exported serialized MetadataStore
  >      // assume ms is a previously created MetadataStore
  >      let metadataAsString = ms.exportMetadata();
  >      window.localStorage.setItem("metadata", metadataAsString);
  >      // and later, usually in a different session
  >      let metadataFromStorage = window.localStorage.getItem("metadata");
  >      let newMetadataStore = MetadataStore.importMetadata(metadataFromStorage);
  @param exportedString - A previously exported MetadataStore.
  @return A new MetadataStore.
  **/
  static importMetadata(exportedString: string) {
    let ms = new MetadataStore();
    ms.importMetadata(exportedString);
    return ms;
  }

  /**
  Returns whether Metadata has been retrieved for a specified service name.
  >      // Assume em1 is an existing EntityManager.
  >      if (!em1.metadataStore.hasMetadataFor("breeze/NorthwindIBModel"))) {
  >          // do something interesting
  >      }
  @param serviceName - The service name.
  @return Whether metadata has already been retrieved for the specified service name.
  **/
  hasMetadataFor(serviceName: string) {
    return !!this.getDataService(serviceName);
  }

  /**
  Returns the DataService for a specified service name
  >      // Assume em1 is an existing EntityManager.
  >      let ds = em1.metadataStore.getDataService("breeze/NorthwindIBModel");
  >      let adapterName = ds.adapterName; // may be null
  @param serviceName - The service name.
  @return The DataService with the specified name.
  **/
  getDataService(serviceName: string) {
    assertParam(serviceName, "serviceName").isString().check();

    serviceName = DataService._normalizeServiceName(serviceName);
    return core.arrayFirst(this.dataServices, function (ds: DataService) {
      return ds.serviceName === serviceName;
    });
  }

  /**
  Fetches the metadata for a specified 'service'. This method is automatically called
  internally by an EntityManager before its first query against a new service. __Async__

  Usually you will not actually process the results of a fetchMetadata call directly, but will instead
  ask for the metadata from the EntityManager after the fetchMetadata call returns.
  >      let ms = new MetadataStore();
  >      // or more commonly
  >      // let ms = anEntityManager.metadataStore;
  >      ms.fetchMetadata("breeze/NorthwindIBModel").then(function(rawMetadata) {
  >            // do something with the metadata
  >      }).fail(function(exception) {
  >          // handle exception here
  >      });
  @param dataService -  Either a DataService or just the name of the DataService to fetch metadata for.
  @param callback - Function called on success.
  @param errorCallback - Function called on failure.
  @return Promise
  **/
  fetchMetadata(dataService: string | DataService, callback?: (schema: any) => void, errorCallback?: ErrorCallback) {
    try {
      assertParam(dataService, "dataService").isString().or().isInstanceOf(DataService).check();
      assertParam(callback, "callback").isFunction().isOptional().check();
      assertParam(errorCallback, "errorCallback").isFunction().isOptional().check();

      if (typeof dataService === "string") {
        // use the dataService with a matching name or create a new one.
        dataService = this.getDataService(dataService) || new DataService({ serviceName: dataService });
      }

      dataService = DataService.resolve([dataService]);

      if (this.hasMetadataFor(dataService.serviceName)) {
        throw new Error("Metadata for a specific serviceName may only be fetched once per MetadataStore. ServiceName: " + dataService.serviceName);
      }

      return dataService.adapterInstance!.fetchMetadata(this, dataService).then((rawMetadata: any) => {
        this.metadataFetched.publish({ metadataStore: this, dataService: dataService, rawMetadata: rawMetadata });
        if (callback) callback(rawMetadata);
        return Promise.resolve(rawMetadata);
      }, function (error: any) {
        if (errorCallback) errorCallback(error);
        return Promise.reject(error);
      });
    } catch (e) {
      return Promise.reject(e);
    }
  }


  // TODO: strongly type interceptor below.
  /**
  Used to register a constructor for an EntityType that is not known via standard Metadata discovery;
  i.e. an unmapped type.
  @param entityCtor - The constructor function for the 'unmapped' type.
  @param interceptor - An interceptor function
  **/
  trackUnmappedType(entityCtor: any, interceptor: any) {
    assertParam(entityCtor, "entityCtor").isFunction().check();
    assertParam(interceptor, "interceptor").isFunction().isOptional().check();
    // TODO: think about adding this to the MetadataStore.
    let entityType = new EntityType(this);
    entityType._setCtor(entityCtor, interceptor);
  }

  /**
  Provides a mechanism to register a 'custom' constructor to be used when creating new instances
  of the specified entity type.  If this call is not made, a default constructor is created for
  the entity as needed.
  This call may be made before or after the corresponding EntityType has been discovered via
  Metadata discovery.
  >      let Customer = function () {
  >              this.miscData = "asdf";
  >          };
  >      Customer.prototype.doFoo() {
  >              ...
  >          }
  >      // assume em1 is a preexisting EntityManager;
  >      em1.metadataStore.registerEntityTypeCtor("Customer", Customer);
  >      // any queries or EntityType.create calls from this point on will call the Customer constructor
  >      // registered above.
  @param structuralTypeName - The name of the EntityType or ComplexType.
  @param aCtor - The constructor for this EntityType or ComplexType; may be null if all you want to do is set the next parameter.
  @param initFn - A function or the name of a function on the entity that is to be executed immediately after the entity has been created
  and populated with any initial values. Called with 'initFn(entity)'
  @param noTrackingFn - A function that is executed immediately after a noTracking entity has been created and whose return
  value will be used in place of the noTracking entity.
  **/
  registerEntityTypeCtor(structuralTypeName: string, aCtor?: any, initFn?: Function, noTrackingFn?: Function) {
    assertParam(structuralTypeName, "structuralTypeName").isString().check();
    assertParam(aCtor, "aCtor").isFunction().isOptional().check();
    assertParam(initFn, "initFn").isOptional().isFunction().or().isString().check();
    assertParam(noTrackingFn, "noTrackingFn").isOptional().isFunction().check();

    let qualifiedTypeName = getQualifiedTypeName(this, structuralTypeName, false);
    let typeName = qualifiedTypeName || structuralTypeName;

    if (aCtor) {
      if (aCtor._$typeName && aCtor._$typeName !== typeName) {
        // TODO: wrap this - console and especially console.warn does not exist in all browsers.
        console.warn("Registering a constructor for " + typeName + " that is already used for " + aCtor._$typeName + ".");
      }
      aCtor._$typeName = typeName;
    }

    this._ctorRegistry[typeName] = { ctor: aCtor, initFn: initFn, noTrackingFn: noTrackingFn };
    if (qualifiedTypeName) {
      let stype = this._structuralTypeMap[qualifiedTypeName];
      stype && stype.getCtor(true); // this will complete the registration if avail now.
    }

  }

  /**
  Returns whether this MetadataStore contains any metadata yet.
  >      // assume em1 is a preexisting EntityManager;
  >      if (em1.metadataStore.isEmpty()) {
  >          // do something interesting
  >      }
  **/
  isEmpty() {
    return core.isEmpty(this._structuralTypeMap);
  }

  /**
  Returns an [[EntityType]] or a [[ComplexType]] given its name.
  >      // assume em1 is a preexisting EntityManager
  >      let odType = em1.metadataStore.getEntityType("OrderDetail");

  or to throw an error if the type is not found
  >      let badType = em1.metadataStore.getEntityType("Foo", false);
  >      // badType will not get set and an exception will be thrown.
  @param structuralTypeName - Either the fully qualified name or a short name may be used. If a short name is specified and multiple types share
  that same short name an exception will be thrown.
  @param okIfNotFound - (default=false) Whether to throw an error if the specified EntityType is not found.
  @return The EntityType. ComplexType or 'null' if not not found.
  **/
  getEntityType(structuralTypeName: string, okIfNotFound: boolean = false) {
    assertParam(structuralTypeName, "structuralTypeName").isString().check();
    assertParam(okIfNotFound, "okIfNotFound").isBoolean().isOptional().check(false);
    return this._getStructuralType(structuralTypeName, okIfNotFound);
  }

  /** @hidden @internal */
  _getStructuralType(typeName: string, okIfNotFound: boolean = false) {
    let qualTypeName = getQualifiedTypeName(this, typeName, false);
    let type = this._structuralTypeMap[qualTypeName];
    if (!type) {
      if (okIfNotFound) return null;
      let msg = core.formatString("Unable to locate a 'Type' by the name: '%1'. Be sure to execute a query or call fetchMetadata first.", typeName);
      throw new Error(msg);
    }
    // TODO: review this - don't think it can happen.
    // if (type.length) {
    //   let typeNames = type.join(",");
    //   throw new Error("There are multiple types with this 'shortName': " + typeNames);
    // }
    return type;
  }

  /**
  Returns an array containing all of the [[EntityType]]s or [[ComplexType]]s in this MetadataStore.
  >      // assume em1 is a preexisting EntityManager
  >      let allTypes = em1.metadataStore.getEntityTypes();
  **/
  getEntityTypes() {
    return getTypesFromMap(this._structuralTypeMap);
  }

  getIncompleteNavigationProperties() {
    return core.objectMap(this._incompleteTypeMap, function (key, value) {
      return value;
    });
  }

  /**
  Returns a fully qualified entityTypeName for a specified resource name.  The reverse of this operation
  can be obtained via the  [[EntityType.defaultResourceName]] property
  **/
  getEntityTypeNameForResourceName(resourceName: string) {
    assertParam(resourceName, "resourceName").isString().check();
    return this._resourceEntityTypeMap[resourceName];
  }

  /**
  Associates a resourceName with an entityType.

  This method is only needed in those cases where multiple resources return the same
  entityType.  In this case Metadata discovery will only determine a single resource name for
  each entityType.
  @param resourceName - The resource name
  @param entityTypeOrName - If passing a string either the fully qualified name or a short name may be used. If a short name is specified and multiple types share
  that same short name an exception will be thrown. If the entityType has not yet been discovered then a fully qualified name must be used.
  **/
  setEntityTypeForResourceName(resourceName: string, entityTypeOrName: EntityType | string) {
    assertParam(resourceName, "resourceName").isString().check();
    assertParam(entityTypeOrName, "entityTypeOrName").isInstanceOf(EntityType).or().isString().check();

    let entityTypeName: string;
    if (entityTypeOrName instanceof EntityType) {
      entityTypeName = entityTypeOrName.name;
    } else {
      entityTypeName = getQualifiedTypeName(this, entityTypeOrName, true);
    }

    this._resourceEntityTypeMap[resourceName] = entityTypeName;
    let entityType = this._getStructuralType(entityTypeName, true);
    if (entityType && entityType instanceof EntityType && !entityType.defaultResourceName) {
      entityType.defaultResourceName = resourceName;
    }
  }

  /** __Dev Only__ - for use when creating a new MetadataParserAdapter  */
  static parseTypeName(entityTypeName: string) {
    // TODO: removed 
    // if (!entityTypeName) {
    //   return null;
    // }

    let typeParts = entityTypeName.split(":#");
    if (typeParts.length > 1) {
      return MetadataStore.makeTypeHash(typeParts[0], typeParts[1]);
    }

    if (core.stringStartsWith(entityTypeName, MetadataStore.ANONTYPE_PREFIX)) {
      let typeHash = MetadataStore.makeTypeHash(entityTypeName);
      (typeHash as any).isAnonymous = true;
      return typeHash;
    }
    let entityTypeNameNoAssembly = entityTypeName.split(",")[0];
    typeParts = entityTypeNameNoAssembly.split(".");
    if (typeParts.length > 1) {
      let shortName = typeParts[typeParts.length - 1];
      let namespaceParts = typeParts.slice(0, typeParts.length - 1);
      let ns = namespaceParts.join(".");
      return MetadataStore.makeTypeHash(shortName, ns);
    } else {
      return MetadataStore.makeTypeHash(entityTypeName);
    }
  }

  /** __Dev Only__ - for use when creating a new MetadataParserAdapter  */
  static makeTypeHash(shortName: string, ns?: string) {
    return {
      shortTypeName: shortName,
      namespace: ns,
      typeName: qualifyTypeName(shortName, ns)
    };
  }

  // protected methods
  /** @hidden @internal */
  _checkEntityType(entity: IEntity) {
    if (entity.entityType) return;
    let typeName = entity.prototype._$typeName;
    if (!typeName) {
      throw new Error("This entity has not been registered. See the MetadataStore.registerEntityTypeCtor method");
    }
    // we know that it is an EntityType ( as opposed to a ComplexType)
    let entityType = this._getStructuralType(typeName) as EntityType;
    if (entityType) {
      entity.entityType = entityType;
    }
  }


}
MetadataStore.prototype._$typeName = "MetadataStore";

BreezeEvent.bubbleEvent(MetadataStore.prototype);

function getTypesFromMap(typeMap: IStructuralTypeMap) {
  let types: (StructuralType)[] = [];
  for (let key in typeMap) {
    let value = typeMap[key];
    // skip 'shortName' entries
    if (key === value.name) {
      types.push(typeMap[key]);
    }
  }
  return types;
}

function structuralTypeFromJson(metadataStore: MetadataStore, json: any, allowMerge: boolean) {
  let typeName = qualifyTypeName(json.shortName, json.namespace);
  let stype = metadataStore._getStructuralType(typeName, true);
  if (stype) {
    if (allowMerge) {
      return mergeStructuralType(stype, json);
    } else {
      // allow it but don't replace anything.
      return stype;
    }
  }
  let config = {
    shortName: json.shortName,
    namespace: json.namespace,
    isAbstract: json.isAbstract,
    autoGeneratedKeyType: AutoGeneratedKeyType.fromName(json.autoGeneratedKeyType),
    defaultResourceName: json.defaultResourceName,
    custom: json.custom
  };

  stype = json.isComplexType ? new ComplexType(config) : new EntityType(config);

  // baseType may not have been imported yet so we need to defer handling this type until later.
  if (json.baseTypeName && stype instanceof EntityType) {
    stype.baseTypeName = json.baseTypeName;
    let baseEntityType = metadataStore._getStructuralType(json.baseTypeName, true);
    if (baseEntityType) {
      completeStructuralTypeFromJson(metadataStore, json, stype);
    } else {
      core.getArray(metadataStore._deferredTypes, json.baseTypeName).push({ json: json, stype: stype });

    }
  } else {
    completeStructuralTypeFromJson(metadataStore, json, stype);
  }

  // stype may or may not have been added to the metadataStore at this point.
  return stype;
}

function mergeStructuralType(stype: StructuralType, json: any) {
  if (json.custom) {
    stype.custom = json.custom;
  }

  mergeProps(stype, json.dataProperties);
  mergeProps(stype, json.navigationProperties);
  return stype;
}

function mergeProps(stype: StructuralType, jsonProps: any[]) {
  if (!jsonProps) return;
  jsonProps.forEach((jsonProp) => {
    let propName = jsonProp.name;
    if (!propName) {
      if (jsonProp.nameOnServer) {
        propName = stype.metadataStore.namingConvention.serverPropertyNameToClient(jsonProp.nameOnServer, {});
      } else {
        // backslash-quote works around compiler bug
        const msg = "Unable to complete \'importMetadata\' - cannot locate a \'name\' or \'nameOnServer\' for one of the imported property nodes";
        throw new Error(msg);
      }
    }
    if (jsonProp.custom) {
      let prop = stype.getProperty(propName, true);
      prop!.custom = jsonProp.custom;
    }
  });
}

function completeStructuralTypeFromJson(metadataStore: MetadataStore, json: any, stype: any) {

  // validators from baseType work because validation walks thru base types
  // so no need to copy down.
  if (json.validators) {
    stype.validators = json.validators.map(Validator.fromJSON);
  }

  json.dataProperties.forEach(function (dp: Object) {
    stype._addPropertyCore(DataProperty.fromJSON(dp));
  });


  let isEntityType = !json.isComplexType;
  if (isEntityType) {
    //noinspection JSHint
    json.navigationProperties && json.navigationProperties.forEach(function (np: Object) {
      stype._addPropertyCore(NavigationProperty.fromJSON(np));
    });
  }

  metadataStore.addEntityType(stype);

  let deferredTypes = metadataStore._deferredTypes;
  let deferrals = deferredTypes[stype.name];
  if (deferrals) {
    deferrals.forEach(function (d: any) {
      completeStructuralTypeFromJson(metadataStore, d.json, d.stype);
    });
    delete deferredTypes[stype.name];
  }
}

function getQualifiedTypeName(metadataStore: MetadataStore, structTypeName: string, throwIfNotFound?: boolean) {
  if (isQualifiedTypeName(structTypeName)) return structTypeName;
  let result = metadataStore._shortNameMap[structTypeName];
  if (!result && throwIfNotFound) {
    throw new Error("Unable to locate 'entityTypeName' of: " + structTypeName);
  }
  return result;
}

/** Configuration info to be passed to the [[EntityType]] constructor */
export interface EntityTypeConfig {
  shortName?: string;
  namespace?: string;
  baseTypeName?: string;
  isAbstract?: boolean;
  autoGeneratedKeyType?: AutoGeneratedKeyType;
  defaultResourceName?: string;
  dataProperties?: DataProperty[];
  navigationProperties?: NavigationProperty[];
  serializerFn?: (prop: EntityProperty, val: any) => any;
  custom?: Object;
}

/** Configuration info to be passed to the [[EntityType.setProperties]] method */
export interface EntityTypeSetConfig {
  autoGeneratedKeyType?: AutoGeneratedKeyType;
  defaultResourceName?: string;
  serializerFn?: (prop: EntityProperty, val: any) => any;
  custom?: Object;
}

/** Container for all of the metadata about a specific type of Entity.
**/
export class EntityType {
  /** @hidden @internal */
  _$typeName: string; // on proto
  /** @hidden @internal */
  static __nextAnonIx = 0;
  /** Always false for an EntityType. **/
  isComplexType = false;
  /** The [[MetadataStore]] that contains this EntityType. __Read Only__ **/
  metadataStore: MetadataStore;
  /** The DataProperties (see [[DataProperty]] associated with this EntityType. __Read Only__  **/
  dataProperties: DataProperty[];
  /**  The NavigationProperties (see [[NavigationProperty]] associated with this EntityType. __Read Only__  **/
  navigationProperties: NavigationProperty[];
  /**
  The DataProperties associated with this EntityType that make up it's [[EntityKey]]. __Read Only__ **/
  keyProperties: DataProperty[];
  /** The DataProperties associated with this EntityType that are foreign key properties. __Read Only__ **/
  foreignKeyProperties: DataProperty[];
  inverseForeignKeyProperties: DataProperty[];
  /**  The DataProperties associated with this EntityType that are concurrency properties. __Read Only__ **/
  concurrencyProperties: DataProperty[];
  /** The DataProperties for this EntityType that contain instances of a [[ComplexType]]. __Read Only__   **/
  complexProperties: DataProperty[];
  /** The DataProperties associated with this EntityType that are not mapped to any backend datastore. These are effectively free standing
  properties. __Read Only__ **/
  unmappedProperties: DataProperty[];

  /** The fully qualified name of this EntityType. __Read Only__  **/
  name: string;
  /** The short, unqualified, name for this EntityType. __Read Only__  **/
  shortName: string;
  /** The namespace for this EntityType. __Read Only__  **/
  namespace: string;
  /** The name of this EntityType's base EntityType  (if any) */
  baseTypeName?: string;
  /** The base EntityType (if any) for this EntityType. __Read Only__   **/
  baseEntityType: EntityType;
  subtypes: EntityType[];

  /**  Whether this EntityType is abstract. __Read Only__ **/
  isAbstract: boolean;
  /**  Whether this EntityType is anonymous. Anonymous types will never be communicated to or from the server. They are purely for
  client side use and are given an automatically generated name.  __Read Only__ **/
  isAnonymous: boolean;
  /** Whether this EntityType has been 'frozen'.  EntityTypes become frozen after the first instance 
  of that type has been created and attached to an EntityManager. */
  isFrozen: boolean;

  /** The [[AutoGeneratedKeyType]] for this EntityType. __Read Only__ **/
  autoGeneratedKeyType: AutoGeneratedKeyType;
  /**   The default resource name associated with this EntityType.  An EntityType may be queried via a variety of 'resource names' but this one
  is used as the default when no resource name is provided.  This will occur when calling [[EntityAspect.loadNavigationProperty]]
  or when executing any [[EntityQuery]] that was created via an [[EntityKey]]. __Read Only__ **/
  defaultResourceName: string;
  /** A function that is used to customize the serialization of any EntityProperties of this type. */
  serializerFn?: (prop: EntityProperty, val: any) => any;
  /**  A free form object that can be used to define any custom metadata for this EntityType. __Read Only__  **/
  custom?: Object;
  /** The entity level validators associated with this EntityType. Validators can be added and
  removed from this collection. __Read Only__.   **/
  validators: Validator[];

  warnings: any[];
  initFn: Function | string;
  noTrackingFn: Function;

  /** @hidden @internal */
  _extra: any;
  /** @hidden @internal */
  _ctor: { new (): IStructuralObject };
  /** @hidden @internal */
  _mappedPropertiesCount: number;

  /** 
  @deprecated Use [[getCtor]] instead.   
  */
  getEntityCtor = this.getCtor;

  // static qualifyTypeName = qualifyTypeName;


  /** EntityType constructor  
  >      let entityType = new EntityType( {
  >          shortName: "person",
  >          namespace: "myAppNamespace"
  >      });
  @param config - Configuration settings or a MetadataStore.  If this parameter is just a MetadataStore
  then what will be created is an 'anonymous' type that will never be communicated to or from the server. It is purely for
  client side use and will be given an automatically generated name. Normally, however, you will use a configuration object.
  **/
  constructor(config: MetadataStore | EntityTypeConfig) {
    if (arguments.length > 1) {
      throw new Error("The EntityType ctor has a single argument that is either a 'MetadataStore' or a configuration object.");
    }
    // let etConfig =  <EntityTypeConfig> <any> undefined;
    let etConfig: EntityTypeConfig | undefined = undefined;

    if ((config as any)._$typeName === "MetadataStore") {
      this.metadataStore = config as MetadataStore;
      this.shortName = "Anon_" + (++EntityType.__nextAnonIx);
      this.namespace = "";
      this.isAnonymous = true;
      // etConfig = undefined;
    } else {
      etConfig = config as EntityTypeConfig;
      assertConfig(config)
        .whereParam("shortName").isNonEmptyString()
        .whereParam("namespace").isString().isOptional().withDefault("")
        .whereParam("baseTypeName").isString().isOptional()
        .whereParam("isAbstract").isBoolean().isOptional().withDefault(false)
        .whereParam("autoGeneratedKeyType").isEnumOf(AutoGeneratedKeyType).isOptional().withDefault(AutoGeneratedKeyType.None)
        .whereParam("defaultResourceName").isNonEmptyString().isOptional().withDefault(null)
        .whereParam("dataProperties").isOptional()
        .whereParam("navigationProperties").isOptional()
        .whereParam("serializerFn").isOptional().isFunction()
        .whereParam("custom").isOptional()
        .applyAll(this);
    }

    this.name = qualifyTypeName(this.shortName, this.namespace);

    // the defaultResourceName may also be set up either via metadata lookup or first query or via the 'setProperties' method
    this.dataProperties = [];
    this.navigationProperties = [];
    this.complexProperties = [];
    this.keyProperties = [];
    this.foreignKeyProperties = [];
    this.inverseForeignKeyProperties = [];
    this.concurrencyProperties = [];
    this.unmappedProperties = []; // will be updated later.
    this.validators = [];
    this.warnings = [];
    this._mappedPropertiesCount = 0;
    this.subtypes = [];
    // now process any data/nav props
    if (etConfig && etConfig.dataProperties) {
      addProperties(this, etConfig.dataProperties, DataProperty);
    }
    if (etConfig && etConfig.navigationProperties) {
      addProperties(this, etConfig.navigationProperties, NavigationProperty);
    }
  }

  /**
  General purpose property set method
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      custType.setProperties( {
  >          autoGeneratedKeyType: AutoGeneratedKeyType.Identity;
  >          defaultResourceName: "CustomersAndIncludedOrders"
  >      )};
  @param config - a configuration object
  **/
  setProperties(config: EntityTypeSetConfig) {
    assertConfig(config)
      .whereParam("autoGeneratedKeyType").isEnumOf(AutoGeneratedKeyType).isOptional()
      .whereParam("defaultResourceName").isString().isOptional()
      .whereParam("serializerFn").isFunction().isOptional()
      .whereParam("custom").isOptional()
      .applyAll(this);
    if (config.defaultResourceName) {
      this.defaultResourceName = config.defaultResourceName;
    }
  }

  /**
  Returns whether this type is a subtype of a specified type.
  **/
  isSubtypeOf(entityType: EntityType) {
    assertParam(entityType, "entityType").isInstanceOf(EntityType).check();
    let baseType: EntityType = this;
    do {
      if (baseType === entityType) return true;
      baseType = baseType.baseEntityType;
    } while (baseType);
    return false;
  }

  /**
  Returns an array containing this type and any/all subtypes of this type down thru the hierarchy.
  **/
  getSelfAndSubtypes() {
    let result = [this];
    this.subtypes.forEach(function (st) {
      let subtypes = st.getSelfAndSubtypes();
      result.push.apply(result, subtypes);
    });
    return result;
  }

  getAllValidators() {
    let result = this.validators.slice(0);
    let bt = this.baseEntityType;
    while (bt) {
      result.push.apply(result, bt.validators);
      bt = bt.baseEntityType;
    }
    return result;
  }

  /**
  Adds a  [[DataProperty]] or a [[NavigationProperty]] to this EntityType.
  >      // assume myEntityType is a newly constructed EntityType.
  >      myEntityType.addProperty(dataProperty1);
  >      myEntityType.addProperty(dataProperty2);
  >      myEntityType.addProperty(navigationProperty1);
  **/
  addProperty(property: EntityProperty) {
    assertParam(property, "property").isInstanceOf(DataProperty).or().isInstanceOf(NavigationProperty).check();

    // true is 2nd arg to force resolve of any navigation properties.
    let newprop = this._addPropertyCore(property, true);

    if (this.subtypes && this.subtypes.length) {
      let stype = this;
      stype.getSelfAndSubtypes().forEach(function (st) {
        if (st !== stype) {
          if (property.isNavigationProperty) {
            st._addPropertyCore(new NavigationProperty(property), true);
          } else {
            st._addPropertyCore(new DataProperty(property as DataProperty), true);
          }
        }
      });
    }
    return newprop;
  }

  /** @hidden @internal */
  _updateFromBase(baseEntityType: EntityType) {
    this.baseEntityType = baseEntityType;
    if (this.autoGeneratedKeyType === AutoGeneratedKeyType.None) {
      this.autoGeneratedKeyType = baseEntityType.autoGeneratedKeyType;
    }

    baseEntityType.dataProperties.forEach((dp) => {
      let newDp = new DataProperty(dp);
      // don't need to copy validators becaue we will walk the hierarchy to find them
      newDp.validators = [];
      newDp.baseProperty = dp;
      this._addPropertyCore(newDp);
    }, this);
    baseEntityType.navigationProperties.forEach((np) => {
      let newNp = new NavigationProperty(np);
      // don't need to copy validators becaue we will walk the hierarchy to find them
      newNp.validators = [];
      newNp.baseProperty = np;
      this._addPropertyCore(newNp);
    }, this);
    baseEntityType.subtypes.push(this);
  }

  /** @hidden @internal */
  _addPropertyCore(property: EntityProperty, shouldResolve: boolean = false) {
    if (this.isFrozen) {
      throw new Error("The '" + this.name + "' EntityType/ComplexType has been frozen. You can only add properties to an EntityType/ComplexType before any instances of that type have been created and attached to an entityManager.");
    }
    let parentType = property.parentType;
    if (parentType) {
      if (parentType !== this) {
        throw new Error("This property: " + property.name + " has already been added to " + property.parentType.name);
      } else {
        // adding the same property more than once to the same entityType is just ignored.
        return;
      }
    }
    property.parentType = this;
    let ms = this.metadataStore;
    // if (property.isDataProperty) { // modified because doesn't act as a type guard 
    if (property instanceof DataProperty) {
      this._addDataProperty(property);
    } else {
      this._addNavigationProperty(property);
      // metadataStore can be undefined if this entityType has not yet been added to a MetadataStore.
      if (shouldResolve && ms) {
        tryResolveNp(property, ms);
      }
    }
    // unmapped properties can be added AFTER entityType has already resolved all property names.
    if (ms && !(property.name && property.nameOnServer)) {
      updateClientServerNames(ms.namingConvention, property, "name");
    }
    // props can be added after entity prototype has already been wrapped.
    if (ms && this._extra) {
      if (this._extra.alreadyWrappedProps) {
        let proto = this._ctor.prototype;
        config.interfaceRegistry.modelLibrary.getDefaultInstance().initializeEntityPrototype(proto);
      }
    }
  }

  /**
  Create a new entity of this type.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let cust1 = custType.createEntity();
  >      em1.addEntity(cust1);
  @param initialValues- Configuration object of the properties to set immediately after creation.
  @return The new entity.
  **/
  createEntity(initialValues: any) {
    // ignore the _$eref once the entity is attached to an entityManager.
    if (initialValues && initialValues._$eref && !initialValues._$eref.entityAspect.entityManager) return initialValues._$eref;

    let instance = this._createInstanceCore();

    if (initialValues) {
      // only assign an _eref if the object is fully "keyed"
      if (this.keyProperties.every(function (kp) {
        return initialValues[kp.name] != null;
      })) {
        initialValues._$eref = instance;
      }

      this._updateTargetFromRaw(instance, initialValues, getRawValueFromConfig);

      this.navigationProperties.forEach(function (np) {
        let relatedEntity: any;
        let val = initialValues[np.name];
        if (val != undefined) {
          let navEntityType = np.entityType;
          if (np.isScalar) {
            relatedEntity = val.entityAspect ? val : navEntityType.createEntity(val);
            instance.setProperty(np.name, relatedEntity);
          } else {
            let relatedEntities = instance.getProperty(np.name);
            val.forEach((v: any) => {
              relatedEntity = v.entityAspect ? v : navEntityType.createEntity(v);
              relatedEntities.push(relatedEntity);
            });
          }
        }
      });
    }

    this._initializeInstance(instance);
    return instance;
  }

  /** @hidden @internal */
  _createInstanceCore() {
    let aCtor = this.getCtor();
    let instance = new aCtor();
    new EntityAspect(instance as IEntity);
    return instance;
  }

  /** @hidden @internal */
  _initializeInstance(instance: any) {
    if (this.baseEntityType) {
      this.baseEntityType._initializeInstance(instance);
    }
    let initFn = this.initFn;
    if (initFn) {
      let fn = (typeof initFn === "string") ? instance[initFn] : initFn;
      fn(instance);
    }
    this.complexProperties && this.complexProperties.forEach(function (cp) {
      let complexType = cp.dataType as ComplexType;
      let ctInstance = instance.getProperty(cp.name);
      if (Array.isArray(ctInstance)) {
        ctInstance.forEach((ctInst) => {
          complexType._initializeInstance(ctInst);
        });
      } else {
        complexType._initializeInstance(ctInstance);
      }
    });
    // not needed for complexObjects
    if (instance.entityAspect) {
      instance.entityAspect._initialized = true;
    }
  }

  /**
  Returns the constructor for this EntityType.
  @param forceRefresh - Whether to ignore any cached version of this constructor. (default == false)
  @return The constructor for this EntityType.
  **/
  getCtor(forceRefresh: boolean = false): { new (): IStructuralObject } {
    if (this._ctor && !forceRefresh) return this._ctor;

    let ctorRegistry = this.metadataStore._ctorRegistry;
    let r = ctorRegistry[this.name] || ctorRegistry[this.shortName] || {};
    let aCtor = r.ctor || this._ctor;

    let ctorType = aCtor && aCtor.prototype && (aCtor.prototype.entityType || aCtor.prototype.complexType);
    if (ctorType && ctorType.metadataStore !== this.metadataStore) {
      // We can't risk a mismatch between the ctor and the type info in a specific metadatastore
      // because modelLibraries rely on type info to intercept ctor properties
      throw new Error("Cannot register the same constructor for " + this.name + " in different metadata stores.  Please define a separate constructor for each metadata store.");
    }


    if (r.ctor && forceRefresh) {
      this._extra = undefined;
    }

    if (!aCtor) {
      let createCtor = config.interfaceRegistry.modelLibrary.getDefaultInstance().createCtor;
      aCtor = createCtor ? createCtor(this) : createEmptyCtor(this);
    }

    this.initFn = r.initFn;
    this.noTrackingFn = r.noTrackingFn;

    aCtor.prototype._$typeName = this.name;
    this._setCtor(aCtor);
    return aCtor;
  }


  /** @hidden @internal */
  // May make public later.
  _setCtor(aCtor: { new (): IStructuralObject }, interceptor?: any) {

    let instanceProto = aCtor.prototype;

    // place for extra breeze related data
    this._extra = this._extra || {};

    let instance = new aCtor();
    calcUnmappedProperties(this, instance);

    if (this._$typeName === "EntityType") {
      // insure that all of the properties are on the 'template' instance before watching the class.
      instanceProto.entityType = this;
    } else {
      instanceProto.complexType = this;
    }

    // defaultPropertyInterceptor is a 'global' (but internal to breeze) function;
    (instanceProto as any)._$interceptor = interceptor || defaultPropertyInterceptor;
    config.interfaceRegistry.modelLibrary.getDefaultInstance().initializeEntityPrototype(instanceProto);
    this._ctor = aCtor;
  }

  /**
  Adds either an entity or property level validator to this EntityType.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let countryProp = custType.getProperty("Country");
  >      let valFn = function (v) {
  >              if (v == null) return true;
  >              return (core.stringStartsWith(v, "US"));
  >          };
  >      let countryValidator = new Validator("countryIsUS", valFn,
  >      { displayName: "Country", messageTemplate: "'%displayName%' must start with 'US'" });
  >      custType.addValidator(countryValidator, countryProp);

  This is the same as adding an entity level validator via the 'validators' property of DataProperty or NavigationProperty
  >      countryProp.validators.push(countryValidator);

  Entity level validators can also be added by omitting the 'property' parameter.
  >      custType.addValidator(someEntityLevelValidator);

  or
  >      custType.validators.push(someEntityLevelValidator);
  @param validator - Validator to add.
  @param property - Property to add this validator to.  If omitted, the validator is assumed to be an
  entity level validator and is added to the EntityType's 'validators'.
  **/
  addValidator(validator: Validator, property?: EntityProperty | string) {
    assertParam(validator, "validator").isInstanceOf(Validator).check();
    assertParam(property, "property").isOptional().isString().or().isEntityProperty().check();
    if (property != null) {
      let prop = (typeof property === 'string') ? this.getProperty(property, true) : property;
      prop!.validators.push(validator);
    } else {
      this.validators.push(validator);
    }
  }

  /**
  Returns all of the properties ( dataProperties and navigationProperties) for this EntityType.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let arrayOfProps = custType.getProperties();
  @return An array of Data and Navigation properties.
  **/
  getProperties(): EntityProperty[] {
    return (this.dataProperties as EntityProperty[]).concat(this.navigationProperties);
  }

  /**
  Returns all of the property names ( for both dataProperties and navigationProperties) for this EntityType.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let arrayOfPropNames = custType.getPropertyNames();
  **/
  getPropertyNames() {
    return this.getProperties().map(core.pluck('name'));
  }

  /**
  Returns a data property with the specified name or null.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let customerNameDataProp = custType.getDataProperty("CustomerName");
  @return A DataProperty or null if not found.
  **/
  getDataProperty(propertyName: string) {
    return core.arrayFirst(this.dataProperties, core.propEq('name', propertyName));
  }

  /**
  Returns a navigation property with the specified name or null.
  >      // assume em1 is an EntityManager containing a number of existing entities.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let customerOrdersNavProp = custType.getDataProperty("Orders");
  @return A NavigationProperty or null if not found.
  **/
  getNavigationProperty(propertyName: string) {
    return core.arrayFirst(this.navigationProperties, core.propEq('name', propertyName));
  }

  /**
  Returns either a DataProperty or a NavigationProperty with the specified name or null.
  
  This method also accepts a '.' delimited property path and will return the 'property' at the
  end of the path.
  >      let custType = em1.metadataStore.getEntityType("Customer");
  >      let companyNameProp = custType.getProperty("CompanyName");

  This method can also walk a property path to return a property
  >      let orderDetailType = em1.metadataStore.getEntityType("OrderDetail");
  >      let companyNameProp2 = orderDetailType.getProperty("Order.Customer.CompanyName");
  >      // companyNameProp === companyNameProp2
  @param [throwIfNotFound=false] {Boolean} Whether to throw an exception if not found.
  @return A DataProperty or NavigationProperty or null if not found.
  **/
  getProperty(propertyPath: string, throwIfNotFound: boolean = false) {
    let props = this.getPropertiesOnPath(propertyPath, false, throwIfNotFound);
    return (props && props.length > 0) ? props[props.length - 1] : null;
  }

  /** @hidden @internal */
  // TODO: have this return empty array instead of null and fix consumers.
  // TODO: think about renaming with '_' prefix.
  getPropertiesOnPath(propertyPath: string, useServerName: boolean, throwIfNotFound: boolean = false) {
    let propertyNames: string[] = (Array.isArray(propertyPath)) ? propertyPath : propertyPath.trim().split('.');

    let ok = true;
    let key = useServerName ? "nameOnServer" : "name";
    
    const getProps = (propName: string) => {
      let parentType = this as StructuralType;
      let prop = core.arrayFirst(parentType.getProperties(), core.propEq(key, propName));
      if (prop) {
        parentType = (prop instanceof NavigationProperty) ? prop.entityType : prop.dataType as ComplexType;
        // parentType = prop.isNavigationProperty ? prop.entityType : prop.dataType;
      } else if (throwIfNotFound) {
        throw new Error("unable to locate property: " + propName + " on entityType: " + parentType.name);
      } else {
        ok = false;
      }
      return prop;
    };

    let props = propertyNames.map(getProps) as EntityProperty[];
    return ok ? props : null;
  }

  /** For use in pluggable adapters. */
  // TODO: document use
  clientPropertyPathToServer(propertyPath: string, delimiter: string = '.') {
    let propNames: string[];
    if (this.isAnonymous) {
      let fn = this.metadataStore.namingConvention.clientPropertyNameToServer;
      propNames = propertyPath.split(".").map(function (propName) {
        return fn(propName);
      });
    } else {
      let props = this.getPropertiesOnPath(propertyPath, false, true);
      propNames = props!.map((prop: EntityProperty) => prop.nameOnServer);
    }
    return propNames.join(delimiter);
  }

  /** For use in pluggable adapters. */
  // TODO: document use
  getEntityKeyFromRawEntity(rawEntity: any, rawValueFn: Function) {
    let keyValues = this.keyProperties.map((dp) => {
      let val = rawValueFn(rawEntity, dp);
      return DataType.parseRawValue(val, dp.dataType as DataType);
    });
    return new EntityKey(this, keyValues);
  }

  /** @hidden @internal */
  _updateTargetFromRaw(target: IStructuralObject, raw: any, rawValueFn: Function) {
    // called recursively for complex properties
    this.dataProperties.forEach((dp) => {
      if (!dp.isSettable) return;
      let rawVal = rawValueFn(raw, dp);
      if (rawVal === undefined) return;
      let dataType = dp.dataType; // this will be a complexType when dp is a complexProperty
      let oldVal: any;
      if (dp.isComplexProperty) {
        let complexType = dp.dataType as ComplexType;
        if (rawVal === null) return; // rawVal may be null in nosql dbs where it was never defined for the given row.
        oldVal = target.getProperty(dp.name);
        if (dp.isScalar) {
          complexType._updateTargetFromRaw(oldVal, rawVal, rawValueFn);
        } else {
          if (Array.isArray(rawVal)) {
            let newVal = rawVal.map(function (rawCo) {
              let newCo = complexType._createInstanceCore(target, dp);
              complexType._updateTargetFromRaw(newCo, rawCo, rawValueFn);
              complexType._initializeInstance(newCo);
              return newCo;
            });
            if (!core.arrayEquals(oldVal, newVal, coEquals)) {
              // clear the old array and push new objects into it.
              oldVal.length = 0;
              newVal.forEach(function (nv) {
                oldVal.push(nv);
              });
            }
          } else {
            oldVal.length = 0;
          }
        }
      } else {
        if (dp.isScalar) {
          let newVal = DataType.parseRawValue(rawVal, dataType as DataType);
          target.setProperty(dp.name, newVal);
        } else {
          oldVal = target.getProperty(dp.name);
          if (Array.isArray(rawVal)) {
            // need to compare values
            let newVal = rawVal.map((rv) => {
              return DataType.parseRawValue(rv, dataType as DataType);
            });
            if (!core.arrayEquals(oldVal, newVal)) {
              // clear the old array and push new objects into it.
              oldVal.length = 0;
              newVal.forEach(function (nv) {
                oldVal.push(nv);
              });
            }
          } else {
            oldVal.length = 0;
          }

        }
      }
    });

    // if merging from an import then raw will have an entityAspect or a complexAspect
    let rawAspect = raw.entityAspect || raw.complexAspect;
    if (rawAspect) {

      let targetAspect = EntityAspect.isEntity(target) ? target.entityAspect : target.complexAspect;
      if (rawAspect.originalValuesMap) {
        targetAspect.originalValues = rawAspect.originalValuesMap;
      }
      if (rawAspect.extraMetadata) {
        targetAspect.extraMetadata = rawAspect.extraMetadata;
      }
    }
  }



  /**
  Returns a string representation of this EntityType.
  **/
  toString() {
    return this.name;
  }

  toJSON() {
    return core.toJson(this, {
      shortName: null,
      namespace: null,
      baseTypeName: null,
      isAbstract: false,
      autoGeneratedKeyType: null, // do not suppress default value
      defaultResourceName: null,
      dataProperties: localPropsOnly,
      navigationProperties: localPropsOnly,
      validators: null,
      custom: null
    });
  }

  /** @hidden @internal */
  _updateNames(property: EntityProperty) {
    let nc = this.metadataStore.namingConvention;
    updateClientServerNames(nc, property, "name");

    if (property.isNavigationProperty) {
      updateClientServerNames(nc, property, "foreignKeyNames");
      updateClientServerNames(nc, property, "invForeignKeyNames");

      // these will get set later via _updateNps
      // this.inverse
      // this.entityType
      // this.relatedDataProperties
      //    dataProperty.relatedNavigationProperty
      //    dataProperty.inverseNavigationProperty
    }
  }

  /** @hidden @internal */
  _checkNavProperty(navigationProperty: NavigationProperty | string) {
    // if (navigationProperty.isNavigationProperty) {
    if (navigationProperty instanceof NavigationProperty) {
      if (navigationProperty.parentType !== this) {
        throw new Error(core.formatString("The navigationProperty '%1' is not a property of entity type '%2'",
          navigationProperty.name, this.name));
      }
      return navigationProperty;
    }

    if (typeof (navigationProperty) === 'string') {
      let np = this.getProperty(navigationProperty);
      // if (np && np.isNavigationProperty) return np;
      if (np && np instanceof NavigationProperty) return np;
    }
    throw new Error("The 'navigationProperty' parameter must either be a NavigationProperty or the name of a NavigationProperty");
  }

  /** @hidden @internal */
  _addDataProperty(dp: DataProperty) {

    this.dataProperties.push(dp);

    if (dp.isPartOfKey) {
      this.keyProperties.push(dp);
    }

    if (dp.isComplexProperty) {
      this.complexProperties.push(dp);
    }

    if (dp.concurrencyMode && dp.concurrencyMode !== "None") {
      this.concurrencyProperties.push(dp);
    }

    if (dp.isUnmapped) {
      this.unmappedProperties.push(dp);
    }

  }

  /** @hidden @internal */
  _addNavigationProperty(np: NavigationProperty) {

    this.navigationProperties.push(np);

    if (!isQualifiedTypeName(np.entityTypeName)) {
      np.entityTypeName = qualifyTypeName(np.entityTypeName, this.namespace);
    }
  }

  /** @hidden @internal */
  _updateCps() {
    let metadataStore = this.metadataStore;
    let incompleteTypeMap = metadataStore._incompleteComplexTypeMap;
    this.complexProperties.forEach(function (cp) {
      if (cp.complexType) return;
      if (!resolveCp(cp, metadataStore)) {
        core.getArray(incompleteTypeMap, cp.complexTypeName).push(cp);
      }
    });

    if (this.isComplexType) {
      (incompleteTypeMap[this.name] || []).forEach(function (cp: DataProperty) {
        resolveCp(cp, metadataStore);
      });
      delete incompleteTypeMap[this.name];
    }
  }

  /** @hidden @internal */
  _updateNps() {
    let metadataStore = this.metadataStore;

    // resolve all navProps for this entityType
    this.navigationProperties.forEach(function (np) {
      tryResolveNp(np, metadataStore);
    });
    let incompleteTypeMap = metadataStore._incompleteTypeMap;
    // next resolve all navProp that point to this entityType.
    (incompleteTypeMap[this.name] || []).forEach(function (np: NavigationProperty) {
      tryResolveNp(np, metadataStore);
    });
    // every navProp that pointed to this type should now be resolved
    delete incompleteTypeMap[this.name];
  }
}

EntityType.prototype._$typeName = "EntityType";

function getRawValueFromConfig(rawEntity: any, dp: DataProperty) {
  // 'true' fork can happen if an initializer contains an actaul instance of an already created complex object.
  return (rawEntity.entityAspect || rawEntity.complexAspect) ? rawEntity.getProperty(dp.name) : rawEntity[dp.name];
}

function updateClientServerNames(nc: NamingConvention, parent: any, clientPropName: string) {
  let serverPropName = clientPropName + "OnServer";
  let clientName = parent[clientPropName];
  if (clientName && clientName.length) {
    // if (parent.isUnmapped) return;
    let serverNames = core.toArray(clientName).map(function (cName) {
      let sName = nc.clientPropertyNameToServer(cName, parent);
      let testName = nc.serverPropertyNameToClient(sName, parent);
      if (cName !== testName) {
        throw new Error("NamingConvention for this client property name does not roundtrip properly:" + cName + "-->" + testName);
      }
      return sName;
    });
    parent[serverPropName] = Array.isArray(clientName) ? serverNames : serverNames[0];
  } else {
    let serverName = parent[serverPropName];
    if ((!serverName) || serverName.length === 0) return;
    let clientNames = core.toArray(serverName).map(function (sName) {
      let cName = nc.serverPropertyNameToClient(sName, parent);
      let testName = nc.clientPropertyNameToServer(cName, parent);
      if (sName !== testName) {
        throw new Error("NamingConvention for this server property name does not roundtrip properly:" + sName + "-->" + testName);
      }
      return cName;
    });
    parent[clientPropName] = Array.isArray(serverName) ? clientNames : clientNames[0];
  }
}

function createEmptyCtor(type: any) {
  let name = type.name.replace(/\W/g, '_');
  return Function('return function ' + name + '(){}')();
}

function coEquals(co1: IComplexObject, co2: IComplexObject): boolean {
  let complexType = co1.complexAspect!.parentProperty!.dataType as ComplexType;
  let dataProps = complexType.dataProperties;
  let areEqual = dataProps.every(function (dp) {
    if (!dp.isSettable) return true;
    let v1 = co1.getProperty(dp.name);
    let v2 = co2.getProperty(dp.name);
    if (dp.isComplexProperty && dp.isScalar) {
      return coEquals(v1, v2);
    }
    else if (dp.isComplexProperty && !dp.isScalar) {
      return core.arrayEquals(v1, v2, coEquals);
    } else {
      let dataType = <any>dp.dataType; // this will be a complexType when dp is a complexProperty
      return (v1 === v2 || (dataType && dataType.normalize && v1 && v2 && dataType.normalize(v1) === dataType.normalize(v2)));
    }
  });
  return areEqual;
}

function localPropsOnly(props: EntityProperty[]) {
  return props.filter(function (prop) {
    return prop.baseProperty == null;
  });
}


function resolveCp(cp: DataProperty, metadataStore: MetadataStore) {
  let complexType = metadataStore._getStructuralType(cp.complexTypeName, true);
  if (!complexType) return false;
  if (!(complexType instanceof ComplexType)) {
    throw new Error("Unable to resolve ComplexType with the name: " + cp.complexTypeName + " for the property: " + cp.name);
  }
  cp.dataType = complexType;
  cp.defaultValue = null;
  return true;
}

function tryResolveNp(np: NavigationProperty, metadataStore: MetadataStore) {
  if (np.entityType) return true;

  let entityType = metadataStore._getStructuralType(np.entityTypeName, true) as EntityType;
  if (entityType) {
    np.entityType = entityType;
    np._resolveNp();
    // don't bother removing - _updateNps will do it later.
    // __arrayRemoveItem(incompleteNps, np, false);
  } else {
    let incompleteNps = core.getArray(metadataStore._incompleteTypeMap, np.entityTypeName);
    core.arrayAddItemUnique(incompleteNps, np);
  }
  return !!entityType;
}

function calcUnmappedProperties(stype: StructuralType, instance: any) {
  let metadataPropNames = stype.getPropertyNames();
  let modelLib = config.interfaceRegistry.modelLibrary.getDefaultInstance();
  let trackablePropNames = modelLib.getTrackablePropertyNames(instance);
  trackablePropNames.forEach(function (pn: string) {
    if (metadataPropNames.indexOf(pn) === -1) {
      let val = instance[pn];
      try {
        if (typeof val === "function") val = val();
      } catch (e) {
      }
      let dt = DataType.fromValue(val);
      let newProp = new DataProperty({
        name: pn,
        dataType: dt,
        isNullable: true,
        isUnmapped: true
      });
      newProp.isSettable = core.isSettable(instance, pn);
      if (stype instanceof EntityType && stype.subtypes != null && stype.subtypes.length) {
        stype.getSelfAndSubtypes().forEach((st) => {
          st._addPropertyCore(new DataProperty(newProp));
        });
      } else {
        stype._addPropertyCore(newProp);
      }
    }
  });
}

export interface ComplexTypeConfig {
  shortName?: string;
  namespace?: string;
  dataProperties?: DataProperty[];
  isComplexType?: boolean;  // needed because this ctor can get called from the addEntityType method which needs the isComplexType prop
  custom?: Object;
}

/**  Container for all of the metadata about a specific type of Complex object.
>     let complexType = new ComplexType( {
>         shortName: "address",
>         namespace: "myAppNamespace"
>     });
@param config - Configuration settings
**/
export class ComplexType {
  /** @hidden @internal */
  _$typeName: string; // on proto
  /** For polymorphic purpose only - always true here */
  isComplexType = true;

  /** The [[MetadataStore]] containing this ComplexType. */
  metadataStore: MetadataStore;

  /**  The fully qualifed name of this ComplexType. __Read Only__  **/
  name: string;
  /**  The short, unqualified, name for this ComplexType. __Read Only__ **/
  shortName: string;

  /** The namespace for this ComplexType. __Read Only__ **/
  namespace: string;
  /** The DataProperties (see [[DataProperty]] associated with this ComplexType. __Read Only__ */
  dataProperties: DataProperty[];
  /** The DataProperties for this ComplexType that contain instances of a [[ComplexType]]. __Read Only__ */
  complexProperties: DataProperty[];

  /**
  The entity level validators associated with this ComplexType. Validators can be added and
  removed from this collection. __Read Only__  **/
  validators: Validator[];
  /** For polymorphic purpose only - always empty here */
  concurrencyProperties: DataProperty[];
  /** The DataProperties associated with this ComplexType that are not mapped to any backend datastore. These are effectively free standing
  properties. __Read Only__   **/
  unmappedProperties: DataProperty[];

  // keyProperties and navigationProperties are not used on complexTypes - but here to allow sharing of code between EntityType and ComplexType.
  navigationProperties: DataProperty[];
  // and may be used later to enforce uniqueness on arrays of complextypes.
  keyProperties: DataProperty[];
  warnings: any[];
  serializerFn?: (prop: EntityProperty, val: any) => any;

  /** A free form object that can be used to define any custom metadata for this ComplexType. ***/
  custom?: any;
  /** @hidden @internal */
  _mappedPropertiesCount: number;
  /** @hidden @internal */
  _extra?: any;

  // copy entityType methods onto complexType
  /** See [[EntityType.getCtor]] */
  getCtor = EntityType.prototype.getCtor;
  // note the name change.
  createInstance = EntityType.prototype.createEntity;
  /** See [EntityType.addValidator] */
  addValidator = EntityType.prototype.addValidator;
  getProperty = EntityType.prototype.getProperty;
  getPropertiesOnPath = EntityType.prototype.getPropertiesOnPath;
  getPropertyNames = EntityType.prototype.getPropertyNames;
  /** @hidden @internal */
  _addPropertyCore = EntityType.prototype._addPropertyCore;
  /** @hidden @internal */
  _addDataProperty = EntityType.prototype._addDataProperty;
  /** @hidden @internal */
  _updateNames = EntityType.prototype._updateNames;
  /** @hidden @internal */
  _updateCps = EntityType.prototype._updateCps;
  /** @hidden @internal */
  _initializeInstance = EntityType.prototype._initializeInstance;
  /** @hidden @internal */
  _updateTargetFromRaw = EntityType.prototype._updateTargetFromRaw;
  /** @hidden @internal */
  _setCtor = EntityType.prototype._setCtor;

  constructor(config: ComplexTypeConfig) {
    if (arguments.length > 1) {
      throw new Error("The ComplexType ctor has a single argument that is a configuration object.");
    }

    assertConfig(config)
      .whereParam("shortName").isNonEmptyString()
      .whereParam("namespace").isString().isOptional().withDefault("")
      .whereParam("dataProperties").isOptional()
      .whereParam("isComplexType").isOptional().isBoolean()   // needed because this ctor can get called from the addEntityType method which needs the isComplexType prop
      .whereParam("custom").isOptional()
      .applyAll(this);

    this.name = qualifyTypeName(this.shortName, this.namespace);
    this.isComplexType = true;
    this.dataProperties = [];
    this.complexProperties = [];
    this.validators = [];
    this.concurrencyProperties = [];
    this.unmappedProperties = [];
    this._mappedPropertiesCount = 0;
    // keyProperties and navigationProperties are not used on complexTypes - but here to allow sharing of code between EntityType and ComplexType.
    this.navigationProperties = [];
    this.keyProperties = []; // may be used later to enforce uniqueness on arrays of complextypes.
    if (config.dataProperties) {
      addProperties(this, config.dataProperties, DataProperty);
    }
  }

  /**
  General purpose property set method
  >      // assume em1 is an EntityManager
  >      let addresstType = em1.metadataStore.getEntityType("Address");
  >      addressType.setProperties( {
  >          custom: { foo: 7, bar: "test" }
  >      });
  @param config - Custom config object
  @param config.custom - {Object}
  **/
  setProperties(config: { custom: Object }) {
    assertConfig(config)
      .whereParam("custom").isOptional()
      .applyAll(this);
  }


  getAllValidators() {
    // ComplexType inheritance is not YET supported.
    return this.validators;
  }

  /** @hidden @internal */
  _createInstanceCore(parent: IStructuralObject, parentProperty: DataProperty) {
    let aCtor = this.getCtor();
    let instance = new aCtor() as IComplexObject;
    new ComplexAspect(instance, parent, parentProperty);
    // initialization occurs during either attach or in createInstance call.
    return instance;
  }


  addProperty(dataProperty: DataProperty) {
    assertParam(dataProperty, "dataProperty").isInstanceOf(DataProperty).check();
    return this._addPropertyCore(dataProperty);
  }

  getProperties(): EntityProperty[] {
    return this.dataProperties;
  }

  toJSON() {
    return core.toJson(this, {
      shortName: null,
      namespace: null,
      isComplexType: null,
      dataProperties: null,
      validators: null,
      custom: null
    });
  }

}
ComplexType.prototype._$typeName = "ComplexType";
/** Creates an instance of this complexType */
ComplexType.prototype.createInstance = EntityType.prototype.createEntity;

export interface DataPropertyConfig {
  name?: string;
  nameOnServer?: string;
  dataType?: DataType | string | ComplexType;
  complexTypeName?: string;
  isNullable?: boolean;
  isScalar?: boolean; // will be false for some NoSQL databases.
  defaultValue?: any;
  isPartOfKey?: boolean;
  isUnmapped?: boolean;
  isSettable?: boolean;
  concurrencyMode?: string;
  maxLength?: number;
  validators?: Validator[];
  displayName?: string;
  enumType?: any;
  rawTypeName?: string;  // occurs with undefined datatypes
  custom?: Object;
}

/**
A DataProperty describes the metadata for a single property of an  [[EntityType]] that contains simple data.

Instances of the DataProperty class are constructed automatically during Metadata retrieval. However it is also possible to construct them
directly via the constructor.
**/
export class DataProperty {
  /** @hidden @internal */
  _$typeName: string; // on proto
  /** Is this a DataProperty? - always true here. Allows polymorphic treatment of DataProperties and NavigationProperties. __Read Only__ */
  isDataProperty = true;
  /** Is this a NavigationProperty? - always false here.  Allows polymorphic treatment of DataProperties and NavigationProperties. __Read Only__ */
  isNavigationProperty = false;
  /** The name of this property. __Read Only__  **/
  name: string;
  /** The name of this property on the server. __Read Only__ **/
  nameOnServer: string;
  /** The [[DataType]] of this property. __Read Only__ */
  dataType: DataType | ComplexType; // this will be a complexType when dp is a complexProperty
  /** The name of the [[ComplexType]] associated with this property; may be null. __Read Only__ */
  complexTypeName: string;
  /** The [[ComplexType]] associated with this property; may be undefined. __Read Only__ */
  complexType?: ComplexType;
  /**  Whether the contents of this property is an instance of a [[ComplexType]]. __Read Only__ */
  isComplexProperty: boolean;
  /** Whether this property is nullable. __Read Only__ */
  isNullable: boolean;
  /**  Whether this property is scalar (i.e., returns a single value as opposed to an array). __Read Only__ */
  isScalar: boolean; // will be false for some NoSQL databases.
  /** The default value for this property. __Read Only__ */
  defaultValue: any;
  /**  Whether this property is a 'key' property. __Read Only__ */
  isPartOfKey: boolean;
  /** Whether this property is an 'unmapped' property. __Read Only__ */
  isUnmapped: boolean;
  /** Whether this property is 'settable'. __Read Only__ */
  isSettable: boolean;
  // TODO: doc this
  concurrencyMode: string;
  /**  The maximum length for the value of this property. Only meaningful for strings. __Read Only__ */
  maxLength?: number;
  /** The [[Validator]] instances that are associated with this property. Validators can be added and
  removed from this collection. __Read Only__ */
  validators: Validator[];
  /** The display name of this property. __Read Only__ */
  displayName: string;
  // TODO: doc this
  enumType?: any;
  /** The raw type name of this property. will only be defined for properties with a DataType of 'Undefined' */
  rawTypeName?: string;  // occurs with undefined datatypes
  /**  A free form object that can be used to define any custom metadata for this DataProperty. __Read Only__ */
  custom?: Object;
  // TODO: doc this
  inverseNavigationProperty?: NavigationProperty;
  /**
  The navigation property related to this property.  Will only be set if this is a foreign key property. __Read Only__ */
  relatedNavigationProperty?: NavigationProperty;
  /** The parent type that this property belongs to - will be either a [[EntityType]] or a [[ComplexType]]. __Read Only__ */
  parentType: StructuralType;
  /** Property on the base type that this property is inherited from. Will be null if the property is not on the base type. __Read Only__ */
  baseProperty?: DataProperty;

  /** DataProperty constructor
  >      let lastNameProp = new DataProperty( {
  >          name: "lastName",
  >          dataType: DataType.String,
  >          isNullable: true,
  >          maxLength: 20
  >      });
  >      // assuming personEntityType is a newly constructed EntityType
  >      personEntityType.addProperty(lastNameProperty);
  @param config - A configuration Object or a DataProperty
  */
  constructor(config: DataPropertyConfig | DataProperty) {
    assertConfig(config)
      .whereParam("name").isString().isOptional()
      .whereParam("nameOnServer").isString().isOptional()
      .whereParam("dataType").isEnumOf(DataType).isOptional().or().isString().or().isInstanceOf(ComplexType)
      .whereParam("complexTypeName").isOptional()
      .whereParam("isNullable").isBoolean().isOptional().withDefault(true)
      .whereParam("isScalar").isOptional().withDefault(true)// will be false for some NoSQL databases.
      .whereParam("defaultValue").isOptional()
      .whereParam("isPartOfKey").isBoolean().isOptional()
      .whereParam("isUnmapped").isBoolean().isOptional()
      .whereParam("isSettable").isBoolean().isOptional().withDefault(true)
      .whereParam("concurrencyMode").isString().isOptional()
      .whereParam("maxLength").isNumber().isOptional()
      .whereParam("validators").isInstanceOf(Validator).isArray().isOptional().withDefault([])
      .whereParam("displayName").isOptional()
      .whereParam("enumType").isOptional()
      .whereParam("rawTypeName").isOptional() // occurs with undefined datatypes
      .whereParam("custom").isOptional()
      .applyAll(this);
    let hasName = !!(this.name || this.nameOnServer);
    if (!hasName) {
      throw new Error("A DataProperty must be instantiated with either a 'name' or a 'nameOnServer' property");
    }
    // name/nameOnServer is resolved later when a metadataStore is available.

    if (this.complexTypeName) {
      this.isComplexProperty = true;
      // this.dataType = null; // TODO: would like to remove this line because dataType will be set later.
    } else if (typeof (this.dataType) === "string") {
      let dt = DataType.fromName(this.dataType);
      if (!dt) {
        throw new Error("Unable to find a DataType enumeration by the name of: " + this.dataType);
      }
      this.dataType = dt;
    } else if (!this.dataType) {
      this.dataType = DataType.String;
    }

    // == as opposed to === is deliberate here.
    if (this.defaultValue == null) {
      if (this.isNullable) {
        this.defaultValue = null;
      } else {
        if (this.isComplexProperty) {
          // what to do? - shouldn't happen from EF - but otherwise ???
        } else if (this.dataType === DataType.Binary) {
          this.defaultValue = "AAAAAAAAJ3U="; // hack for all binary fields but value is specifically valid for timestamp fields - arbitrary valid 8 byte base64 value.
        } else {
          this.defaultValue = (this.dataType as any).defaultValue;
          if (this.defaultValue == null) {
            throw new Error("A nonnullable DataProperty cannot have a null defaultValue. Name: " + (this.name || this.nameOnServer));
          }
        }
      }
    } else if ((this.dataType as any).isNumeric) {
      // in case the defaultValue comes in as a string ( which it does in EF6).
      if (typeof (this.defaultValue) === "string") {
        this.defaultValue = parseFloat(this.defaultValue);
      }
    }

    if (this.isComplexProperty) {
      this.isScalar = this.isScalar == null || this.isScalar === true;
    }

  }

  static getRawValueFromServer(rawEntity: Object, dp: DataProperty) {
    if (dp.isUnmapped) {
      return rawEntity[dp.nameOnServer || dp.name];
    } else {
      let val = rawEntity[dp.nameOnServer];
      return val !== undefined ? val : dp.defaultValue;
    }
  }

  static getRawValueFromClient(rawEntity: Object, dp: DataProperty) {
    let val = rawEntity[dp.name];
    return val !== undefined ? val : dp.defaultValue;
  }

  resolveProperty(propName: string) {
    let result = this[propName];
    let baseProp = this.baseProperty;
    while (result == undefined && baseProp != null) {
      result = baseProp[propName];
      baseProp = baseProp.baseProperty;
    }
    return result;
  }

  formatName() {
    return this.parentType.name + "--" + this.name;
  }


  /**
  General purpose property set method
  >      // assume em1 is an EntityManager
  >      let prop = myEntityType.getProperty("myProperty");
  >      prop.setProperties( {
  >          custom: { foo: 7, bar: "test" }
  >      });
  @param config - A configuration object.
  **/
  setProperties(config: { displayName?: string, custom?: Object }) {
    assertConfig(config)
      .whereParam("displayName").isOptional()
      .whereParam("custom").isOptional()
      .applyAll(this);
  }

  getAllValidators() {
    let validators = this.validators.slice(0);
    let baseProp = this.baseProperty;
    while (baseProp) {
      validators.push.apply(validators, baseProp.validators);
      baseProp = baseProp.baseProperty;
    }
    return validators;
  }

  toJSON() {
    // do not serialize dataTypes that are complexTypes
    return core.toJson(this, {
      name: null,
      dataType: function (v: any) {
        return (v && v instanceof DataType) ? v.name : undefined;
      }, // do not serialize dataTypes that are complexTypes
      complexTypeName: null,
      isNullable: true,
      defaultValue: null,
      isPartOfKey: false,
      isUnmapped: false,
      isSettable: true,
      concurrencyMode: null,
      maxLength: null,
      validators: null,
      displayName: null,
      enumType: null,
      rawTypeName: null,
      isScalar: true,
      custom: null
    });
  }

  static fromJSON(json: any) {
    json.dataType = DataType.fromName(json.dataType);
    // Parse default value into correct data type. (dateTime instances require extra work to deserialize properly.)
    if (json.defaultValue && json.dataType && json.dataType.parse) {
      json.defaultValue = json.dataType.parse(json.defaultValue, typeof json.defaultValue);
    }

    if (json.validators) {
      json.validators = json.validators.map(Validator.fromJSON);
    }

    return new DataProperty(json);
  }

}
DataProperty.prototype._$typeName = "DataProperty";

export interface NavigationPropertyConfig {
  name?: string;
  nameOnServer?: string;
  entityTypeName?: string;
  isScalar?: boolean;
  associationName?: string;
  foreignKeyNames?: string[];
  foreignKeyNamesOnServer?: string[];
  invForeignKeyNames?: string[];
  invForeignKeyNamesOnServer?: string[];
  validators?: Validator[];
  displayName?: string;
  custom?: Object;
}

/**   A NavigationProperty describes the metadata for a single property of an [[EntityType]] that return instances of other EntityTypes.

Instances of the NavigationProperty class are constructed automatically during Metadata retrieval.   However it is also possible to construct them
directly via the constructor.
**/
export class NavigationProperty {
  /** @hidden @internal */
  _$typeName: string;
  /** Is this a DataProperty? - always false here 
  Allows polymorphic treatment of DataProperties and NavigationProperties. __Read Only__ */
  isDataProperty = false;
  /** Is this a NavigationProperty? - always true here
  Allows polymorphic treatment of DataProperties and NavigationProperties. __Read Only__ */
  isNavigationProperty = true;

  formatName = DataProperty.prototype.formatName;
  getAllValidators = DataProperty.prototype.getAllValidators;
  resolveProperty = DataProperty.prototype.resolveProperty;

  /** The [[EntityType]] returned by this property. __Read Only__ */
  entityType: EntityType;
  /** The name of the [[EntityType]] returned by this property. __Read Only__ */
  entityTypeName: string;
  /** The [[EntityType]] that this property belongs to. ( same as entityType). __Read Only__ */
  parentType: EntityType; // ?? same as entityType
  /** The [[EntityType]] that this property belongs to. ( same as entityType). __Read Only__ */
  parentEntityType: EntityType; // ?? same as above
  /** Property on the base type that this property is inherited from. Will be null if the property is not on the base type. __Read Only__ */
  baseProperty?: NavigationProperty;
  /** The inverse of this NavigationProperty.  The NavigationProperty that represents a navigation in the opposite direction
  to this NavigationProperty. May be undefined for a undirectional NavigationProperty. __Read Only__ */
  private _inverse?: NavigationProperty;
  /** The name of this property. __Read Only__ */
  name: string;
  /** The name of this property on the server. __Read Only__ */
  nameOnServer: string;
  /**
  Whether this property returns a single entity as opposed to  an array of entities. __Read Only__ */
  isScalar: boolean;
  /** The name of the association to which that this property belongs.  This associationName will be shared with this
  properties 'inverse'. __Read Only__ */
  associationName: string;
  /** The names of the foreign key DataProperties associated with this NavigationProperty. There will usually only be a single DataProperty associated
  with a Navigation property except in the case of entities with multipart keys. __Read Only__ */
  foreignKeyNames: string[];
  /** The server side names of the foreign key DataProperties associated with this NavigationProperty. There will usually only be a single DataProperty associated
  with a Navigation property except in the case of entities with multipart keys. __Read Only__ */
  foreignKeyNamesOnServer: string[];
  invForeignKeyNames: string[];
  invForeignKeyNamesOnServer: string[];
  /** The 'foreign key' DataProperties associated with this NavigationProperty. There will usually only be a single DataProperty associated
  with a Navigation property except in the case of entities with multipart keys. __Read Only__ */
  relatedDataProperties: DataProperty[];
  /** The [[Validator]] instances that are associated with this property. Validators can be added and
  removed from this collection. __Read Only__ */
  validators: Validator[];
  /** The display name of this property. __Read Only__ */
  displayName: string;
  isUnmapped: boolean;
  /** A free form object that can be used to define any custom metadata for this NavigationProperty.   **/
  custom: Object;

  /** NavigationProperty constructor
  >      let homeAddressProp = new NavigationProperty( {
  >          name: "homeAddress",
  >          entityTypeName: "Address:#myNamespace",
  >          isScalar: true,
  >          associationName: "address_person",
  >          foreignKeyNames: ["homeAddressId"]
  >      });
  >      let homeAddressIdProp = new DataProperty( {
  >          name: "homeAddressId"
  >          dataType: DataType.Integer
  >      });
  >      // assuming personEntityType is a newly constructed EntityType
  >      personEntityType.addProperty(homeAddressProp);
  >      personEntityType.addProperty(homeAddressIdProp);
  @param config - A configuration object.
  **/
  constructor(config: NavigationPropertyConfig) {
    assertConfig(config)
      .whereParam("name").isString().isOptional()
      .whereParam("nameOnServer").isString().isOptional()
      .whereParam("entityTypeName").isString()
      .whereParam("isScalar").isBoolean().isOptional().withDefault(true)
      .whereParam("associationName").isString().isOptional()
      .whereParam("foreignKeyNames").isArray().isString().isOptional().withDefault([])
      .whereParam("foreignKeyNamesOnServer").isArray().isString().isOptional().withDefault([])
      .whereParam("invForeignKeyNames").isArray().isString().isOptional().withDefault([])
      .whereParam("invForeignKeyNamesOnServer").isArray().isString().isOptional().withDefault([])
      .whereParam("validators").isInstanceOf(Validator).isArray().isOptional().withDefault([])
      .whereParam("displayName").isOptional()
      .whereParam("custom").isOptional()
      .applyAll(this);
    let hasName = !!(this.name || this.nameOnServer);

    if (!hasName) {
      throw new Error("A Navigation property must be instantiated with either a 'name' or a 'nameOnServer' property");
    }
  }

  /**
  General purpose property set method
  >      // assume myEntityType is an EntityType
  >      let prop = myEntityType.getProperty("myProperty");
  >      prop.setProperties( {
  >          custom: { foo: 7, bar: "test" }
  >      });
  @param config - A config object
  **/
  // TODO: create an interface for this.
  setProperties(config: {
    displayName?: string,
    foreignKeyNames?: string[],
    invForeignKeyNames?: string[],
    inverse?: NavigationProperty | string,
    custom?: Object
  }) {
    if (!this.parentType) {
      throw new Error("Cannot call NavigationProperty.setProperties until the parent EntityType of the NavigationProperty has been set.");
    }
    let inverse = config.inverse;
    if (inverse) delete config.inverse;
    assertConfig(config)
      .whereParam("displayName").isOptional()
      .whereParam("foreignKeyNames").isArray().isString().isOptional().withDefault([])
      .whereParam("invForeignKeyNames").isArray().isString().isOptional().withDefault([])
      .whereParam("custom").isOptional()
      .applyAll(this);
    this.parentType._updateNames(this);

    this._resolveNp();
    if (inverse) {
      this.setInverse(inverse);
    }

  }

  /** The inverse of this NavigationProperty.  The NavigationProperty that represents a navigation in the opposite direction
  to this NavigationProperty. May be undefined for a undirectional NavigationProperty. __Read Only__ */
  get inverse(): NavigationProperty | undefined {
    return this.getInverse();
  }

  /** @hidden @internal */
  getInverse(): NavigationProperty | undefined {
    let np: NavigationProperty = this;
    while (!np._inverse && np.baseProperty) {
      np = np.baseProperty;
    }
    return np._inverse;
  }

  setInverse(inverseNp: NavigationProperty | string) {
    // let invNp: NavigationProperty;
    let invNp = (inverseNp instanceof NavigationProperty) ? inverseNp : this.entityType.getNavigationProperty(inverseNp);

    if (!invNp) {
      throw throwSetInverseError(this, "Unable to find inverse property: " + inverseNp);
    }

    if (this._inverse || invNp._inverse) {
      throwSetInverseError(this, "It has already been set on one side or the other.");
    }
    if (invNp.entityType !== this.parentType) {
      throwSetInverseError(this, invNp.formatName + " is not a valid inverse property for this.");
    }
    if (this.associationName) {
      invNp.associationName = this.associationName;
    } else {
      if (!invNp.associationName) {
        invNp.associationName = this.formatName() + "_" + invNp.formatName();
      }
      this.associationName = invNp.associationName;
    }
    this._resolveNp();
    invNp._resolveNp();
  }

  // // In progress - will be used for manual metadata config
  // createInverse(config: any) {

  //   if (!this.entityType) {
  //     throwCreateInverseError(this, "has not yet been defined.");
  //   }
  //   if (this.entityType.isFrozen) {
  //     throwCreateInverseError(this, "is frozen.");
  //   }
  //   let metadataStore = this.entityType.metadataStore;
  //   if (metadataStore == null) {
  //     throwCreateInverseError(this, "has not yet been added to the metadataStore.");
  //   }

  //   config.entityTypeName = this.parentEntityType.name;
  //   config.associationName = this.associationName;
  //   let invNp = new NavigationProperty(config);
  //   this.parentEntityType.addNavigationProperty(invNp);
  //   return invNp;
  // };



  toJSON() {
    return core.toJson(this, {
      name: null,
      entityTypeName: null,
      isScalar: null,
      associationName: null,
      validators: null,
      displayName: null,
      foreignKeyNames: null,
      invForeignKeyNames: null,
      custom: null
    });
  }

  static fromJSON(json: any) {
    if (json.validators) {
      json.validators = json.validators.map(Validator.fromJSON);
    }
    return new NavigationProperty(json);
  }

  /** @hidden @internal */
  _resolveNp() {
    let np = this;
    let entityType = np.entityType;
    let invNp = core.arrayFirst(entityType.navigationProperties, (altNp) => {
      // Can't do this because of possibility of comparing a base class np with a subclass altNp.
      // return altNp.associationName === np.associationName
      //    && altNp !== np;
      // So use this instead.
      return altNp.associationName === np.associationName &&
        (altNp.name !== np.name || altNp.entityTypeName !== np.entityTypeName);
    });
    np._inverse = invNp || undefined;
    //if (invNp && invNp.inverse == null) {
    //    invNp._resolveNp();
    //}
    if (!invNp) {
      // unidirectional 1-n relationship
      np.invForeignKeyNames.forEach(function (invFkName) {
        let fkProp = entityType.getDataProperty(invFkName);
        if (fkProp == null) {
          throw new Error("EntityType '" + np.entityTypeName + "' has no foreign key matching '" + invFkName + "'");
        }
        let invEntityType = np.parentType;
        invNp = core.arrayFirst(invEntityType.navigationProperties, (np2) => {
          return np2.invForeignKeyNames && np2.invForeignKeyNames.indexOf(fkProp!.name) >= 0 && np2.entityType === fkProp!.parentType;
        });
        fkProp.inverseNavigationProperty = invNp || undefined;
        core.arrayAddItemUnique(entityType.foreignKeyProperties, fkProp);
      });
    }

    resolveRelated(np);
  }

}
NavigationProperty.prototype._$typeName = "NavigationProperty";

function throwSetInverseError(np: NavigationProperty, message: string) {
  throw new Error("Cannot set the inverse property for: " + np.formatName() + ". " + message);
}

// Not current used.
// function throwCreateInverseError(np: NavigationProperty, message: string) {
//   throw new Error("Cannot create inverse for: " + np.formatName() + ". The entityType for this navigation property " + message);
// }

// sets navigation property: relatedDataProperties and dataProperty: relatedNavigationProperty
function resolveRelated(np: NavigationProperty) {

  let fkNames = np.foreignKeyNames;
  if (fkNames.length === 0) return;

  let parentEntityType = np.parentType;
  let fkProps = fkNames.map(function (fkName) {
    return parentEntityType.getDataProperty(fkName);
  });
  let fkPropCollection = parentEntityType.foreignKeyProperties;

  fkProps.forEach((dp: DataProperty) => {
    core.arrayAddItemUnique(fkPropCollection, dp);
    dp.relatedNavigationProperty = np;
    // now update the inverse
    core.arrayAddItemUnique(np.entityType.inverseForeignKeyProperties, dp);
    if (np.relatedDataProperties) {
      core.arrayAddItemUnique(np.relatedDataProperties, dp);
    } else {
      np.relatedDataProperties = [dp];
    }
  });
}


/**
AutoGeneratedKeyType is an 'Enum' containing all of the valid states for an automatically generated key.
**/
export class AutoGeneratedKeyType extends BreezeEnum {

  /**
  This entity does not have an autogenerated key.
  The client must set the key before adding the entity to the EntityManager
  **/
  static None = new AutoGeneratedKeyType();
  /** 
  This entity's key is an Identity column and is set by the backend database.
  Keys for new entities will be temporary until the entities are saved at which point the keys will
  be converted to their 'real' versions.
  **/
  static Identity = new AutoGeneratedKeyType();
  /**
  This entity's key is generated by a KeyGenerator and is set by the backend database.
  Keys for new entities will be temporary until the entities are saved at which point the keys will
  be converted to their 'real' versions.
  **/
  static KeyGenerator = new AutoGeneratedKeyType();

}
AutoGeneratedKeyType.resolveSymbols();


// mixin methods
/** @hidden @internal */
declare module "./assert-param" {
  interface Param {
    isEntity(): Param;
    isEntityProperty(): Param;
  }
}

let proto = Param.prototype;

// 'this' below is TS annotation 
proto.isEntity = function (this: Param) {
  return this._addContext({
    fn: isEntity,
    msg: " must be an entity"
  });
};

function isEntity(context: any, v: any) {
  if (v == null) return false;
  return (v.entityType !== undefined);
}

proto.isEntityProperty = function (this: Param) {
  return this._addContext({
    fn: isEntityProperty,
    msg: " must be either a DataProperty or a NavigationProperty"
  });
};

function isEntityProperty(context: any, v: any) {
  if (v == null) return false;
  return (v.isDataProperty || v.isNavigationProperty);
}

// functions shared between classes related to Metadata

function isQualifiedTypeName(entityTypeName: string) {
  return entityTypeName.indexOf(":#") >= 0;
}

function qualifyTypeName(shortName: string, ns?: string) {
  if (ns && ns.length > 0) {
    return shortName + ":#" + ns;
  } else {
    return shortName;
  }
}

// Used by both ComplexType and EntityType
function addProperties(entityType: StructuralType, propObj: Object | undefined, ctor: any) {
  if (propObj == null) return;
  if (Array.isArray(propObj)) {
    propObj.forEach(entityType._addPropertyCore.bind(entityType));
  } else if (typeof (propObj) === 'object') {
    for (let key in propObj) {
      if (core.hasOwnProperty(propObj, key)) {
        let value = propObj[key];
        value.name = key;
        let prop = new ctor(value);
        entityType._addPropertyCore(prop);
      }
    }
  } else {
    throw new Error("The 'dataProperties' or 'navigationProperties' values must be either an array of data/nav properties or an object where each property defines a data/nav property");
  }
}





