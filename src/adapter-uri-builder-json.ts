import * as breeze from 'breeze-client';

export class UriBuilderJsonAdapter implements breeze.UriBuilderAdapter {
  name: string;

  constructor() {
    this.name = "json";
  }

  static register() {
    breeze.config.registerAdapter("uriBuilder", UriBuilderJsonAdapter);
    breeze.config.initializeAdapterInstance("uriBuilder", "json", true);
  }

  initialize() {}

  buildUri(entityQuery: breeze.EntityQuery, metadataStore: breeze.MetadataStore) {
    // force entityType validation;
    let entityType = entityQuery._getFromEntityType(metadataStore, false);
    if (!entityType) entityType = new breeze.EntityType(metadataStore);
    let json = entityQuery.toJSONExt( { entityType: entityType, toNameOnServer: true}) as any;
    json.from = undefined;
    json.queryOptions = undefined;

    let jsonString = JSON.stringify(json);
    let urlBody = encodeURIComponent(jsonString);
    return entityQuery.resourceName + "?" + urlBody;

  }

}

breeze.config.registerAdapter("uriBuilder", UriBuilderJsonAdapter);



