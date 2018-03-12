import { EntityType, NavigationProperty } from './entity-metadata';
import { IDataServiceAdapter, IUriBuilderAdapter } from './interface-registry';
import { IKeyMapping } from './entity-manager';
import { MappingContext } from './mapping-context';
import { assertConfig } from './assert-param';
import { config } from './config';
import { core } from './core';

/** Configuration info to be passed to the [[DataService]] constructor */
export interface DataServiceConfig {
  /** The serviceName for this DataService.  **/
  serviceName?: string;
  /** The adapter name for the [[IDataServiceAdapter]] to be used with this service.  **/
  adapterName?: string;
  /** The adapter name for the [[IUriBuilderAdapter]] to be used with this service.  **/
  uriBuilderName?: string;
  /** Whether the server can provide metadata for this service.  **/
  hasServerMetadata?: boolean;
  /** The [[JsonResultsAdapter]] used to process the results of any query against this DataService.  **/
  jsonResultsAdapter?: JsonResultsAdapter;
  /** Whether to use JSONP when performing a 'GET' request against this service.  **/
  useJsonp?: boolean;
}
/**
A DataService instance is used to encapsulate the details of a single 'service'; this includes a serviceName, a dataService adapterInstance,
and whether the service has server side metadata.

You can construct an EntityManager with either a serviceName or a DataService instance, if you use a serviceName then a DataService
is constructed for you.  (It can also be set via the EntityManager.setProperties method).

The same applies to the MetadataStore.fetchMetadata method, i.e. it takes either a serviceName or a DataService instance.

Each metadataStore contains a list of DataServices, each accessible via its ‘serviceName’.
( see MetadataStore.getDataService and MetadataStore.addDataService).  The ‘addDataService’ method is called internally
anytime a MetadataStore.fetchMetadata call occurs with a new dataService ( or service name).

**/
export class DataService {
  /** @hidden @internal */
  _$typeName: string; // actually put on prototype.
  /** The serviceName for this DataService. __Read Only__ **/
  serviceName: string;
  /** The adapter name for the [[IDataServiceAdapter]] to be used with this service. __Read Only__  **/
  adapterName: string;
  /**  The [[IDataServiceAdapter]] implementation instance associated with this EntityManager. __Read Only__  **/
  adapterInstance?: IDataServiceAdapter;
  /** The adapter name for the [[IUriBuilderAdapter]] to be used with this service. __Read Only__  **/
  uriBuilderName: string;
  /**  The [[IUriBuilderAdapter]] implementation instance associated with this EntityManager. __Read Only__  **/
  uriBuilder?: IUriBuilderAdapter;
  /** Whether the server can provide metadata for this service. __Read Only__   **/
  hasServerMetadata: boolean;
  /** The [[JsonResultsAdapter]] used to process the results of any query against this DataService. __Read Only__ **/
  jsonResultsAdapter: JsonResultsAdapter;
  /** Whether to use JSONP when performing a 'GET' request against this service. __Read Only__  **/
  useJsonp: boolean;

  /**   DataService constructor
  >     var dataService = new DataService({
  >         serviceName: altServiceName,
  >         hasServerMetadata: false
  >     });

  >     var metadataStore = new MetadataStore({
  >         namingConvention: NamingConvention.camelCase
  >     });

  >     return new EntityManager({
  >         dataService: dataService,
  >         metadataStore: metadataStore
  >     });
  @param config - A configuration object.
  **/
  constructor(config?: DataServiceConfig) {
    updateWithConfig(this, config);
  }


  /**
  Returns a copy of this DataService with the specified properties applied.
  @param config - The configuration object to apply to create a new DataService.
  **/
  using(config: DataServiceConfig) {
    if (!config) return this;
    let result = new DataService(this);
    return updateWithConfig(result, config);
  }

  static resolve(dataServices: DataService[]) {
    // final defaults
    // Deliberate use of 'as any' below.
    (dataServices as any).push({
      hasServerMetadata: true,
      useJsonp: false
    });
    let ds = new DataService(core.resolveProperties(dataServices,
        ["serviceName", "adapterName", "uriBuilderName", "hasServerMetadata", "jsonResultsAdapter", "useJsonp"]));

    if (!ds.serviceName) {
      throw new Error("Unable to resolve a 'serviceName' for this dataService");
    }
    ds.adapterInstance = ds.adapterInstance || config.getAdapterInstance<IDataServiceAdapter>("dataService", ds.adapterName);
    ds.jsonResultsAdapter = ds.jsonResultsAdapter || ds.adapterInstance!.jsonResultsAdapter;
    ds.uriBuilder = ds.uriBuilder || config.getAdapterInstance<IUriBuilderAdapter>("uriBuilder", ds.uriBuilderName);
    return ds;
  }

  /** @hidden @internal */
  static _normalizeServiceName(serviceName: string) {
    serviceName = serviceName.trim();
    if (serviceName.substr(-1) !== "/") {
      return serviceName + '/';
    } else {
      return serviceName;
    }
  }

  /**  */
  toJSON() {
    // don't use default value here - because we want to be able to distinguish undefined props for inheritence purposes.
    return core.toJson(this, {
      serviceName: null,
      adapterName: null,
      uriBuilderName: null,
      hasServerMetadata: null,
      jsonResultsAdapter: function (v: any) {
        return v && v.name;
      },
      useJsonp: null
    });
  }

  static fromJSON(json: any) {
    json.jsonResultsAdapter = config._fetchObject(JsonResultsAdapter, json.jsonResultsAdapter);
    return new DataService(json);
  }

  /**
   Returns a url for this dataService with the specified suffix. This method handles dataService names either
   with or without trailing '/'s.
   @method qualifyUrl
   @param suffix {String} The resulting url.
   @return {a Url string}
   **/
  qualifyUrl(suffix: string) {
    let url = this.serviceName;
    // remove any trailing "/"
    if (core.stringEndsWith(url, "/")) {
      url = url.substr(0, url.length - 1);
    }
    // ensure that it ends with "/" + suffix
    suffix = "/" + suffix;
    if (!core.stringEndsWith(url, suffix)) {
      url = url + suffix;
    }
    return url;
  }

}
DataService.prototype._$typeName = "DataService";

function updateWithConfig(obj: DataService, dsConfig?: DataServiceConfig) {
  if (dsConfig) {
    assertConfig(dsConfig)
        .whereParam("serviceName").isOptional()
        .whereParam("adapterName").isString().isOptional()
        .whereParam("uriBuilderName").isString().isOptional()
        .whereParam("hasServerMetadata").isBoolean().isOptional()
        .whereParam("jsonResultsAdapter").isInstanceOf(JsonResultsAdapter).isOptional()
        .whereParam("useJsonp").isBoolean().isOptional()
        .applyAll(obj);
    obj.serviceName = obj.serviceName && DataService._normalizeServiceName(obj.serviceName);
    obj.adapterInstance = obj.adapterName ?  config.getAdapterInstance<IDataServiceAdapter>("dataService", obj.adapterName) : undefined;
    obj.uriBuilder = obj.uriBuilderName ? config.getAdapterInstance<IUriBuilderAdapter>("uriBuilder", obj.uriBuilderName) : undefined;
  }
  return obj;
}

export interface INodeMeta {
  entityType?: EntityType;
  nodeId?: string;
  nodeRefId?: string;
  ignore?: boolean;
  passThru?: boolean;
  extraMetadata?: any;
}

export interface INodeContext {
  nodeType: string;
  propertyName?: string;
  navigationProperty?: NavigationProperty;
}

/** Configuration info to be passed to the [[JsonResultsAdapter]] constructor */
export interface JsonResultsAdapterConfig {
  /** The name of this adapter.  This name is used to uniquely identify and locate this instance when an 'exported' JsonResultsAdapter is later imported. */
  name?: string;
  /** A Function that is called once per query operation to extract the 'payload' from any json received over the wire. 
  This method has a default implementation which to simply return the "results" property from any json returned as a result of executing the query. 
  */
  extractResults?: Function;
  /** A function that is called once per save operation to extract the entities from any json received over the wire.  Must return an array.
  This method has a default implementation which simply returns the "entities" property from any json returned as a result of executing the save. */
  extractSaveResults?: Function;
  /** A function that is called once per save operation to extract the key mappings from any json received over the wire.  Must return an array.
  This method has a default implementation which simply returns the "keyMappings" property from any json returned as a result of executing the save. */
  extractKeyMappings?: (data: {}) => IKeyMapping[];
  /** A function that is called once per save operation to extract any deleted keys from any json received over the wire.  Must return an array.
  This method has a default implementation which simply returns an empty array. */
  extractDeletedKeys?: (data: {}) => any[]; // TODO: refine
  /** A visitor method that will be called on each node of the returned payload. */
  visitNode?: (v: any, mc: MappingContext, nodeContext: INodeContext) => INodeMeta;

}

/**
A JsonResultsAdapter instance is used to provide custom extraction and parsing logic on the json results returned by any web service.
This facility makes it possible for breeze to talk to virtually any web service and return objects that will be first class 'breeze' citizens.
**/
export class JsonResultsAdapter {
  /** @hidden @internal */
  _$typeName: string; // actually put on prototype.
  /** The name of this adapter.  This name is used to uniquely identify and locate this instance when an 'exported' JsonResultsAdapter is later imported. */
  name: string;
  /** A Function that is called once per query operation to extract the 'payload' from any json received over the wire. 
  This method has a default implementation which simply returns the "results" property from any json returned as a result of executing the query. */
  extractResults: Function; // TODO - refine
  /** A function that is called once per save operation to extract the entities from any json received over the wire.  Must return an array.
  This method has a default implementation which simply returns the "entities" property from any json returned as a result of executing the save. */
  extractSaveResults: Function;
    /** A function that is called once per save operation to extract the key mappings from any json received over the wire.  Must return an array.
  This method has a default implementation which simply returns the "keyMappings" property from any json returned as a result of executing the save. */
  extractKeyMappings:  (data: {}) => IKeyMapping[];
  /** A function that is called once per save operation to extract any deleted keys from any json received over the wire.  Must return an array.
  This method has a default implementation which is to simply returns the "deletedKeys" property from any json returned as a result of executing the save. */
  extractDeletedKeys?: (data: {}) => any[]; // TODO: refine
  /** A visitor method that will be called on each node of the returned payload. */
  visitNode: Function;

  /**
  JsonResultsAdapter constructor

  @example
      //
      var jsonResultsAdapter = new JsonResultsAdapter({
          name: "test1e",
          extractResults: function(json) {
              return json.results;
          },
          visitNode: function(node, mappingContext, nodeContext) {
              var entityType = normalizeTypeName(node.$type);
              var propertyName = nodeContext.propertyName;
              var ignore = propertyName && propertyName.substr(0, 1) === "$";

              return {
                  entityType: entityType,
                  nodeId: node.$id,
                  nodeRefId: node.$ref,
                  ignore: ignore,
                  passThru: false // default
              };
          }
      });

      var dataService = new DataService( {
              serviceName: "breeze/foo",
              jsonResultsAdapter: jsonResultsAdapter
      });

      var entityManager = new EntityManager( {
          dataService: dataService
      });

  @param config - A configuration object.

  **/
  constructor(jsConfig: JsonResultsAdapterConfig) {
    if (arguments.length !== 1) {
      throw new Error("The JsonResultsAdapter ctor should be called with a single argument that is a configuration object.");
    }

    assertConfig(jsConfig)
        .whereParam("name").isNonEmptyString()
        .whereParam("extractResults").isFunction().isOptional().withDefault(extractResultsDefault)
        .whereParam("extractSaveResults").isFunction().isOptional().withDefault(extractSaveResultsDefault)
        .whereParam("extractKeyMappings").isFunction().isOptional().withDefault(extractKeyMappingsDefault)
        .whereParam("extractDeletedKeys").isFunction().isOptional().withDefault(extractDeletedKeysDefault)
        .whereParam("visitNode").isFunction()
        .applyAll(this);
    config._storeObject(this, "JsonResultsAdapter", this.name);
  }

}
JsonResultsAdapter.prototype._$typeName = "JsonResultsAdapter";

function extractResultsDefault(data: any) {
  return data.results;
}

function extractSaveResultsDefault(data: any) {
  return data.entities || data.Entities || [];
}

function extractKeyMappingsDefault(data: any) {
  return data.keyMappings || data.KeyMappings || [];
}

function extractDeletedKeysDefault(data: any) {
  return data.deletedKeys || data.DeletedKeys || [];
}

