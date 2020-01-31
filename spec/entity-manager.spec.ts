import { EntityManager, EntityType, ComplexType } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';

ModelLibraryBackingStoreAdapter.register();
const metadata = require('./support/NorthwindIBMetadata.json');

describe("EntityManager", () => {


  beforeEach(function() {

  });

  test("should be able to create", () => {
    let em = new EntityManager('test');
    let r = em.getChanges();
    expect(r.length).toBe(0);

  });

  test("should load metadata", () => {

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

  test("should create entity", () => {

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

  test("should create entity and complex type", () => {

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


  test("should attach entities using foreign key", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let order = em.createEntity("Order", { orderID: ordID, shipName: "Barnum"});
    expect(order).toBeTruthy();   
    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    expect(cust).toBeTruthy();

    let orderCust = order.getProperty("customer");
    expect(orderCust).toBeNull();

    order.setProperty("customerID", custID);

    orderCust = order.getProperty("customer");
    expect(orderCust).toEqual(cust);

    let custOrders = cust.getProperty("orders");
    expect(custOrders).toBeTruthy();
    expect(custOrders.length).toEqual(1);
    expect(custOrders[0]).toEqual(order);

  });

  test("should attach entities when added to array", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let order = em.createEntity("Order", { orderID: ordID, shipName: "Barnum"});
    expect(order).toBeTruthy();   
    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    expect(cust).toBeTruthy();

    let custOrders = cust.getProperty("orders");
    expect(custOrders).toBeTruthy();
    expect(custOrders.length).toEqual(0);

    custOrders.push(order);

    let orderCust = order.getProperty("customer");
    expect(orderCust).toEqual(cust);

    expect(custOrders.length).toEqual(1);
    expect(custOrders[0]).toEqual(order);
  });

  test("should attach entities when fk set in constructor", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, customerID: custID, shipName: "Barnum"});

    let custOrders = cust.getProperty("orders");
    let orderCust = order.getProperty("customer");
    expect(orderCust).toEqual(cust);

    expect(custOrders.length).toEqual(1);
    expect(custOrders[0]).toEqual(order);
  });

  test("should unattach entities when fk set to null", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, customerID: custID, shipName: "Barnum"});

    order.setProperty("customerID", null);

    let custOrders = cust.getProperty("orders");
    let orderCust = order.getProperty("customer");
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);   
  });

  test("should unattach entities when fk set to undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, customerID: custID, shipName: "Barnum"});

    order.setProperty("customerID", undefined);

    let custOrders = cust.getProperty("orders");
    let orderCust = order.getProperty("customer");
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);   
  });

  test("should set FK to null when nav property set to null", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, customerID: custID, shipName: "Barnum"});
    let orderCustId = order.getProperty("customerID");
    expect(orderCustId).toEqual(custID);

    order.setProperty("customer", null);

    let custOrders = cust.getProperty("orders");
    let orderCust = order.getProperty("customer");
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);
    orderCustId = order.getProperty("customerID");
    expect(orderCustId).toBeNull();
  });

  test("should set FK to null when nav property set to undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, customerID: custID, shipName: "Barnum"});
    let orderCust = order.getProperty("customer");
    expect(orderCust).toEqual(cust);
    // order.setProperty("customer", undefined);
    (order as any).customer = undefined;

    let custOrders = cust.getProperty("orders");
    // orderCust = order.getProperty("customer");
    orderCust = (order as any).customer;
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);
    let orderCustId = order.getProperty("customerID");
    expect(orderCustId).toBeNull();
  });

  test("should set FK to null when nav property is initially undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(metadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, shipName: "Barnum"});
    // let orderCust = order.getProperty("customer");
    // expect(orderCust).toEqual(cust);

    // order.setProperty("customer", undefined);
    order.setProperty("customer", undefined);
    // (order as any).customer = undefined;

    let custOrders = cust.getProperty("orders");
    // orderCust = order.getProperty("customer");
    let orderCust = (order as any).customer;
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);
    let orderCustId = order.getProperty("customerID");
    expect(orderCustId).toBeNull();
  });

});