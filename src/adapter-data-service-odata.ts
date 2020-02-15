import * as breeze from 'breeze-client';

let core = breeze.core;

declare var window: any;
declare var document: any;
declare var url: any; // needed to access node's url.parse
declare var OData: any;

interface ODataSaveContext extends breeze.SaveContext {
  tempKeys: breeze.EntityKey[];
  contentKeys: breeze.Entity[];
}

/** @hidden */
export class DataServiceODataAdapter extends breeze.AbstractDataServiceAdapter {
  name: string;
  relativeUrl: boolean | ((ds: breeze.DataService, url: string) => string);
  // _catchNoConnectionError = abstractDsaProto._catchNoConnectionError;
  // changeRequestInterceptor = abstractDsaProto.changeRequestInterceptor;
  // _createChangeRequestInterceptor = abstractDsaProto._createChangeRequestInterceptor;
  headers = { "DataServiceVersion": "2.0" };

  constructor() {
    super();
    this.name = "OData";
  }

  static register(config?: breeze.BreezeConfig) {
    config = config || breeze.config;
    config.registerAdapter("dataService", DataServiceODataAdapter);
    return config.initializeAdapterInstance("dataService", "OData", true) as DataServiceODataAdapter;
  }

  initialize() {
    OData = core.requireLib("OData", "Needed to support remote OData services");
    OData.jsonHandler.recognizeDates = true;
  }


  // Absolute URL is the default as of Breeze 1.5.5.  
  // To use relative URL (like pre-1.5.5), add adapterInstance.relativeUrl = true:
  //
  //     let ds = breeze.config.initializeAdapterInstance("dataService", "webApiOData");
  //     ds.relativeUrl = true; 
  //
  // To use custom url construction, add adapterInstance.relativeUrl = myfunction(dataService, url):
  //
  //     let ds = breeze.config.initializeAdapterInstance("dataService", "webApiOData");
  //     ds.relativeUrl = function(dataService, url) {
  //        return somehowConvert(url);
  //     }
  //

  fetchMetadata(metadataStore: breeze.MetadataStore, dataService: breeze.DataService) {
    let serviceName = dataService.serviceName;

    let url: string;
    if (this.relativeUrl === true) {
      url = dataService.qualifyUrl('$metadata');
    } else if (core.isFunction(this.relativeUrl)) {
      url = (this.relativeUrl as any)(dataService, '$metadata');
    } else {
      url = this.getAbsoluteUrl(dataService, '$metadata');
    }

    let mheaders = core.extend({}, this.headers);
    (mheaders as any).Accept = 'application/*; odata.metadata=full';

    let promise = new Promise((resolve, reject) => {
      // OData.read(url,
      OData.read({
        requestUri: url,
        // headers: { "Accept": "application/json"}
        headers: mheaders
      },
        function (data: any) {
          // data.dataServices.schema is an array of schemas. with properties of
          // entityContainer[], association[], entityType[], and namespace.
          if (!data || !data.dataServices) {
            let error = new Error("Metadata query failed for: " + url);
            return reject(error);
          }
          let csdlMetadata = data.dataServices;

          // might have been fetched by another query
          if (!metadataStore.hasMetadataFor(serviceName)) {
            try {
              metadataStore.importMetadata(csdlMetadata);
            } catch (e) {
              return reject(new Error("Metadata query failed for " + url + "; Unable to process returned metadata: " + e.message));
            }

            metadataStore.addDataService(dataService);
          }

          return resolve(csdlMetadata);

        }, function (error: any) {
          let err = createError(error, url);
          err.message = "Metadata query failed for: " + url + "; " + (err.message || "");
          return reject(err);
        },
        OData.metadataHandler
      );
    });

    return promise;
  }



  executeQuery(mappingContext: breeze.MappingContext) {
    let url: string;
    if (this.relativeUrl === true) {
      url = mappingContext.getUrl();
    } else if (core.isFunction(this.relativeUrl)) {
      url = (this.relativeUrl as any)(mappingContext.dataService, mappingContext.getUrl());
    } else {
      url = this.getAbsoluteUrl(mappingContext.dataService, mappingContext.getUrl());
    }

    // Add query params if .withParameters was used
    let query = mappingContext.query as breeze.EntityQuery;
    if (!core.isEmpty(query.parameters)) {
      let paramString = toQueryString(query.parameters);
      let sep = url.indexOf("?") < 0 ? "?" : "&";
      url = url + sep + paramString;
    }

    let promise = new Promise<breeze.QueryResult>((resolve, reject) => {
      OData.read({
        requestUri: url,
        headers: core.extend({}, this.headers)
      },
        function (data: any, response: any) {
          let inlineCount: any;
          if (data.__count) {
            // OData can return data.__count as a string
            inlineCount = parseInt(data.__count, 10);
          }
          // Odata returns different result structure when it returns multiple entities (data.results) vs single entity (data directly).
          // @see http://www.odata.org/documentation/odata-version-2-0/json-format/#RepresentingCollectionsOfEntries
          // and http://www.odata.org/documentation/odata-version-2-0/json-format/#RepresentingEntries
          let results: any;
          if (data.results) {
            results = data.results;
          } else {
            results = data;
          }
          return resolve({ results: results, inlineCount: inlineCount, httpResponse: response, query: query });
        },
        function (error: any) {
          return reject(createError(error, url));
        }
      );
    });
    return promise;
  }


  saveChanges(odataSaveContext: breeze.SaveContext, saveBundle: breeze.SaveBundle): Promise<breeze.SaveResult> {
    let adapter = odataSaveContext.adapter = this;
    let saveContext = odataSaveContext as ODataSaveContext;
    let url: string;
    if (this.relativeUrl === true) {
      saveContext.routePrefix = adapter.getRoutePrefix(saveContext.dataService);
      url = saveContext.dataService.qualifyUrl("$batch");
    } else if (core.isFunction(adapter.relativeUrl)) {
      saveContext.routePrefix = (adapter.relativeUrl as Function)(saveContext.dataService, '');
      url = saveContext.routePrefix + '$batch';
    } else {
      saveContext.routePrefix = adapter.getAbsoluteUrl(saveContext.dataService, '');
      url = saveContext.routePrefix + '$batch';
    }

    let requestData = createChangeRequests(saveContext, saveBundle);
    let tempKeys = saveContext.tempKeys;
    let contentKeys = saveContext.contentKeys;
    let promise = new Promise<breeze.SaveResult>((resolve, reject) => {
      OData.request({
        headers: core.extend({}, this.headers),
        requestUri: url,
        method: "POST",
        data: requestData
      }, function (data: any, response: any) {
        let entities: any[] = [];
        let keyMappings: breeze.KeyMapping[] = [];
        let saveResult: breeze.SaveResult = { entities: entities, keyMappings: keyMappings };
        data.__batchResponses.forEach(function (br: any) {
          br.__changeResponses.forEach(function (cr: any) {
            let response = cr.response || cr;
            let statusCode = response.statusCode;
            if ((!statusCode) || statusCode >= 400) {
              reject(createError(cr, url));
              return;
            }

            let contentId = cr.headers["Content-ID"];
            // Olingo sends different case of 'ID' for the header name.
            if (!contentId) {
              contentId = cr.headers["Content-Id"];
            }

            let rawEntity = cr.data;
            if (rawEntity) {
              let tempKey = tempKeys[contentId];
              if (tempKey) {
                let entityType = tempKey.entityType;
                if (entityType.autoGeneratedKeyType !== breeze.AutoGeneratedKeyType.None) {
                  let tempValue = tempKey.values[0];
                  let realKey = entityType.getEntityKeyFromRawEntity(rawEntity, breeze.DataProperty.getRawValueFromServer);
                  let keyMapping = { entityTypeName: entityType.name, tempValue: tempValue, realValue: realKey.values[0] };
                  keyMappings.push(keyMapping);
                }
              }
              entities.push(rawEntity);
            } else {
              let origEntity = contentKeys[contentId];
              entities.push(origEntity);
            }
          });
        });
        return resolve(saveResult);
      }, function (err: any) {
        return reject(createError(err, url));
      }, OData.batchHandler);
    });
    return promise;

  }

  jsonResultsAdapter: breeze.JsonResultsAdapter = new breeze.JsonResultsAdapter({
    name: "OData_default",

    visitNode: function (node: any, mappingContext: breeze.MappingContext, nodeContext: breeze.NodeContext) {
      let result: any = {};
      if (node == null) return result;
      let metadata = node.__metadata;
      if (metadata != null) {
        // TODO: may be able to make this more efficient by caching of the previous value.
        let entityTypeName = breeze.MetadataStore.normalizeTypeName(metadata.type);
        let et = entityTypeName && mappingContext!.entityManager.metadataStore.getEntityType(entityTypeName, true);
        // OData response doesn't distinguish a projection from a whole entity.
        // We'll assume that whole-entity data would have at least as many properties  (<=)
        // as the EntityType has mapped properties on the basis that
        // most projections remove properties rather than add them.
        // If not, assume it's a projection and do NOT treat as an entity
        if (et && et._mappedPropertiesCount <= Object.keys(node).length - 1) {
          // if (et && et._mappedPropertiesCount === Object.keys(node).length - 1) { // OLD
          result.entityType = et;
          let uriKey = metadata.uri || metadata.id;
          if (uriKey) {
            // Strip baseUri to make uriKey a relative uri
            // Todo: why is this necessary when absolute works for every OData source tested?
            let re = new RegExp('^' + mappingContext!.dataService.serviceName, 'i');
            uriKey = uriKey.replace(re, '');
          }
          result.extraMetadata = {
            uriKey: uriKey,
            etag: metadata.etag
          };
        }
      }
      // OData v3 - projection arrays will be enclosed in a results array
      if (node.results) {
        result.node = node.results;
      }

      let propertyName = nodeContext!.propertyName;
      result.ignore = node.__deferred != null || propertyName === "__metadata" ||
        // EntityKey properties can be produced by EDMX models
        (propertyName === "EntityKey" && node.$type && core.stringStartsWith(node.$type, "System.Data"));
      return result;
    }

  });

  getAbsoluteUrl(dataService: breeze.DataService, url: string) {
    let serviceName = dataService.qualifyUrl('');
    // only prefix with serviceName if not already on the url
    let base = (core.stringStartsWith(url, serviceName)) ? '' : serviceName;
    // If no protocol, turn base into an absolute URI
    if (window && serviceName.indexOf('//') < 0) {
      // no protocol; make it absolute
      base = window.location.protocol + '//' + window.location.host +
        (core.stringStartsWith(serviceName, '/') ? '' : '/') +
        base;
    }
    return base + url;
  }

  getRoutePrefix(dataService: breeze.DataService) {
    // Get the routePrefix from a Web API OData service name.
    // The routePrefix is presumed to be the pathname within the dataService.serviceName
    // Examples of servicename -> routePrefix:
    //   'http://localhost:55802/odata/' -> 'odata/'
    //   'http://198.154.121.75/service/odata/' -> 'service/odata/'
    let parser: any;
    if (typeof document === 'object') { // browser
      parser = document.createElement('a');
      parser.href = dataService.serviceName;
    } else { // node
      // TODO: how to best handle this
      // assumes existence of node's url.parse method.
      parser = url.parse(dataService.serviceName);
    }
    let prefix = parser.pathname;
    if (prefix[0] === '/') {
      prefix = prefix.substr(1);
    } // drop leading '/'  (all but IE)
    if (prefix.substr(-1) !== '/') {
      prefix += '/';
    }      // ensure trailing '/'
    return prefix;
  }

}

// crude serializer.  Doesn't recurse
function toQueryString(obj: Object) {
  let parts: string[] = [];
  for (let i in obj) {
    if (obj.hasOwnProperty(i)) {
      parts.push(encodeURIComponent(i) + "=" + encodeURIComponent(obj[i]));
    }
  }
  return parts.join("&");
}

function transformValue(prop: breeze.DataProperty, val: any) {
  if (prop.isUnmapped) return undefined;
  if (prop.dataType === breeze.DataType.DateTimeOffset) {
    // The datajs lib tries to treat client dateTimes that are defined as DateTimeOffset on the server differently
    // from other dateTimes. This fix compensates before the save.
    val = val && new Date(val.getTime() - (val.getTimezoneOffset() * 60000));
  } else if ((prop.dataType as breeze.DataType).quoteJsonOData) {
    val = val != null ? val.toString() : val;
  }
  return val;
}

function createChangeRequests(saveContext: ODataSaveContext, saveBundle: breeze.SaveBundle) {
  let changeRequestInterceptor = (saveContext.adapter as DataServiceODataAdapter)._createChangeRequestInterceptor(saveContext, saveBundle);
  let changeRequests: any[] = [];
  let tempKeys: breeze.EntityKey[] = [];
  let contentKeys: breeze.Entity[] = [];
  let entityManager = saveContext.entityManager;
  let helper = entityManager.helper;
  let id = 0;
  let routePrefix = saveContext.routePrefix;

  saveBundle.entities.forEach(function (entity, index) {
    let aspect = entity.entityAspect;
    id = id + 1; // we are deliberately skipping id=0 because Content-ID = 0 seems to be ignored.
    let request = { headers: { "Content-ID": id, "DataServiceVersion": "2.0" } } as any;
    contentKeys[id] = entity;
    if (aspect.entityState.isAdded()) {
      request.requestUri = routePrefix + entity.entityType.defaultResourceName;
      request.method = "POST";
      request.data = helper.unwrapInstance(entity, transformValue);
      tempKeys[id] = aspect.getKey();
    } else if (aspect.entityState.isModified()) {
      updateDeleteMergeRequest(request, aspect, routePrefix!);
      request.method = "MERGE";
      request.data = helper.unwrapChangedValues(entity, entityManager.metadataStore, transformValue);
      // should be a PATCH/MERGE
    } else if (aspect.entityState.isDeleted()) {
      updateDeleteMergeRequest(request, aspect, routePrefix!);
      request.method = "DELETE";
    } else {
      return;
    }
    request = changeRequestInterceptor.getRequest(request, entity, index);
    changeRequests.push(request);
  });
  saveContext.contentKeys = contentKeys;
  saveContext.tempKeys = tempKeys;
  changeRequestInterceptor.done(changeRequests);
  return {
    __batchRequests: [
      {
        __changeRequests: changeRequests
      }
    ]
  };

}

function updateDeleteMergeRequest(request: any, aspect: breeze.EntityAspect, routePrefix: string) {
  let uriKey: string;
  let extraMetadata = aspect.extraMetadata;
  if (extraMetadata == null) {
    uriKey = getUriKey(aspect);
    aspect.extraMetadata = {
      uriKey: uriKey
    };
  } else {
    uriKey = extraMetadata.uriKey;
    if (extraMetadata.etag) {
      request.headers["If-Match"] = extraMetadata.etag;
    }
  }
  request.requestUri =
    // use routePrefix if uriKey lacks protocol (i.e., relative uri)
    uriKey.indexOf('//') > 0 ? uriKey : routePrefix + uriKey;
}

function getUriKey(aspect: breeze.EntityAspect) {
  let entityType = aspect.entity!.entityType;
  let resourceName = entityType.defaultResourceName;
  let kps = entityType.keyProperties;
  let uriKey = resourceName + "(";
  if (kps.length === 1) {
    uriKey = uriKey + fmtProperty(kps[0], aspect) + ")";
  } else {
    let delim = "";
    kps.forEach(function (kp) {
      uriKey = uriKey + delim + kp.nameOnServer + "=" + fmtProperty(kp, aspect);
      delim = ",";
    });
    uriKey = uriKey + ")";
  }
  return uriKey;
}

function fmtProperty(prop: breeze.DataProperty, aspect: breeze.EntityAspect) {
  return (prop.dataType as breeze.DataType).fmtOData!(aspect.getPropertyValue(prop.name));
}

function createError(error: any, url: string) {
  // OData errors can have the message buried very deeply - and nonobviously
  // this code is tricky so be careful changing the response.body parsing.
  let result = new Error() as breeze.ServerError;
  let response = error && error.response;
  if (!response) {
    // in case DataJS returns "No handler for this data"
    result.message = error;
    result.statusText = error;
    return result;
  }
  result.message = response.statusText;
  result.statusText = response.statusText;
  result.status = response.statusCode;
  // non std
  if (url) result.url = url;
  result.body = response.body;
  if (response.body) {
    let nextErr: any;
    try {
      let body = JSON.parse(response.body);
      result.body = body;
      // OData v3 logic
      if (body['odata.error']) {
        body = body['odata.error'];
      }
      let msg = "";
      do {
        nextErr = body.error || body.innererror;
        if (!nextErr) msg = msg + getMessage(body);
        nextErr = nextErr || body.internalexception;
        body = nextErr || body;
      } while (nextErr);
      if (msg.length > 0) {
        result.message = msg;
      }
    } catch (e) {

    }
  }
  breeze.AbstractDataServiceAdapter._catchNoConnectionError(result);
  return result;
}

function getMessage(body: any) {
  let msg = body.message || "";
  return ((typeof (msg) === "string") ? msg : msg.value) + "; ";
}

breeze.config.registerAdapter("dataService", DataServiceODataAdapter);


let webApiODataCtor = function () {
  this.name = "webApiOData";
};

breeze.core.extend(webApiODataCtor.prototype, DataServiceODataAdapter.prototype);

breeze.config.registerAdapter("dataService", webApiODataCtor as any);
// OData 4 adapter
let webApiOData4Ctor = function () {
  this.name = "webApiOData4";
};
breeze.core.extend(webApiOData4Ctor.prototype, webApiODataCtor.prototype);
webApiOData4Ctor.prototype.initialize = function () {
  // Aargh... they moved the cheese.
  let datajs = core.requireLib("datajs", "Needed to support remote OData v4 services");
  OData = datajs.V4.oData;
  OData.json.jsonHandler.recognizeDates = true;
};
webApiOData4Ctor.prototype.headers = { "OData-Version": "4.0" };
breeze.config.registerAdapter("dataService", webApiOData4Ctor as any);




