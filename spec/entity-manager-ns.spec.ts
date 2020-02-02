import { EntityManager, EntityType, ComplexType, EntityState, EntityAction, EntityChangedEventArgs, breeze, MetadataStore, SaveOptions, QueryOptions, ValidationOptions } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { TestFns } from './test-fns';

ModelLibraryBackingStoreAdapter.register();

const sampleMetadata = require('./support/NorthwindIBMetadata.json');
const sampleMetadataStore = getSampleMetadataStore();

describe("EntityManager - no server", () => {

  beforeEach(function() {

  });

  test("initialization", function () {
    const em = new EntityManager("foo");
    em.setProperties({
      queryOptions: new QueryOptions(),
      saveOptions: new SaveOptions(),
      validationOptions: new ValidationOptions()
    });
    expect(em).toBeTruthy();
  });

  test("should be able to create", () => {
    let em = new EntityManager('test');
    let r = em.getChanges();
    expect(r.length).toBe(0);
  });

  test("should load metadata", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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
    ms.importMetadata(sampleMetadata);

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

  test("getChanges", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    const custType = em.metadataStore.getAsEntityType("Customer");
    for (let i = 0; i < 5; i++) {
      em.addEntity(orderType.createEntity()).entityAspect.setUnchanged();
      em.addEntity(empType.createEntity()).entityAspect.setUnchanged();
    }
    for (let i = 0; i < 5; i++) {
      em.addEntity(orderType.createEntity()).entityAspect.setModified();
      em.addEntity(empType.createEntity());
    }
    const c1 = em.getChanges();
    expect(c1.length).toBe(10);
    const c2 = em.getChanges("Order");
    expect(c2.length).toBe(5);
    const c3 = em.getChanges([orderType, custType]);
    expect(c3.length).toBe(5);
    const c4 = em.getChanges([orderType, empType]);
    expect(c4.length).toBe(10);
    const c5 = em.getEntities(["Order"], EntityState.Modified);
    expect(c5.length).toBe(5);
    const c6 = em.getEntities([orderType], EntityState.Added);
    expect(c6.length).toBe(0);
    const c7 = em.getEntities(null, EntityState.Added);
    expect(c7.length).toBe(5);
    const c8 = em.getEntities(null, [EntityState.Added, EntityState.Modified]);
    expect(c8.length).toBe(10);
  });

  test("hasChanges basic", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");

    let  count = 0;
    em.hasChangesChanged.subscribe( args => {
      count = count + 1;
    });
    expect(count).toBe(0);
    expect(em.hasChanges()).toBe(false);
    const order1 = orderType.createEntity();
    // attach - no event
    em.attachEntity(order1);
    expect(count).toBe(0);
    expect(em.hasChanges()).toBe(false);
    const order2 = orderType.createEntity();
    // add - event 
    em.addEntity(order2);
    expect(count).toBe(1);
    expect(em.hasChanges()).toBe(true);

    em.rejectChanges();
    expect(em.hasChanges()).toBe(false);
  });


  test("hasChanges filtering by type", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    em.createEntity('Order');
    em.createEntity('Product', null, breeze.EntityState.Unchanged);
    // There are Order changes but there are no Product changes
    expect(em.hasChanges()).toBe(true);
    expect(em.hasChanges(['Order'])).toBe(true);
    expect(em.hasChanges(['Product'])).toBe(false);
  });

  // D#2663
  test("hasChanges is false when filter for a type that is not in cache", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    em.createEntity('Order');
    // While 'Product' is a defined type, there are no Products in cache this time.
    // There are changes but there are no Product changes
    const hasChanges = em.hasChanges();
    expect(em.hasChanges()).toBe(true);
    expect(em.hasChanges(['Product'])).toBe(false);
  });

  test("hasChanges throws error when filter for a type that doesn't exist", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    em.createEntity('Order');
    
    expect(em.hasChanges()).toBe(true);
    // There are changes but there is no 'Foo' type
    expect(function() {
      em.hasChanges(['Foo']);
    }).toThrow(/unable to locate a 'Type'/i);
  });

  test("hasChanges with em.acceptChanges", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    expect(em.hasChanges()).toBe(false);
    const order1 = orderType.createEntity();
    em.attachEntity(order1);
    // attach causes no changes
    expect(em.hasChanges()).toBe(false);
    const order2 = orderType.createEntity();
    em.addEntity(order2);
    // but add does
    expect(em.hasChanges()).toBe(true);
    em.acceptChanges();
    expect(em.hasChanges()).toBe(false);
  });

  test("hasChanges with rejectChanges", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    let count = 0;
    em.hasChangesChanged.subscribe(args => {
      count = count + 1;
     });
    expect(count).toBe(0);
    expect(em.hasChanges()).toBe(false);
    const order1 = orderType.createEntity();
    em.attachEntity(order1);
    order1.entityAspect.setModified();
    expect(count).toBe(1);
    expect(em.hasChanges()).toBe(true);
    const order2 = orderType.createEntity();
    em.addEntity(order2);
    expect(count).toBe(1);
    expect(em.hasChanges()).toBe(true);
    order1.entityAspect.rejectChanges();
    expect(count).toBe(1);
    expect(em.hasChanges()).toBe(true);
    order2.entityAspect.rejectChanges();
    expect(count).toBe(2);
    expect(em.hasChanges()).toBe(false);
  });


  test("entityChanged event", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    const custType = em.metadataStore.getAsEntityType("Customer");

    let changedArgs: any[] = [];
    let lastArgs: EntityChangedEventArgs, lastAction, lastEntity;
    em.entityChanged.subscribe( args => {
      changedArgs.push(args);
      lastArgs = args;
      lastAction = args.entityAction;
      lastEntity = args.entity;
    });
    const order = orderType.createEntity();
    
    em.addEntity(order);
    expect(lastAction).toBe(EntityAction.Attach);
    expect(lastEntity).toBe(order);

    const emp = empType.createEntity();
    changedArgs = [];
    em.attachEntity(emp);
    expect(lastAction).toBe(EntityAction.Attach);
    expect(lastEntity).toBe(emp);

    emp.setProperty("lastName", "Smith");
    expect(lastAction).toBe(EntityAction.PropertyChange);
    expect(lastEntity).toBe(emp);
    expect(lastArgs.args.propertyName).toBe("lastName");

    changedArgs = [];
    emp.entityAspect.rejectChanges();
    expect(changedArgs[0].entityAction).toBe(EntityAction.EntityStateChange);
    expect(changedArgs[1].entityAction).toBe(EntityAction.RejectChanges);
    expect(lastEntity).toBe(emp);

    emp.setProperty("lastName", "Jones");
    changedArgs = [];
    emp.entityAspect.acceptChanges();
    expect(changedArgs[0].entityAction).toBe(EntityAction.EntityStateChange);
    expect(changedArgs[1].entityAction).toBe(EntityAction.AcceptChanges);
    expect(lastEntity).toBe(emp);

    em.clear();
    expect(lastAction).toBe(EntityAction.Clear);
    expect(lastEntity).toBeUndefined();
  });

  test("entityChanged event 'isEnabled'", () => {
      // D#2652
      // see http://www.breezejs.com/sites/all/apidocs/classes/Event.html#method_isEnabled
      // which also describes EntityManager having propertyChanged event which it doesn't
      const em = TestFns.newEntityManager();
      const eventEnabled = breeze.Event.isEnabled("entityChanged", em);
      expect(eventEnabled).not.toBeUndefined();
  });

  test("entityChanged event suppressed", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    const custType = em.metadataStore.getAsEntityType("Customer");

    const changedArgs: EntityChangedEventArgs[] = [];
    breeze.Event.enable("entityChanged", em, false);
    em.entityChanged.subscribe(function (args) {
      changedArgs.push(args);
    });
    const order = orderType.createEntity();
    em.addEntity(order);
    const emp = empType.createEntity();
    em.attachEntity(emp);
    emp.setProperty("lastName", "Smith");
    emp.entityAspect.rejectChanges();
    emp.setProperty("lastName", "Jones");
    emp.entityAspect.acceptChanges();
    em.clear();
    expect(changedArgs.length).toBe(0);
  });

  test("entityChanged event suppressed by function", function () {
    const em = TestFns.newEntityManager(sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    em['tag'] = "foo";
    const changedArgs = [];
    breeze.Event.enable("entityChanged", em, em => em.tag === "enabled");
    em.entityChanged.subscribe(function (args) {
      changedArgs.push(args);
    });
    const order = orderType.createEntity();
    em.addEntity(order);
    const emp = empType.createEntity();
    em.attachEntity(emp);
    emp.setProperty("lastName", "Smith");
    emp.entityAspect.rejectChanges();
    emp.setProperty("lastName", "Jones");
    emp.entityAspect.acceptChanges();
    em.clear();
    expect(changedArgs.length).toBe(0);
  });


});

function getSampleMetadataStore() {
  let ms = new MetadataStore();
  ms.importMetadata(sampleMetadata);
  return ms;
}