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

  static register() {
    breeze.config.registerAdapter("ajax", AjaxFetchAdapter);
    return breeze.config.initializeAdapterInstance("ajax", AjaxFetchAdapter.adapterName, true) as AjaxFetchAdapter;
  }

  initialize() {
  }

  ajax(config: breeze.AjaxConfig) {
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
      let data = config.params || config.data;
      if (typeof(data) !== "string") {
        data = JSON.stringify(data);
      }
      init.body = data;
    }

    if (!core.isEmpty(this.defaultSettings)) {
      let compositeConfig = core.extend({}, this.defaultSettings);
      init = core.extend(compositeConfig, init) as any;
      // extend is shallow; extend headers separately
      let headers = core.extend({}, this.defaultSettings.headers); // copy default headers 1st
      init.headers = core.extend(headers, init.headers) as any;
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
      fetch(config.url, requestInfo.config).then(response => {
        if (!response.ok) {
          response.text().then(s => {
            requestInfo.error(response.status, response.statusText, s, response, null);
          });
        } else {
          response.json().then(j => {
            requestInfo.success(j, response.statusText, response);
          });
        }
      }).catch(err => {
        requestInfo.error(0, err && err.message || err, null, null, err);
      });
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

    function errorFn(status: number, statusText: string, body: string, response: Response, errorThrown: any) {
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

function getHeadersFn(response: Response): any {
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
