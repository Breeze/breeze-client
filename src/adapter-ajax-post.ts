import * as breeze from 'breeze-client';

/**
 *  Functions to enable Breeze to use POST for queries when
 *  special parameters are passed using the .withParameters function.
 *
 * Copyright 2015-2019 IdeaBlade, Inc.  All Rights Reserved.
 * Use, reproduction, distribution, and modification of this code is subject to the terms and
 * conditions of the IdeaBlade Breeze license, available at http://www.breezejs.com/license
 *
 * Author: Steve Schmitt
 * Version: 
 *  1.2.0 - Moved into breeze-client repo and npm package
 *  1.1.0 - revised: eliminated return object, configAjaxAdapter method; add ajaxPostEnabled flag
 *  1.0.6 - original
 *
 * Special parameters:
 *  $method: ‘POST’ or ‘GET’ (the default)
 *  $encoding: ‘JSON’ or x-www-form-urlencoded (the default)
 *  $data: contains the data to be sent to the server
 *
 * Installation:
 *    var ajaxAdapter = config.initializeAdapterInstance('ajax', adapterName, true);
 *    AjaxPostAdapter.wrapAjax(ajaxAdapter);
 *
 * Example:
 *   var query = breeze.EntityQuery.from('SimilarCustomersPOST')
 *            .withParameters({
 *                $method: 'POST',
 *                $encoding: 'JSON',
 *               $data: { CompanyName: 'Hilo Hattie', ContactName: 'Donald', City: 'Duck', Country: 'USA', Phone: '808-234-5678' }
 *           });
 *
 **/
export class AjaxPostAdapter {

  static wrapAjax(ajaxAdapter: breeze.AjaxAdapter) {

    if ((ajaxAdapter as any).ajaxPostEnabled) {
      return; // already wrapped it.
    }

    let ajaxFunction = ajaxAdapter.ajax;
    if (ajaxFunction) {
      ajaxAdapter.ajax = function (settings) {
        processSettings(settings);
        return ajaxFunction.call(ajaxAdapter, settings);
      };
      (ajaxAdapter as any).ajaxPostEnabled = true;
    }


    // Handle the POST-specific properties in the settings - $method, $data, $encoding
    function processSettings(settings: any) {
      let parameters = settings && settings.params;
      if (!parameters) return settings;

      // wrapped data; handle the special properties
      settings.type = parameters.$method || settings.type; // GET is default method

      let data = parameters.$data;
      if (data) {
        // if $data exists, assume all of other parameters are guidance for building a POST
        if (parameters.$encoding === 'JSON') {
          // JSON encoding
          settings.processData = false; // don't let JQuery form-encode it
          settings.contentType = "application/json; charset=UTF-8";

          if (typeof (data) === 'object') {
            settings.data = JSON.stringify(data); // encode parameters as JSON
          } else {
            settings.data = data;
          }
        } else {
          settings.data = data;
        }
        // must be null or jQuery ajax adapter won't see settings.data
        settings.params = null;
      }

      return settings;
    }
  }


}