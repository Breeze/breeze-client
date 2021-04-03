import * as breeze from 'breeze-client';
import { appendQueryStringParameter } from './adapter-core';

export class UriBuilderJsonAdapter implements breeze.UriBuilderAdapter {
  name: string;

  constructor() {
    this.name = "json";
  }

  static register(config?: breeze.BreezeConfig) {
    config = config || breeze.config;
    config.registerAdapter("uriBuilder", UriBuilderJsonAdapter);
    return config.initializeAdapterInstance("uriBuilder", "json", true) as UriBuilderJsonAdapter;
  }

  initialize() {}

  buildUri(entityQuery: breeze.EntityQuery, metadataStore: breeze.MetadataStore) {
    // force entityType validation;
    let entityType = entityQuery._getFromEntityType(metadataStore, false);
    if (!entityType) entityType = new breeze.EntityType(metadataStore);
    let json = entityQuery.toJSONExt( { entityType: entityType, toNameOnServer: true}) as any;
    json.from = undefined;
    json.queryOptions = undefined;
    if (json.parameters && json.parameters.$data) {
      // remove parameters if doing ajax post
      json.parameters = undefined;
    }

    let jsonString = JSON.stringify(json);
    if (jsonString.length > 2) {
      let urlBody = encodeURIComponent(jsonString);
      return appendQueryStringParameter(entityQuery.resourceName, urlBody);
    } else {
      return entityQuery.resourceName;
    }

  }

}

breeze.config.registerAdapter("uriBuilder", UriBuilderJsonAdapter);



