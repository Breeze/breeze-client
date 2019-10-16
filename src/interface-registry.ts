import { core } from './core';
import { assertConfig } from './assert-param';
import { config, InterfaceDef, BaseAdapter } from './config';
import { MappingContext } from './mapping-context';
import { EntityQuery } from './entity-query';
import { MetadataStore } from './entity-metadata';
import { JsonResultsAdapter, DataService } from './data-service';
import { Entity } from './entity-aspect';
import { SaveContext, SaveBundle, QueryResult, SaveResult, HttpResponse } from './entity-manager';

export interface InterfaceRegistryConfig {
    ajax?: InterfaceDef<AjaxAdapter>;
    modelLibrary?: InterfaceDef<ModelLibraryAdapter>;
    dataService?: InterfaceDef<DataServiceAdapter>;
    uriBuilder?: InterfaceDef<UriBuilderAdapter>;
}

export class InterfaceRegistry {
    ajax = new InterfaceDef<AjaxAdapter>("ajax");
    modelLibrary = new InterfaceDef<ModelLibraryAdapter>("modelLibrary");
    dataService = new InterfaceDef<DataServiceAdapter>("dataService");
    uriBuilder = new InterfaceDef<UriBuilderAdapter>("uriBuilder");
}

// This module describes the interfaceRegistry by extending config
/** @hidden @internal */
declare module "./config" {
    interface BreezeConfig {
        /**
        Initializes a collection of adapter implementations and makes each one the default for its corresponding interface.
        @method initializeAdapterInstances
        @param config {Object}
        @param [config.ajax] {String} - the name of a previously registered "ajax" adapter
        @param [config.dataService] {String} - the name of a previously registered "dataService" adapter
        @param [config.modelLibrary] {String} - the name of a previously registered "modelLibrary" adapter
        @param [config.uriBuilder] {String} - the name of a previously registered "uriBuilder" adapter
        @return [array of instances]
        **/
        initializeAdapterInstances(irConfig: InterfaceRegistryConfig): void;

        // strongly typed version
        interfaceRegistry: InterfaceRegistry;
    }
}

config.interfaceRegistry = new InterfaceRegistry();
config._interfaceRegistry = config.interfaceRegistry;
config.interfaceRegistry.modelLibrary.getDefaultInstance = function() {
    if (!this.defaultInstance) {
        throw new Error("Unable to locate the default implementation of the '" + this.name +
            "' interface.  Possible options are 'ko', 'backingStore' or 'backbone'. See the breeze.config.initializeAdapterInstances method.");
    }
    return this.defaultInstance;
};

/**
Initializes a collection of adapter implementations and makes each one the default for its corresponding interface.
@method initializeAdapterInstances
@param config {Object}
@param [config.ajax] {String} - the name of a previously registered "ajax" adapter
@param [config.dataService] {String} - the name of a previously registered "dataService" adapter
@param [config.modelLibrary] {String} - the name of a previously registered "modelLibrary" adapter
@param [config.uriBuilder] {String} - the name of a previously registered "uriBuilder" adapter
@return [array of instances]
**/
config.initializeAdapterInstances = function (irConfig: InterfaceRegistryConfig) {
    assertConfig(irConfig)
        .whereParam("dataService").isOptional()
        .whereParam("modelLibrary").isOptional()
        .whereParam("ajax").isOptional()
        .whereParam("uriBuilder").isOptional()
        .applyAll(this, false);
    return core.objectMap(config, this.initializeAdapterInstance);
};

/** DataServiceAdapter Ajax request configuration */
export interface AjaxConfig {
    url: string;
    type?: string;
    dataType?: string;
    contentType?: string | boolean;
    crossDomain?: string | boolean;
    headers?: {};
    data?: any;
    params?: {};
    success: (res: HttpResponse) => void;
    error: (res: (HttpResponse | Error)) => void;
}

export interface AjaxAdapter extends BaseAdapter {
    ajax(config: AjaxConfig): void;
}

export interface ModelLibraryAdapter extends BaseAdapter {
    getTrackablePropertyNames: (entity: any) => string[];
    initializeEntityPrototype(proto: Object): void;
    startTracking(entity: any, entityCtor: Function): void;
    createCtor?: Function;
}

export interface DataServiceAdapter extends BaseAdapter {
    fetchMetadata(metadataStore: MetadataStore, dataService: DataService): Promise<any>;  // result of Promise is either rawMetadata or a string explaining why not.
    executeQuery(mappingContext: MappingContext): Promise<QueryResult>;   // result of executeQuery will get passed to JsonResultsAdapter extractResults method
    saveChanges(saveContext: SaveContext, saveBundle: SaveBundle): Promise<SaveResult>;
    changeRequestInterceptor: ChangeRequestInterceptorCtor;
    jsonResultsAdapter: JsonResultsAdapter;
}



export interface UriBuilderAdapter extends BaseAdapter {
    buildUri(query: EntityQuery, metadataStore: MetadataStore): string;
}

// -----------------------------------

export interface ChangeRequestInterceptorCtor {
    new (saveContext: SaveContext, saveBundle: SaveBundle): ChangeRequestInterceptor;
}

export interface ChangeRequestInterceptor {
    oneTime?: boolean;
    /**
     Prepare and return the save data for an entity change-set.
  
     The adapter calls this method for each entity in the change-set,
     after it has prepared a "change request" for that object.
  
     The method can do anything to the request but it must return a valid, non-null request.
     @example
     this.getRequest = function (request, entity, index) {
            // alter the request that the adapter prepared for this entity
            // based on the entity, saveContext, and saveBundle
            // e.g., add a custom header or prune the originalValuesMap
            return request;
        };
     @method getRequest
     @param request {Object} The object representing the adapter's request to save this entity.
     @param entity {Entity} The entity-to-be-save as it is in cache
     @param index {Integer} The zero-based index of this entity in the change-set array
     @return {Function} The potentially revised request.
     **/
    getRequest(request: any, entity: Entity, index: number): any;

    /**
     Last chance to change anything about the 'requests' array
     after it has been built with requests for all of the entities-to-be-saved.
  
     The 'requests' array is the same as 'saveBundle.entities' in many implementations
  
     This method can do anything to the array including add and remove requests.
     It's up to you to ensure that server will accept the requests array data as valid.
  
     Returned value is ignored.
     @example
     this.done = function (requests) {
            // alter the array of requests representing the entire change-set
            // based on the saveContext and saveBundle
        };
     @method done
     @param requests {Array of Object} The adapter's array of request for this changeset.
     **/
    done(requests: Object[]): void;
}