
// import { AjaxFakeAdapter } from '../src/adapter-ajax-fake';
// import { DataServiceWebApiAdapter } from '../src/adapter-data-service-webapi';
// import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
// import { UriBuilderJsonAdapter } from '../src/adapter-uri-builder-json';
// import { config } from '../src/config';
// import { EntityManager } from '../src/entity-manager';
// import { EntityQuery } from '../src/entity-query';
// import { AjaxConfig, MappingContext, NodeContext, JsonResultsAdapter } from 'breeze-client';

import { config, EntityManager, EntityQuery, AjaxConfig, MappingContext, NodeContext, JsonResultsAdapter } from 'breeze-client';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';

import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';
import { AjaxFakeAdapter } from 'breeze-client/adapter-ajax-fake';

// jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
ModelLibraryBackingStoreAdapter.register();
UriBuilderJsonAdapter.register();

AjaxFakeAdapter.register();
DataServiceWebApiAdapter.register();


const metadata = require('./support/ComplexTypeMetadata.json');

const dtoAdapter = {
  name: 'dtoAdapter',
  extractResults: (data: any) => {
    const results = data.results;
    if (results.contractors) {
      return results.contractors;
    }
    return results;
  },
  visitNode: (node: any, mappingContext: MappingContext, nodeContext: NodeContext) => { return {}; }
};


describe("AjaxFake", () => {

  beforeEach(function () {
  });

  test("should create query and get results", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    const ajaxAdapter = config.getAdapterInstance<AjaxFakeAdapter>("ajax");
    ms.importMetadata(metadata);

    
    ajaxAdapter.responseFn = responseFn;

    let query = new EntityQuery("Customer");
    expect(query.resourceName).toEqual("Customer");

    return em.executeQuery(query).then(qr => {
      expect(qr.results.length).toEqual(3);
    });
  });

  test("should allow using a JsonResultsAdapter", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    
    const ajaxAdapter = config.getAdapterInstance<AjaxFakeAdapter>("ajax");
    ajaxAdapter.responseFn = responseFn;

    let query = new EntityQuery("Customer");
    expect(query.resourceName).toEqual("Customer");

    let adapter = new JsonResultsAdapter(dtoAdapter);

    query = query.using(adapter);

    return em.executeQuery(query).then(qr => {
      expect(qr.results.length).toEqual(3);
    });
  });

});


function responseFn(config: AjaxConfig) {
  if (config.url === "test/Customer") {
    return [
      { Id: 21, CompanyName: "FirstCo" },
      { Id: 22, CompanyName: "SecondCo" },
      { Id: 23, CompanyName: "ThirdCo" },
    ];
  }
  return null;
}