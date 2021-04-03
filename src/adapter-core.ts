/** Appends parameter to url, with appropriate delimiter */
export function appendQueryStringParameter(url: string, parameter: string) {
  if (!parameter) return url;

  let separator = url.endsWith("?") ? "" : url.includes("?") ? "&" : "?";

  return url + separator + parameter;
}

/** Encodes the object into query string parameters */
export function encodeParams(obj: {}) {
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
