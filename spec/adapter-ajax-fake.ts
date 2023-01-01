import * as breeze from 'breeze-client';

let core = breeze.core;

/** Simulates sending ajax to server and getting empty response.  For testing. */
export class AjaxFakeAdapter implements breeze.AjaxAdapter {
  name: string;
  defaultSettings: {};
  // requestInterceptor?: (() => breeze.ChangeRequestInterceptor) | breeze.ChangeRequestInterceptor;
  requestInterceptor?: (req: any) => void;
  /** Provides return values for requests.  Used for testing. */
  responseFn: (ajaxConfig: breeze.AjaxConfig) => any;

  constructor() {
    this.name = "ajaxfake2";
    this.requestInterceptor = undefined;
  }

  static register(config?: breeze.BreezeConfig) {
    config = config || breeze.config;
    config.registerAdapter("ajax", AjaxFakeAdapter);
    return config.initializeAdapterInstance("ajax", "ajaxfake2", true) as AjaxFakeAdapter;
  }

  initialize() {
  }

  ajax(config: breeze.AjaxConfig) {
    let responseFn = this.responseFn;

    let requestInfo = {
      adapter: this,      // this adapter
      config: config,     // the config arg from the calling Breeze DataServiceAdapter
      dsaConfig: config,  // the config arg from the calling Breeze DataServiceAdapter
      success: successFn, // adapter's success callback
      error: errorFn,      // adapter's error callback
    };

    if (core.isFunction(this.requestInterceptor)) {
      let ri = this.requestInterceptor as any;
      ri(requestInfo);
      if (ri.oneTime) {
        this.requestInterceptor = undefined;
      }
    }

    if (requestInfo.config) { // exists unless requestInterceptor killed it.
      setTimeout(done, 500);
    }

    function done() {
      // create simulated SaveResult
      // TODO keymappings
      let config = requestInfo.config;
      let data: any;
      if (responseFn) {
        data = responseFn(config);
      }
      if (!data) {
        if (config.type === "POST") {
          data = JSON.parse(requestInfo.config.data);
          if (data.entities) {
            data.entities.forEach((e: any) => { 
              e.$type = e.entityAspect.entityTypeName;
              delete(e.entityAspect); 
            });
          }
        } else {
          data = [];
        }
      }
      successFn(data, "OK", null);
    }

    function successFn(data: any, statusText: string, xhr: XMLHttpRequest) {
      let httpResponse = {
        config: config,
        data: data,
        getHeaders: getHeadersFn(xhr),
        status: 200,
        statusText: statusText
      };
      // call passed-in success function
      config.success(httpResponse);
    }

    function errorFn(xhr: XMLHttpRequest) {
      let httpResponse = {
        config: config,
        data: xhr.responseText,
        // error: errorThrown,
        getHeaders: getHeadersFn(xhr),
        status: xhr.status,
        statusText: xhr.statusText
      };
      config.error(httpResponse);
    }
  }
}

breeze.config.registerAdapter("ajax", AjaxFakeAdapter);

function getHeadersFn(xhr: XMLHttpRequest): any {
  return function (headerName: string) {
    return (headerName && headerName.length > 0) ? "" : {};
  };
}
