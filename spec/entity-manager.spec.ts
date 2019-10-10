
import { EntityManager } from '../src/entity-manager';
import { ModelLibraryBackingStoreAdapter } from '../src/adapter-model-library-backing-store';
import { EntityType, ComplexType } from 'breeze-client';

ModelLibraryBackingStoreAdapter.register();
const metadata = require('./support/NorthwindIBMetadata.json');

describe("EntityManager", function() {


  beforeEach(function() {

  });

  it("should be able to create", function() {
    let em = new EntityManager('test');
    let r = em.getChanges();
    expect(r.length).toBe(0);

  });

  it("should load metadata", function() {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let orderType = ms.getEntityType("Order") as EntityType;
    expect(orderType).toBeTruthy();

    expect(orderType.shortName).toEqual("Order");

    let custProp = orderType.getProperty("customer");
    expect(custProp.name).toEqual("customer");
    expect(custProp.isNavigationProperty).toBeTruthy();

  });  

  it("should create entity", function() {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let order = em.createEntity("Order", { shipName: "Barnum"});
    expect(order).toBeTruthy();

    let shipName = order.getProperty("shipName");
    expect(shipName).toEqual("Barnum");

    let orderID = order.getProperty("orderID");
    expect(orderID).toBeLessThanOrEqual(-1);
  });

  it("should create entity and complex type", function() {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let supplier = em.createEntity("Supplier", { companyName: "ACME"});
    expect(supplier).toBeTruthy();

    let locType = ms.getEntityType("Location") as ComplexType;
    expect(locType).toBeTruthy();
    let loc1 = locType.createInstance({ address: "111 Oak Street"});

    supplier.setProperty("location", loc1);
    let ok = supplier.entityAspect.validateEntity();
    expect(ok).toBeTruthy();

    let loc2 = supplier.getProperty("location");
    expect(loc2).toBeTruthy();
    expect(loc2.address).toEqual("111 Oak Street");
  });
});