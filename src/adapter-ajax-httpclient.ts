import { HttpClient, HttpErrorResponse, HttpEvent, HttpHeaders, HttpRequest, HttpResponse } from "@angular/common/http";
import { AjaxConfig, config, core, HttpResponse as BreezeHttpResponse } from "breeze-client";
import { filter, map } from "rxjs/operators";

export class AjaxHttpClientAdapter {
  static adapterName = 'httpclient';
  name = AjaxHttpClientAdapter.adapterName;
  defaultSettings = {};
  requestInterceptor: (info: {}) => {};

  constructor(public http: HttpClient) { }

  static register(http: HttpClient) {
    config.registerAdapter("ajax", <any>function () { return new AjaxHttpClientAdapter(http); });
    return config.initializeAdapterInstance("ajax", AjaxHttpClientAdapter.adapterName, true) as AjaxHttpClientAdapter;
  }

  initialize() { }

  ajax(config: AjaxConfig) {
    if (!this.http) {
      throw new Error('Unable to locate angular http module for ajax adapter');
    }

    // merge default DataSetAdapter Settings with config arg
    if (!core.isEmpty(this.defaultSettings)) {
      let compositeConfig = core.extend({}, this.defaultSettings);
      config = <AjaxConfig>core.extend(compositeConfig, config);
      // extend is shallow; extend headers separately
      let headers = core.extend({}, this.defaultSettings['headers']); // copy default headers 1st
      config['headers'] = core.extend(headers, config.headers);
    }

    if (config.crossDomain) {
      throw new Error(this.name + ' does not support JSONP (crossDomain) requests');
    }

    let url = config.url;
    if (!core.isEmpty(config.params)) {
      // Hack: Not sure how Angular handles writing 'search' parameters to the url.
      // so this approach takes over the url param writing completely.
      let delim = (url.indexOf('?') >= 0) ? '&' : '?';
      url = url + delim + encodeParams(config.params);
    }

    let headers = new HttpHeaders(config.headers || {});
    if (!headers.has('Content-Type')) {
      if (config.type !== 'GET' && config.type !== 'DELETE' && config.contentType !== false) {
        headers = headers.set('Content-Type',
          <string>config.contentType || 'application/json; charset=utf-8');
      }
    }

    let body: any = config.data;
    let request = new HttpRequest((config.type || 'GET').toUpperCase(), url, body, { headers: headers, responseType: "text" });

    let requestInfo = {
      adapter: this,      // this adapter
      request: request,   // the http request from the requestOptions
      dsaConfig: config,  // the config arg from the calling Breeze DataServiceAdapter
      success: successFn, // adapter's success callback
      error: errorFn      // adapter's error callback
    };

    if (core.isFunction(this.requestInterceptor)) {
      this.requestInterceptor(requestInfo);
      if (this.requestInterceptor['oneTime']) {
        this.requestInterceptor = null;
      }
    }

    if (requestInfo.request) { // exists unless requestInterceptor killed it.
      const ffilter = filter((response: HttpEvent<any>) => response instanceof HttpResponse);
      const fmap = map(extractData);

      fmap(ffilter(this.http.request(requestInfo.request)))
        .forEach(requestInfo.success)
        .catch(requestInfo.error);
    }

    function extractData(event: HttpEvent<any>) {
      let response = event as HttpResponse<any>;
      let data: any;
      let dt = requestInfo.dsaConfig.dataType;
      // beware:`res.json` and `res.text` will be async some day
      if (dt && dt !== 'json') {
        data = response.body;
      } else {
        data = JSON.parse(response.body);
      }
      return { data, response };
    }

    function successFn(arg: { data: any, response: HttpResponse<any> }) {
      if (arg.response.status < 200 || arg.response.status >= 300) {
        throw { data: arg.data, response: arg.response };
      }

      let httpResponse: BreezeHttpResponse = {
        config: requestInfo.request,
        data: arg.data,
        getHeaders: makeGetHeaders(arg.response.headers),
        status: arg.response.status
      };
      httpResponse['ngConfig'] = requestInfo.request;
      httpResponse['statusText'] = arg.response.statusText;
      httpResponse['response'] = arg.response;
      config.success(httpResponse);
    }

    function errorFn(response: HttpErrorResponse) {
      if (response instanceof Error) {
        throw response; // program error; nothing we can do
      } else {
        let data: any;
        if (response.error instanceof HttpResponse) {
          data = response.error.body;
        } else if (response.error instanceof Error) {
          data = response.error.message;
        } else {
          data = response.error;
        }

        // Timeout appears as an error with status===0 and no data.
        if (response.status === 0 && data == null) {
          data = 'timeout';
        }

        let errorMessage = response.status + ": " + response.statusText;
        if (data && typeof data === 'object') {
          data["message"] = data["message"] || errorMessage;  // breeze looks at the message property
        }
        if (!data) {
          data = errorMessage;   // Return the error message as data
        }
        let httpResponse: BreezeHttpResponse = {
          config: requestInfo.request,
          data: data,
          getHeaders: makeGetHeaders(response.headers),
          status: response.status
        };
        httpResponse['ngConfig'] = requestInfo.request;
        httpResponse['statusText'] = response.statusText;
        httpResponse['response'] = response;

        config.error(httpResponse); // send error to breeze error handler
      }
    }
  }

}

///// Helpers ////

function encodeParams(obj: {}) {
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

function makeGetHeaders(headers: HttpHeaders) {
  return function getHeaders(headerName?: string) { return headers.getAll(headerName).join('\r\n'); };
}