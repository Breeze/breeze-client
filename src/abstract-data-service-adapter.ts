import { core } from './core';
import { config } from './config';
import { EntityQuery } from './entity-query';
import { DataServiceAdapter, AjaxAdapter, ChangeRequestInterceptorCtor, ChangeRequestInterceptor } from './interface-registry';
import { Entity } from './entity-aspect';
import { MappingContext } from './mapping-context';
import { DataService, JsonResultsAdapter } from './data-service';
import { HttpResponse, SaveContext, SaveBundle, ServerError, SaveResult, SaveErrorFromServer, QueryResult } from './entity-manager';
import { EntityType, MetadataStore } from './entity-metadata';

/** For use by breeze plugin authors only.  The class is used as the base class for most [[IDataServiceAdapter]] implementations
@adapter (see [[IDataServiceAdapter]])    
@hidden
*/
export abstract class AbstractDataServiceAdapter implements DataServiceAdapter {
  /** @hidden @internal */
  declare _$impl?: any;
  /** The name of this adapter. */
  declare name: string;
  /** The [[IAjaxAdapter]] used by this [[IDataServiceAdapter]]. */
  declare ajaxImpl: AjaxAdapter;

  // TODO use interface
  checkForRecomposition(interfaceInitializedArgs: any) {
    if (interfaceInitializedArgs.interfaceName === "ajax" && interfaceInitializedArgs.isDefault) {
      this.initialize();
    }
  }

  initialize() {
    this.ajaxImpl = config.getAdapterInstance<AjaxAdapter>("ajax") !;

    // don't cache 'ajax' because then we would need to ".bind" it, and don't want to because of brower support issues.
    if (this.ajaxImpl && this.ajaxImpl.ajax) {
      return;
    }
    throw new Error("Unable to find ajax adapter for dataservice adapter '" + (this.name || '') + "'.");
  }

  fetchMetadata(metadataStore: MetadataStore, dataService: DataService) {
    let serviceName = dataService.serviceName;
    let url = dataService.qualifyUrl("Metadata");

    let promise = new Promise((resolve, reject) => {

      this.ajaxImpl.ajax({
        type: "GET",
        url: url,
        dataType: 'json',
        success: (httpResponse: HttpResponse) => {

          // might have been fetched by another query
          if (metadataStore.hasMetadataFor(serviceName)) {
            return resolve("already fetched");
          }
          let data = httpResponse.data;
          let metadata: any;
          try {
            metadata = typeof (data) === "string" ? JSON.parse(data) : data;
            metadataStore.importMetadata(metadata);
          } catch (e) {
            let errMsg = "Unable to either parse or import metadata: " + e.message;
            handleHttpError(reject, httpResponse, "Metadata query failed for: " + url + ". " + errMsg);
          }

          // import may have brought in the service.
          if (!metadataStore.hasMetadataFor(serviceName)) {
            metadataStore.addDataService(dataService);
          }

          resolve(metadata);

        },
        error: (httpResponse: HttpResponse) => {
          handleHttpError(reject, httpResponse, "Metadata query failed for: " + url);
        }
      });
    });
    return promise;
  }

  /** Execute the query in the mappingContext using the ajaxImpl. */
  executeQuery(mappingContext: MappingContext) {
    mappingContext.adapter = this;

    const usePost = (mappingContext.query as EntityQuery).usePostEnabled;
    const params = usePost ? this._makeQueryPostParams(mappingContext) : this._makeQueryGetParams(mappingContext) as any;

    let promise = new Promise<QueryResult>((resolve, reject) => {
      params.success = function (httpResponse: HttpResponse) {
        let data = httpResponse.data;
        try {
          let rData: QueryResult;
          let results = data && (data.results || data.Results);
          if (results) {
            rData = { results: results, inlineCount: data.inlineCount || data.InlineCount, 
              httpResponse: httpResponse, query: mappingContext.query };
          } else {
            rData = { results: data, httpResponse: httpResponse, query: mappingContext.query };
          }

          resolve(rData);
        } catch (e) {
          if (e instanceof Error) {
            reject(e);
          } else {
            handleHttpError(reject, httpResponse);
          }
        }
      };
      params.error = function (httpResponse: HttpResponse) {
        handleHttpError(reject, httpResponse);
      };
      this.ajaxImpl.ajax(params);
    });
    return promise;
  }

  /** Set up ajax parameters for query GET.  This puts the query into the request querystring in either JSON or OData-style syntax, depending upon the UriBuilder. */
  _makeQueryGetParams(mappingContext: MappingContext) {
    const url = mappingContext.getUrl();

    const params = {
      type: "GET",
      url: url,
      params: (mappingContext.query as EntityQuery).parameters,
      dataType: 'json',
      crossDomain: false,
    };
    if (mappingContext.dataService.useJsonp) {
      params.dataType = 'jsonp';
      params.crossDomain = true;
    }
    return params;
  }

  /** Set up ajax parameters for query POST.  This put the query into the request body as JSON. */
  _makeQueryPostParams(mappingContext: MappingContext) {
    const entityQuery = mappingContext.query as EntityQuery;
    const metadataStore = mappingContext.entityManager.metadataStore;
    const url = mappingContext.dataService.qualifyUrl(entityQuery.resourceName);

    let entityType = entityQuery._getFromEntityType(metadataStore, false);
    if (!entityType) { entityType = new EntityType(metadataStore); }
    const json = entityQuery.toJSONExt({ entityType: entityType, toNameOnServer: true}) as any;
    json.from = undefined;
    json.queryOptions = undefined;

    const params = {
      type: "POST",
      url: url,
      params: (mappingContext.query as EntityQuery).parameters,
      dataType: 'json',
      processData: false, // don't let JQuery form-encode it
      contentType: "application/json; charset=UTF-8",
      data: JSON.stringify(json),
      crossDomain: false,
    };
    return params;
  }

  saveChanges(saveContext: SaveContext, saveBundle: SaveBundle) {
    let adapter = saveContext.adapter = this;

    let saveBundleSer = adapter._prepareSaveBundle(saveContext, saveBundle);
    let bundle = JSON.stringify(saveBundleSer);

    let url = saveContext.dataService.qualifyUrl(saveContext.resourceName);
    let promise = new Promise<SaveResult>((resolve, reject) => {
      this.ajaxImpl.ajax({
        type: "POST",
        url: url,
        dataType: 'json',
        contentType: "application/json",
        data: bundle,
        success: function (httpResponse: HttpResponse) {
          httpResponse.saveContext = saveContext;
          let data = httpResponse.data;
          if (data.Errors || data.errors) {
            handleHttpError(reject, httpResponse);
          } else {
            let saveResult = adapter._prepareSaveResult(saveContext, data);
            saveResult.httpResponse = httpResponse;
            resolve(saveResult);
          }
        },
        error: function (httpResponse: HttpResponse) {
          httpResponse.saveContext = saveContext;
          handleHttpError(reject, httpResponse);
        }
      });
    });

    return promise;
  }

  /** Abstract method that needs to be overwritten in any concrete DataServiceAdapter subclass. 
  The return value from this method should be a serializable object that will be sent to the server after calling JSON.stringify on it.
  */
  _prepareSaveBundle(saveContext: SaveContext, saveBundle: SaveBundle): any {
    // The implementor should call _createChangeRequestInterceptor
    throw new Error("Need a concrete implementation of _prepareSaveBundle");
  }

  /**
  Returns a constructor function for a "ChangeRequestInterceptor"
  that can tweak the saveBundle both as it is built and when it is completed
  by a concrete DataServiceAdapater.

  Initialized with a default, no-op implementation that developers can replace with a
  substantive implementation that changes the individual entity change requests
  or aspects of the entire 'saveBundle' without having to write their own DataService adapters.
  >     let adapter = breeze.config.getAdapterInstance('dataService');
  >     adapter.changeRequestInterceptor = function (saveContext, saveBundle) {
  >         this.getRequest = function (request, entity, index) {
  >            // alter the request that the adapter prepared for this entity
  >            // based on the entity, saveContext, and saveBundle
  >            // e.g., add a custom header or prune the originalValuesMap
  >            return request;
  >        };
  >        this.done = function (requests) {
  >            // alter the array of requests representing the entire change-set
  >            // based on the saveContext and saveBundle
  >        };
  >     }

  @param saveContext - The BreezeJS "context" for the save operation.
  @param saveBundle - Contains the array of entities-to-be-saved (AKA, the entity change-set).
  @return Constructor for a "ChangeRequestInterceptor".
  **/
  changeRequestInterceptor: ChangeRequestInterceptorCtor = DefaultChangeRequestInterceptor;

  /** @hidden @internal */
  _createChangeRequestInterceptor(saveContext: SaveContext, saveBundle: SaveBundle) {
    let adapter = saveContext.adapter!;
    let cri = adapter.changeRequestInterceptor;
    let isFn = core.isFunction;

    if (isFn(cri)) {
      let pre = adapter.name + " DataServiceAdapter's ChangeRequestInterceptor";
      let post = " is missing or not a function.";
      let interceptor = new cri(saveContext, saveBundle);
      if (!isFn(interceptor.getRequest)) {
        throw new Error(pre + '.getRequest' + post);
      }
      if (!isFn(interceptor.done)) {
        throw new Error(pre + '.done' + post);
      }
      return interceptor;
    } else {
      return new DefaultChangeRequestInterceptor(saveContext, saveBundle) as ChangeRequestInterceptor;
    }
  }

  /** Abstract method that needs to be overwritten in any concrete DataServiceAdapter sublclass. 
  This method needs to take the result returned the server and convert it into an ISaveResult. 
  */
  _prepareSaveResult(saveContext: SaveContext, data: any): SaveResult {
    throw new Error("Need a concrete implementation of _prepareSaveResult");
  }


  /** Utility method that may be used in any concrete DataServiceAdapter sublclass to handle any 
  http connection issues. 
  */
  // Put this at the bottom of your http error analysis
  static _catchNoConnectionError(err: ServerError) {
    if (err.status === 0 && err.message == null) {
      err.message = "HTTP response status 0 and no message.  " +
        "Likely did not or could not reach server. Is the server running?";
    }
  }

  jsonResultsAdapter = new JsonResultsAdapter({
    name: "noop",

    visitNode: function (/* node, mappingContext, nodeContext */) {
      return {};
    }
  });
}

function handleHttpError(reject: (reason?: any) => void, httpResponse: HttpResponse, messagePrefix?: string) {
  let err = createError(httpResponse);
  AbstractDataServiceAdapter._catchNoConnectionError(err);
  if (messagePrefix) {
    err.message = messagePrefix + "; " + err.message;
  }
  reject(err);
}

function createError(httpResponse: HttpResponse) {
  let err = new Error() as ServerError;
  err.httpResponse = httpResponse;
  err.status = httpResponse.status;

  let errObj = httpResponse.data;

  if (!errObj) {
    err.message = httpResponse.error && httpResponse.error.toString();
    return err;
  }

  // some ajax providers will convert errant result into an object (angularjs), others will not (jQuery)
  // if not do it here.
  if (typeof errObj === "string") {
    try {
      errObj = JSON.parse(errObj);
    } catch (e) {
      // sometimes httpResponse.data is just the error message itself
      err.message = errObj;
      return err;
    }
  }

  let saveContext = httpResponse.saveContext;

  // if any of the follow properties exist the source is .NET
  let tmp = errObj.Message || errObj.ExceptionMessage || errObj.EntityErrors || errObj.Errors;
  let isDotNet = !!tmp;
  let message: string, entityErrors: any[];
  if (!isDotNet) {
    message = errObj.message;
    entityErrors = errObj.errors || errObj.entityErrors;
  } else {
    let tmp = errObj;
    do {
      // .NET exceptions can provide both ExceptionMessage and Message but ExceptionMethod if it
      // exists has a more detailed message.
      message = tmp.ExceptionMessage || tmp.Message;
      tmp = tmp.InnerException;
    } while (tmp);
    // .EntityErrors will only occur as a result of an EntityErrorsException being deliberately thrown on the server
    entityErrors = errObj.Errors || errObj.EntityErrors;
    entityErrors = entityErrors && entityErrors.map(function (e) {
      return {
        errorName: e.ErrorName,
        entityTypeName: MetadataStore.normalizeTypeName(e.EntityTypeName),
        keyValues: e.KeyValues,
        propertyName: e.PropertyName,
        errorMessage: e.ErrorMessage,
        custom: e.Custom
      };
    });
  }

  if (saveContext && entityErrors) {

    let propNameFn = saveContext.entityManager.metadataStore.namingConvention.serverPropertyNameToClient;
    entityErrors.forEach(function (e) {
      e.propertyName = e.propertyName && propNameFn(e.propertyName);
    });
    (err as SaveErrorFromServer).entityErrors = entityErrors;
  }

  err.message = message || "Server side errors encountered - see the entityErrors collection on this object for more detail";
  return err;
}


/** This is a default, no-op implementation that developers can replace. */
class DefaultChangeRequestInterceptor {
  constructor(saveContext: SaveContext, saveBundle: SaveBundle) {

  }

  getRequest(request: any, entity: Entity, index: number) {
    return request;
  }

  done(requests: Object[]) {
  }
}
