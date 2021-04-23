﻿import { AjaxAdapter, AjaxConfig, AjaxRequestInterceptor, BreezeConfig, config, core } from 'breeze-client';
import { appendQueryStringParameter, encodeParams } from './adapter-core';

/** Breeze AJAX adapter using fetch API 
 * See https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
export class AjaxFetchAdapter implements AjaxAdapter {
  static adapterName = "fetch";
  name: string;
  defaultSettings: { headers?: { [name: string]: string } };
  requestInterceptor?: AjaxRequestInterceptor;

  constructor() {
    this.name = AjaxFetchAdapter.adapterName;
    this.defaultSettings = { };
    this.requestInterceptor = undefined;
  }

  static register(breezeConfig?: BreezeConfig) {
    breezeConfig = breezeConfig || config;
    breezeConfig.registerAdapter("ajax", AjaxFetchAdapter);
    return breezeConfig.initializeAdapterInstance("ajax", AjaxFetchAdapter.adapterName, true) as AjaxFetchAdapter;
  }

  initialize() {
  }

  ajax(config: AjaxConfig) {
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
      url = appendQueryStringParameter(url, encodeParams(config.params));
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
      fetch(url, requestInfo.config).then(response => {
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

config.registerAdapter("ajax", AjaxFetchAdapter);

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
