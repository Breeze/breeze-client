import * as breeze from 'breeze-client';

let core = breeze.core;

/** Simulates sending ajax to server and getting empty response.  For testing. */
export class AjaxFakeAdapter implements breeze.AjaxAdapter {
  name: string;
  defaultSettings: { headers?: any };
  requestInterceptor?: (() => breeze.ChangeRequestInterceptor) | breeze.ChangeRequestInterceptor;

  constructor() {
    this.name = "ajaxfake";
    this.defaultSettings = { };
    this.requestInterceptor = undefined;
  }

  static register() {
    breeze.config.registerAdapter("ajax", AjaxFakeAdapter);
    breeze.config.initializeAdapterInstance("ajax", "ajaxfake", true);
  }

  initialize() {
  }

  ajax(config: any) {
    let jqConfig = {
      type: config.type,
      url: config.url,
      data: config.params || config.data,
      dataType: config.dataType,
      contentType: config.contentType,
      crossDomain: config.crossDomain,
      headers: config.headers || {}
    };

    if (!core.isEmpty(this.defaultSettings)) {
      let compositeConfig = core.extend({}, this.defaultSettings);
      jqConfig = core.extend(compositeConfig, jqConfig) as any;
      // extend is shallow; extend headers separately
      let headers = core.extend({}, this.defaultSettings.headers); // copy default headers 1st
      jqConfig.headers = core.extend(headers, jqConfig.headers);
    }

    let requestInfo = {
      adapter: this,      // this adapter
      config: jqConfig,   // jQuery's ajax 'settings' object
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
      let data = JSON.parse(requestInfo.config.data);
      if (data.entities) {
        data.entities.forEach(function(e: any) { delete(e.entityAspect); });
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
