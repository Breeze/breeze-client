import * as breeze from 'breeze-client';

let core = breeze.core;

/** Breeze AJAX adapter using fetch API 
 * See https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
export class AjaxFetchAdapter implements breeze.AjaxAdapter {
  static adapterName = "fetch";
  name: string;
  defaultSettings: { headers?: any };
  requestInterceptor?: (() => breeze.ChangeRequestInterceptor) | breeze.ChangeRequestInterceptor;

  constructor() {
    this.name = AjaxFetchAdapter.adapterName;
    this.defaultSettings = { };
    this.requestInterceptor = undefined;
  }

  static register(config?: breeze.BreezeConfig) {
    config = config || breeze.config;
    config.registerAdapter("ajax", AjaxFetchAdapter);
    return config.initializeAdapterInstance("ajax", AjaxFetchAdapter.adapterName, true) as AjaxFetchAdapter;
  }

  initialize() {
  }

  async ajax(config: breeze.AjaxConfig) {
    if (!fetch) {
      throw new Error("fetch API not supported in this browser");
    }

    let init: RequestInit = {
      method: config.type, // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'include', // include, *same-origin, omit
      headers: {
        'Content-Type': config.contentType || 'application/json',
        // ...config.headers
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'follow', // manual, *follow, error
      referrer: 'client', // no-referrer, *client
    };
    if (config.type !== "GET" && config.type !== "HEAD") {
      // body data type must match "Content-Type" header
      // let data = config.params || config.data;
      let data = config.data;
      if (typeof(data) !== "string") {
        data = JSON.stringify(data);
      }
      init.body = data;
    }

    let url = config.url;
    if (!core.isEmpty(config.params)) {
      // Hack: Not sure how Fetch handles writing 'search' parameters to the url.
      // so this approach takes over the url param writing completely.
      let delim = (url.indexOf('?') >= 0) ? '&' : '?';
      url = url + delim + encodeParams(config.params);
    }

    if (!core.isEmpty(this.defaultSettings)) {
      let compositeConfig = core.extend({}, this.defaultSettings);
      init = core.extend(compositeConfig, init) as any;
      // extend is shallow; extend headers separately
      let headers = core.extend({}, this.defaultSettings.headers); // copy default headers 1st
      init.headers = core.extend(headers, init.headers as Object) as any;
    }

    let requestInfo = {
      adapter: this,      // this adapter
      config: init,   // fetch api 'init' object
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
      try {
        const response = await fetch(url, requestInfo.config);
        if (!response.ok) {
          const s = await response.text();
          requestInfo.error(response.status, response.statusText, s, response, null);
        } else {
          const j = await response.json();
          requestInfo.success(j, response.statusText, response);
        }
      } catch (err) {
        requestInfo.error(0, err && err.message || err, '', undefined, err);
      }
    }

    function encodeParams(obj: any) {
      let query = '';
      let subValue: any, innerObj: any, fullSubName: any;
    
      for (let name in obj) {
        if (!obj.hasOwnProperty(name)) { continue; }
    
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
            if (obj.hasOwnProperty(name)) {
              subValue = value[subName];
              fullSubName = name + '[' + subName + ']';
              innerObj = {};
              innerObj[fullSubName] = subValue;
              query += encodeParams(innerObj) + '&';
            }
          }
        } else if (value === null) {
          query += encodeURIComponent(name) + '=&';
        } else if (value !== undefined) {
          query += encodeURIComponent(name) + '=' + encodeURIComponent(value) + '&';
        }
      }
    
      return query.length ? query.substr(0, query.length - 1) : query;
    }

    function successFn(data: any, statusText: string, response: Response) {
      let httpResponse = {
        config: config,
        data: data,
        getHeaders: getHeadersFn(response),
        status: response.status,
        statusText: statusText
      };
      config.success(httpResponse);
    }

    function errorFn(status: number, statusText: string, body: string, response: Response | undefined, errorThrown: any) {
      let httpResponse = {
        config: config,
        data: body,
        error: errorThrown || statusText,
        getHeaders: getHeadersFn(response),
        status: status,
        statusText: statusText
      };
      config.error(httpResponse);
    }
  }
}

breeze.config.registerAdapter("ajax", AjaxFetchAdapter);

function getHeadersFn(response?: Response): any {
  if (!response || response.status === 0) { // timeout or abort; no headers
    return function (headerName: string) {
      return (headerName && headerName.length > 0) ? "" : {};
    };
  } else {
    return function (headerName: string) {
      if (headerName && headerName.length > 0) {
        return response.headers.get(headerName);
      }
      let hob = {};
      response.headers.forEach((val, key) => {
        hob[key] = val;
      });
      return hob;
    };
  }
}
