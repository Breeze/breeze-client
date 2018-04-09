import * as breeze from './breeze';

let core = breeze.core;

export class AjaxAngularjsAdapter implements breeze.AjaxAdapter {
  name: string;
  defaultSettings: { headers?: any };
  requestInterceptor?: (() => breeze.ChangeRequestInterceptor) | breeze.ChangeRequestInterceptor;
  $http: any;
  $rootScope: any;
  constructor() {
    this.name = "angular";
    this.defaultSettings = {};
    this.requestInterceptor = undefined;
    // Will set:
    //   this.$http;
    //   this.$rootScope;
  };


  initialize() {

    let ng = breeze.core.requireLib("angular");
    if (ng) {
      let $injector = ng.injector(['ng']);
      let http: any, rootScope: any;
      $injector.invoke(['$http', '$rootScope', function ($http: any, $rootScope: any) {
        http = $http;
        rootScope = $rootScope;
      }]);
      this.$http = http;
      this.$rootScope = rootScope;
    }

  }

  setHttp(http: any) {
    this.$http = http;
    this.$rootScope = null; // to suppress $rootScope.digest
  }


  ajax(config: any) {
    if (!this.$http) {
      throw new Error("Unable to locate angularjs for ajax adapter");
    }
    let ngConfig = {
      method: config.type,
      url: config.url,
      dataType: config.dataType,
      contentType: config.contentType,
      crossDomain: config.crossDomain,
      headers: config.headers || {},
      data: undefined as any
    };

    if (config.params) {
      // Hack: because of the way that Angular handles writing parameters out to the url.
      // so this approach takes over the url param writing completely.
      // See: http://victorblog.com/2012/12/20/make-angularjs-http-service-behave-like-jquery-ajax/
      let delim = (ngConfig.url.indexOf("?") >= 0) ? "&" : "?";
      ngConfig.url = ngConfig.url + delim + encodeParams(config.params);
    }

    if (config.data) {
      ngConfig.data = config.data;
    }

    if (!core.isEmpty(this.defaultSettings)) {
      let compositeConfig = core.extend({}, this.defaultSettings);
      ngConfig = core.extend(compositeConfig, ngConfig) as any;
      // extend is shallow; extend headers separately
      let headers = core.extend({}, this.defaultSettings.headers); // copy default headers 1st
      ngConfig.headers = core.extend(headers, ngConfig.headers);
    }

    let requestInfo = {
      adapter: this,      // this adapter
      config: ngConfig,   // angular's $http configuration object
      dsaConfig: config,  // the config arg from the calling Breeze DataServiceAdapter
      success: successFn, // adapter's success callback
      error: errorFn,      // adapter's error callback
      responseSuccess: responseSuccessFn, // adapter's success callback (ng 1.6+)
      responseError: responseErrorFn      // adapter's error callback (ng 1.6+)
    };

    if (core.isFunction(this.requestInterceptor)) {
      let ri = this.requestInterceptor as any;
      ri(requestInfo);
      if (ri.oneTime) {
        this.requestInterceptor = undefined;
      }
    }

    if (requestInfo.config) { // exists unless requestInterceptor killed it.
      let prom = this.$http(requestInfo.config);
      if (prom.success) {
        // response for ng < 1.6        
        prom.success(requestInfo.success).error(requestInfo.error);
      } else {
        // response for ng 1.6+
        prom.then(requestInfo.responseSuccess).catch(requestInfo.responseError);
      }
      this.$rootScope && this.$rootScope.$digest();
    }

    function responseSuccessFn(response: any) {
      return successFn(response.data, response.status, response.headers, response.config, response.statusText);
    }

    function successFn(data: any, status: any, headers: any, xconfig: any, statusText: string) {
      // HACK: because $http returns a server side null as a string containing "null" - this is WRONG.
      if (data === "null") data = null;
      let httpResponse = {
        config: config,
        data: data,
        getHeaders: headers,
        ngConfig: xconfig,
        status: status,
        statusText: statusText
      };
      config.success(httpResponse);
    }

    function responseErrorFn(response: any) {
      return errorFn(response.data, response.status, response.headers, response.config, response.statusText);
    }

    function errorFn(data: any, status: any, headers: any, xconfig: any, statusText: string) {
      // Timeout appears as an error with status===0 and no data.
      // Make it better
      if (status === 0 && data == null) {
        data = 'timeout';
      }
      let httpResponse = {
        config: config,
        data: data,
        getHeaders: headers,
        ngConfig: xconfig,
        status: status,
        statusText: statusText
      };
      config.error(httpResponse);
    }
  }
}

breeze.config.registerAdapter("ajax", AjaxAngularjsAdapter);

function encodeParams(obj: Object) {
  let query = '';
  let subValue: any, innerObj: Object, fullSubName: string;

  for (let name in obj) {
    let value = obj[name];

    if (value instanceof Array) {
      for (let i = 0; i < value.length; ++i) {
        subValue = value[i];
        fullSubName = name + '[' + i + ']';
        innerObj = {};
        innerObj[fullSubName] = subValue;
        query += encodeParams(innerObj) + '&';
      }
    } else if (value && value.toISOString) { // a feature of Date-like things
      query += encodeURIComponent(name) + '=' + encodeURIComponent(value.toISOString()) + '&';
    } else if (value instanceof Object) {
      for (let subName in value) {
        subValue = value[subName];
        fullSubName = name + '[' + subName + ']';
        innerObj = {};
        innerObj[fullSubName] = subValue;
        query += encodeParams(innerObj) + '&';
      }
    } else if (value === null) {
      query += encodeURIComponent(name) + '=&';
    } else if (value !== undefined) {
      query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
    }
  }

  return query.length ? query.substr(0, query.length - 1) : query;
}