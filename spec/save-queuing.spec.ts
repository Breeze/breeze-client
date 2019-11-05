
import { AjaxConfig } from 'breeze-client';
import { AjaxFakeAdapter } from '../src/adapter-ajax-fake';
import { DataServiceWebApiAdapter } from '../src/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from '../src/adapter-uri-builder-json';
import { config } from '../src/config';
import { EntityManager, SaveResult } from '../src/entity-manager';
import { enableSaveQueuing } from '../src/mixin-save-queuing';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
ModelLibraryBackingStoreAdapter.register();
UriBuilderJsonAdapter.register();
DataServiceWebApiAdapter.register();
AjaxFakeAdapter.register();
const metadata = require('./support/NorthwindIBMetadata.json');

// TODO migrate tests from https://github.com/Breeze/breeze.js.samples/blob/master/net/DocCode/DocCode/tests/saveQueuingTests.js

describe("Save Queuing", function () {

  beforeEach(function () {
  });

  it("should save a single add", function () {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, true);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    expect(cust0.entityType.shortName).toEqual('Customer');

    expect(cust0.entityAspect.validateEntity()).toBeTruthy("Validation Errors");
    // console.log(cust0.entityAspect.getValidationErrors());

    return em.saveChanges().then(sr => {
      let rcust0 = sr.entities[0];
      expect(rcust0['companyName']).toEqual("FirstCo");
      expect(rcust0.entityAspect.entityState.name).toEqual("Unchanged");
    });
  });

  it("should fail simultanous saves without SaveQueuing", function () {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, false);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    em.saveChanges();

    let cust1 = em.createEntity('Customer', { companyName: "SecondCo" });
    return em.saveChanges().then(sr => {
      throw new Error("should not allow concurrent saves");
    }).catch(err => {
      expect(err.message).toMatch("Concurrent saves not allowed");
    });
  });

  it("should allow simultanous saves with SaveQueuing", function () {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, true);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    let p0 = em.saveChanges();

    let cust1 = em.createEntity('Customer', { companyName: "SecondCo" });
    let p1 = em.saveChanges();

    return Promise.all([p0, p1]).then((sr: SaveResult[]) => {
      expect(sr.length).toEqual(2);
      expect(sr[0].entities.length).toEqual(1);
      expect(sr[0].entities[0]['companyName']).toEqual("FirstCo");
      expect(sr[1].entities.length).toEqual(1);
      expect(sr[1].entities[0]['companyName']).toEqual("SecondCo");
    });
  });

});

