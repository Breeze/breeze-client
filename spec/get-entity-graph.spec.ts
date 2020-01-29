// import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
// import { EntityManager } from '../src/entity-manager';
// import '../src/mixin-get-entity-graph';
// import { HasEntityGraph } from '../src/mixin-get-entity-graph';

import { EntityManager } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';

import 'breeze-client/mixin-get-entity-graph';
import { HasEntityGraph } from 'breeze-client/mixin-get-entity-graph';

ModelLibraryBackingStoreAdapter.register();
const metadata = require('./support/NorthwindIBMetadata.json');

// TODO migrate tests from https://github.com/Breeze/breeze.js.samples/blob/master/net/DocCode/DocCode/tests/getEntityGraphTests.js
describe("GetEntityGraph", () => {

  beforeEach(function () {
  });

  test("should graph Order expand Customer", () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let customer = em.createEntity("Customer", { companyName: "ACME"});
    expect(customer).toBeTruthy();
    expect(customer['companyName']).toEqual("ACME");

    let o1 = em.createEntity("Order", { shipName: "One", customer: customer });
    let o2 = em.createEntity("Order", { shipName: "Two", customer: customer });
    let orders = [o1, o2];

    let graph = (em as any as HasEntityGraph).getEntityGraph(orders, 'customer');
    expect(graph.length).toEqual(3);
  });

  test("should graph Customer expand Orders", () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let customer = em.createEntity("Customer", { companyName: "ACME"});
    expect(customer).toBeTruthy();
    expect(customer['companyName']).toEqual("ACME");

    let o1 = em.createEntity("Order", { shipName: "One", customer: customer });
    let o2 = em.createEntity("Order", { shipName: "Two", customer: customer });

    let graph = (em as HasEntityGraph).getEntityGraph(customer, 'orders');
    expect(graph.length).toEqual(3);
  });
});


