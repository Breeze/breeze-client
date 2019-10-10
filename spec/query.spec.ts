
import { AjaxConfig, AjaxFakeAdapter } from '../src/adapter-ajax-fake';
import { DataServiceWebApiAdapter } from '../src/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from '../src/adapter-uri-builder-json';
import { config } from '../src/config';
import { EntityManager } from '../src/entity-manager';
import { EntityQuery } from '../src/entity-query';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
ModelLibraryBackingStoreAdapter.register();
UriBuilderJsonAdapter.register();
DataServiceWebApiAdapter.register();
AjaxFakeAdapter.register();
const metadata = require('./support/ComplexTypeMetadata.json');
const ajaxAdapter = config.getAdapterInstance<AjaxFakeAdapter>("ajax");

describe("Query", function () {

  beforeEach(function () {
  });

  it("should create query and get results", function () {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    ajaxAdapter.responseFn = responseFn;

    let query = new EntityQuery("Customer");
    expect(query.resourceName).toEqual("Customer");

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