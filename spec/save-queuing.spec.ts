import { AjaxConfig, EntityManager, SaveResult, config } from 'breeze-client';
import { DataServiceWebApiAdapter } from 'breeze-client/adapter-data-service-webapi';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { UriBuilderJsonAdapter } from 'breeze-client/adapter-uri-builder-json';

import { enableSaveQueuing } from 'breeze-client/mixin-save-queuing';

import { AjaxFakeAdapter } from './adapter-ajax-fake';

// jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
ModelLibraryBackingStoreAdapter.register();
UriBuilderJsonAdapter.register();
DataServiceWebApiAdapter.register();
AjaxFakeAdapter.register();
const metadata = require('./support/NorthwindIBMetadata.json');

// TODO migrate tests from https://github.com/Breeze/breeze.js.samples/blob/master/net/DocCode/DocCode/tests/saveQueuingTests.js

describe("Save Queuing", () => {

  beforeEach( () => {
    
  });

  test("should save a single add", async () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, true);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    expect(cust0.entityType.shortName).toEqual('Customer');

    expect(cust0.entityAspect.validateEntity()).toBeTruthy();
    // console.log(cust0.entityAspect.getValidationErrors());

    const sr = await em.saveChanges();
    let rcust0 = sr.entities[0];
    expect(rcust0['companyName']).toEqual("FirstCo");
    expect(rcust0.entityAspect.entityState.name).toEqual("Unchanged");
  });

  test("should fail simultanous saves without SaveQueuing", async () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, false);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    em.saveChanges();

    let cust1 = em.createEntity('Customer', { companyName: "SecondCo" });
    try {
      const sr = await em.saveChanges();
      throw new Error("should not allow concurrent saves");
    }
    catch (err) {
      expect(err.message).toMatch("Concurrent saves not allowed");
    }
  });

  test("should allow simultanous saves with SaveQueuing", async () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);
    enableSaveQueuing(em, true);

    let cust0 = em.createEntity('Customer', { companyName: "FirstCo" });
    let p0 = em.saveChanges();

    let cust1 = em.createEntity('Customer', { companyName: "SecondCo" });
    let p1 = em.saveChanges();

    const sr = await Promise.all([p0, p1]);
    expect(sr.length).toEqual(2);
    expect(sr[0].entities.length).toEqual(1);
    expect(sr[0].entities[0]['companyName']).toEqual("FirstCo");
    expect(sr[1].entities.length).toEqual(1);
    expect(sr[1].entities[0]['companyName']).toEqual("SecondCo");
  });

});

