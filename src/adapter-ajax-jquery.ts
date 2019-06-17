import * as breeze from 'breeze-client';

declare var jQuery: any;
let core = breeze.core;

export class AjaxJQueryAdapter implements breeze.AjaxAdapter {
  name: string;
  defaultSettings: { headers?: any };
  requestInterceptor?: (() => breeze.ChangeRequestInterceptor) | breeze.ChangeRequestInterceptor;
  jQuery: any;

  constructor() {
    this.name = "jQuery";
    this.defaultSettings = { };
    this.requestInterceptor = undefined;
  }

  static register() {
    breeze.config.registerAdapter("ajax", AjaxJQueryAdapter);
    breeze.config.initializeAdapterInstance("ajax", "jQuery", true);
  }

  initialize() {
    this.jQuery = jQuery;
    // look for the jQuery lib but don't fail immediately if not found
    if (!jQuery) {
      this.jQuery = core.requireLib("jQuery;jquery");
    }
  }

  ajax(config: any) {
    if (!this.jQuery) {
      throw new Error("Unable to locate jQuery");
    }
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
      (requestInfo as any).jqXHR = this.jQuery.ajax(requestInfo.config)
        .done(requestInfo.success)
        .fail(requestInfo.error);
    }

    function successFn(data: any, statusText: string, jqXHR: XMLHttpRequest) {
      let httpResponse = {
        config: config,
        data: data,
        getHeaders: getHeadersFn(jqXHR),
        status: jqXHR.status,
        statusText: statusText
      };
      config.success(httpResponse);
      // TODO: not sure how to do this or if needed.
      // jqXHR.onreadystatechange = null;
      // jqXHR.abort = null;
    }

    function errorFn(jqXHR: XMLHttpRequest, statusText: string, errorThrown: any) {
      let httpResponse = {
        config: config,
        data: jqXHR.responseText,
        error: errorThrown,
        getHeaders: getHeadersFn(jqXHR),
        status: jqXHR.status,
        statusText: statusText
      };
      config.error(httpResponse);
      // TODO: not sure how to do this or if needed.
      // jqXHR.onreadystatechange = null;
      // jqXHR.abort = null;
    }
  };
}

breeze.config.registerAdapter("ajax", AjaxJQueryAdapter);

function getHeadersFn(jqXHR: XMLHttpRequest): any {
  if (jqXHR.status === 0) { // timeout or abort; no headers
    return function (headerName: string) {
      return (headerName && headerName.length > 0) ? "" : {};
    };
  } else { // jqXHR should have header functions
    return function (headerName: string) {
      return (headerName && headerName.length > 0) ?
        jqXHR.getResponseHeader(headerName) :
        jqXHR.getAllResponseHeaders();
    };
  }
}
