import { EntityManager, EntityType, ComplexType, EntityState, EntityAction, EntityChangedEventArgs, breeze, MetadataStore, SaveOptions, QueryOptions, ValidationOptions, Entity, DataType, core, EntityKey, RelationArray, PropertyChangedEventArgs } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { TestFns } from './test-fns';

ModelLibraryBackingStoreAdapter.register();

TestFns.initNonServerEnv();

describe("EntityManager - no server", () => {

  beforeEach(function() {
    TestFns.initSampleMetadataStore();
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
    ms.importMetadata(TestFns.sampleMetadata);

    let orderType = ms.getEntityType("Order") as EntityType;
    expect(orderType).toBeTruthy();

    expect(orderType.shortName).toEqual("Order");

    let custProp = orderType.getProperty("customer");
    expect(custProp.name).toEqual("customer");
    expect(custProp.isNavigationProperty).toBeTruthy();
  });  

  test("connect entities using foreign key", () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("connect entities when added to navigation collection array", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("connect entities disallowed when setting collection navigation properties", () => {

    const em = TestFns.newEntityManager();
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const customer = customerType.createEntity();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const order = orderType.createEntity();
    em.attachEntity(customer);
    const origOrders = customer.getProperty("orders");
    expect(origOrders.length).toBe(0);
    origOrders.push(order);
    expect(origOrders.length).toBe(1);
    try {
      customer.setProperty("orders", ["foo", "bar"]);
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message).toMatch(/navigation/);
      expect(customer.getProperty("orders")).toBe(origOrders);
    }
  });

  test("connect entities when fk set in constructor", () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("connect entities - changing a child FK to ID of entity-not-in cache clears the navigation", function() {
    const em = TestFns.newEntityManager();
    const dummyCustID = breeze.core.getUuid();

    // create a parent Customer and its child order
    const parentCustomer = em.createEntity("Customer", {
      customerID: dummyCustID,
      companyName: 'TestCo'
    }, EntityState.Unchanged);

    const order = em.createEntity("Order", {
      customerID: parentCustomer.getProperty("customerID")
    }, EntityState.Unchanged);


    let orderCustomer = order.getProperty("customer");
    expect(orderCustomer).toBeTruthy();

    // change FK to ID of an entity not-in-cache
    order.setProperty("customerID", TestFns.wellKnownData.alfredsID);

    orderCustomer = order.getProperty("customer");
    expect(orderCustomer).toBeNull();
  });

  test("connect entities - unidirectional n-> 1", () => {
    const em = TestFns.newEntityManager();
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    const orderDetail = orderDetailType.createEntity();
    const productType = em.metadataStore.getAsEntityType("Product");
    const product = productType.createEntity();
    orderDetail.setProperty("productID", -99);
    em.attachEntity(orderDetail);
    em.attachEntity(product);
    const nullProduct = orderDetail.getProperty("product");
    expect(nullProduct).toBeNull();
    product.setProperty("productID", 7);
    orderDetail.setProperty("productID", 7);
    const sameProduct = orderDetail.getProperty("product");
    expect(product).toBe(sameProduct);

  });

  // testFns.skipIf("odata,hibernate", "does not have TimeList and Timegroup tables").
  test("connect entities - unidirectional 1-> n", () => {
    const em = TestFns.newEntityManager();

    const tl1 = em.createEntity("TimeLimit");
    const tl2 = em.createEntity("TimeLimit");
    const tg1 = em.createEntity("TimeGroup");
    const id = tg1.getProperty("id");
    tl1.setProperty("timeGroupId", id);
    const timeLimits = tg1.getProperty("timeLimits");
    expect(timeLimits.length).toBe(1);
    tl2.setProperty("timeGroupId", id);
    expect(timeLimits.length).toBe(2);
  });

  // testFns.skipIf("odata,hibernate", "does not have TimeList and Timegroup tables").
  test("connect entities - unidirectional 1-> n - part 2", () => {
    const em = TestFns.newEntityManager();

    const tl1 = em.createEntity("TimeLimit");
    const tl2 = em.createEntity("TimeLimit");
    const tg1 = em.createEntity("TimeGroup");
    const timeLimits = tg1.getProperty("timeLimits");
    expect(timeLimits.length).toBe(0);
    timeLimits.push(tl1);
    expect(timeLimits.length).toBe(1);
    timeLimits.push(tl2);
    expect(timeLimits.length).toBe(2);
    const timeLimits2 = tg1.getProperty("timeLimits");
    expect(timeLimits).toBe(timeLimits2);
    // add one that is already there
    timeLimits.push(tl1);
    expect(timeLimits.length).toBe(2);
  });

  test("connect entities via primary key", () => {
    const em = TestFns.newEntityManager();
    const productType = em.metadataStore.getAsEntityType("Product");
    const product = productType.createEntity();
    const productKeyName = TestFns.wellKnownData.keyNames.product;
    em.attachEntity(product);
    const origProductId = product.getProperty(productKeyName);
    let entityKey = new EntityKey(productType, [origProductId]);
    let sameProduct = em.findEntityByKey(entityKey);
    const sameProduct2 = em.getEntityByKey("Product", origProductId);
    expect(product).toBe(sameProduct);
    expect(product).toBe(sameProduct2);
    product.setProperty(productKeyName, 7);
    sameProduct = em.getEntityByKey(entityKey);
    expect(sameProduct).toBe(null);
    entityKey = new EntityKey(productType, [7]);
    sameProduct = em.findEntityByKey(entityKey);
    expect(product).toBe(sameProduct);
  });

  test("connect entities - changing FK to null removes it from old parent", () => {
    const em = TestFns.newEntityManager();
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const customer = customerType.createEntity();
    em.attachEntity(customer);
    const newOrder = em.createEntity("Order", { customer: customer });
    expect(customer.getProperty("orders").indexOf(newOrder) >= 0).toBe(true);
    newOrder.setProperty("customerID", null);
    expect(customer.getProperty("orders").indexOf(newOrder)).toBe(-1);
  });

  test("connect entities - setting child's parent entity null removes it from old parent", () => {
    const em = TestFns.newEntityManager();
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const customer = customerType.createEntity();
    em.attachEntity(customer);

    const newOrder = em.createEntity("Order", { customer: customer });
    let orders = customer.getProperty("orders");
    expect(orders.indexOf(newOrder) >= 0).toBe(true);

    newOrder.setProperty("customer", null); // set null to decouple the order from a customer
    orders = customer.getProperty("orders");
    expect(orders).not.toContain(newOrder);
  });

  test("connect entities - fk to nav - attached", () => {
    const em = TestFns.newEntityManager();
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    const cust1 = em.createEntity("Customer", null, EntityState.Detached);
    const order1 = em.createEntity("Order", null, EntityState.Detached);

    em.attachEntity(order1);
    em.attachEntity(cust1);

    const custIdValue = cust1.getProperty(customerKeyName);
    order1.setProperty("customerID", custIdValue);
    const orderCustomer = order1.getProperty("customer");
    expect(orderCustomer).toBe(cust1);

  });

  test("connect entities - nav to fk - attached", () => {
    const em = TestFns.newEntityManager();
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    const cust1 = em.createEntity("Customer", null, EntityState.Detached);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const order1 = em.createEntity(orderType, null, EntityState.Detached);

    em.attachEntity(order1);
    em.attachEntity(cust1);

    order1.setProperty("customer", cust1);
    const orderCustId = order1.getProperty("customerID");
    const custId = cust1.getProperty(customerKeyName);
    expect(orderCustId).toBe(custId);

  });

  test("connect entities - unattached children", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const c1Id = em.generateTempKeyValue(cust1);
    const cust2 = custType.createEntity();
    const order1 = orderType.createEntity();
    em.attachEntity(order1);
    expect(order1.entityAspect.entityState.isUnchanged()).toBe(true);
    // assign an fk where the parent doesn't yet exist on  this em.
    order1.setProperty("customerID", c1Id);
    expect(order1.entityAspect.entityState.isModified()).toBe(true);
    order1.entityAspect.acceptChanges();
    expect(order1.entityAspect.entityState.isUnchanged()).toBe(true);
    let order1Cust = order1.getProperty("customer");
    expect(order1Cust == null).toBe(true);
    em.attachEntity(cust1);
    order1Cust = order1.getProperty("customer");
    expect(order1Cust !== null).toBe(true);
    expect(order1.entityAspect.entityState.isUnchanged()).toBe(true);
  });

  test("connect entities - unattached parent pushes attached child", () => {
    const em = TestFns.newEntityManager();
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const c1Id = em.generateTempKeyValue(cust1);
    const cust2 = custType.createEntity();
    const order1 = orderType.createEntity();
    em.attachEntity(order1);
    expect(order1.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(cust1.entityAspect.entityState.isDetached()).toBe(true);
    let order1Cust = order1.getProperty("customer");
    expect(order1Cust == null).toBe(true);
    const cust1Orders = cust1.getProperty("orders");
    cust1Orders.push(order1);
    expect(order1.entityAspect.entityState.isModified()).toBe(true);
    expect(cust1.entityAspect.entityState.isAdded()).toBe(true);
    order1Cust = order1.getProperty("customer");
    expect(order1Cust !== null).toBe(true);
    const order1CustId = order1.getProperty("customerID");
    const custId = cust1.getProperty(customerKeyName);
    expect(order1CustId).toBe(custId);

  });

  test("connect entities - recursive navigation fixup", () => {
    const em = TestFns.newEntityManager();
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;
    const emp1 = em.createEntity("Employee", null, EntityState.Detached);
    const emp2 = em.createEntity("Employee", null, EntityState.Detached);
    const emp3 = em.createEntity("Employee", null, EntityState.Detached);

    expect(emp1.entityAspect.entityState.isDetached()).toBe(true);
    expect(emp2.entityAspect.entityState.isDetached()).toBe(true);
    expect(emp3.entityAspect.entityState.isDetached()).toBe(true);
    emp2.setProperty("manager", emp1);
    emp2.getProperty("directReports").push(emp3);
    em.addEntity(emp3);
    expect(emp1.entityAspect.entityState.isAdded()).toBe(true);
    expect(emp2.entityAspect.entityState.isAdded()).toBe(true);
    expect(emp3.entityAspect.entityState.isAdded()).toBe(true);
    const emp1Id = emp1.getProperty(employeeKeyName);
    const emp2Id = emp2.getProperty(employeeKeyName);
    const emp3Id = emp3.getProperty(employeeKeyName);
    expect(emp2.getProperty("reportsToEmployeeID")).toBe(emp1Id);
    expect(emp3.getProperty("reportsToEmployeeID")).toBe(emp2Id);
    expect(emp2.getProperty("directReports")[0]).toBe(emp3);
    expect(emp1.getProperty("directReports")[0]).toBe(emp2);
  });

  test("connect entities - exception if set nav to entity with different manager", () => {
    const em1 = TestFns.newEntityManager();
    const orderType = em1.metadataStore.getAsEntityType("Order");
    const o1 = orderType.createEntity();
    em1.attachEntity(o1);

    const em2 = TestFns.newEntityManager();
    const customerType = em2.metadataStore.getAsEntityType("Customer");
    const c1 = customerType.createEntity();
    em2.attachEntity(c1);

    expect(c1.entityAspect.entityManager).not.toBe(o1.entityAspect.entityManager);
    expect(() => o1.setProperty("customer", c1)).toThrow(/EntityManager/);

  });

  test("connect entities - change parent (1-n)", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const cust2 = custType.createEntity();
    const order1 = orderType.createEntity();

    em.attachEntity(order1);
    expect(order1.entityAspect.entityState.isUnchanged()).toBe(true);
    order1.setProperty("customer", cust1);
    expect(cust1.entityAspect.entityState.isAdded()).toBe(true);
    const cust1Orders = cust1.getProperty("orders");
    expect(cust1Orders.length).toBe(1);
    expect(cust1Orders).toContain(order1);

    // now change
    order1.setProperty("customer", cust2);
    expect(cust2.entityAspect.entityState.isAdded()).toBe(true);
    const cust2Orders = cust2.getProperty("orders");
    expect(cust2Orders.length).toBe(1);
    expect(cust2Orders).toContain(order1);
    expect(cust1Orders).toBe(cust1.getProperty("orders"));
    expect(cust1Orders).not.toContain(order1);
    expect(order1.getProperty("customer")).toBe(cust2);

  });

  test("connect entities - change child (1-n)", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const cid1 = em.generateTempKeyValue(cust1);
    const cust2 = custType.createEntity();
    const cid2 = em.generateTempKeyValue(cust2);
    const order1 = orderType.createEntity();

    em.attachEntity(cust1);

    expect(cust1.entityAspect.entityState.isUnchanged()).toBe(true);
    const cust1Orders = cust1.getProperty("orders");
    cust1Orders.push(order1);
    expect(cust1Orders.length).toBe(1);

    expect(order1.entityAspect.entityState.isAdded()).toBe(true);
    expect(cust1Orders).toContain(order1);
    // now change
    const cust2Orders = cust2.getProperty("orders");
    cust2Orders.push(order1);
    expect(cust2Orders.length).toBe(1);
    expect(cust1Orders.length).toBe(0);
    expect(cust2.entityAspect.entityState.isAdded()).toBe(true);
    expect(cust2Orders).toContain(order1);
    expect(cust1Orders).toBe(cust1.getProperty("orders"));
    expect(cust1Orders).not.toContain(order1);
    expect(order1.getProperty("customer")).toBe(cust2);
  });


  test("disconnect entities - FK to null when nav property set to null", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("disconnect entities - FK to null when nav property set to undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("disconnect entities - FK to null when nav property is initially undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

    let custID = "88888888-4444-4444-4444-121212121212";
    let ordID = 22;

    let cust = em.createEntity("Customer", { customerID: custID, companyName: "Wishbone"});
    let order = em.createEntity("Order", { orderID: ordID, shipName: "Barnum"});
    
    order.setProperty("customer", undefined);

    let custOrders = cust.getProperty("orders");
    // orderCust = order.getProperty("customer");
    let orderCust = (order as any).customer;
    expect(orderCust).toBeNull();
    expect(custOrders.length).toEqual(0);
    let orderCustId = order.getProperty("customerID");
    expect(orderCustId).toBeNull();
  });


  test("disconnect entities when fk set to null", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("disconnect entities when fk set to undefined", () => {

    let em = new EntityManager('test');
    let ms = em.metadataStore;
    ms.importMetadata(TestFns.sampleMetadata);

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

  test("graph attach (1-n) - setProperties child, attach child", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    order1.setProperty("customer", cust1);
    em.attachEntity(order1);
    expect(order1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Unchanged);
    const orders = cust1.getProperty("orders");
    expect(orders[0]).toBe(order1);
    expect(orders[0].getProperty("customer")).toBe(cust1);
  });

  test("graph attach (1-n)- setProperties child, attach parent", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    order1.setProperty("customer", cust1);
    em.attachEntity(cust1);
    expect(order1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Unchanged);
    const orders = cust1.getProperty("orders");
    expect(orders[0]).toBe(order1);
  });

  test("graph attach (1-n) - setProperties parent, attach parent", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    const cust1Orders = cust1.getProperty("orders");
    cust1Orders.push(order1);
    expect(cust1Orders.length).toBe(1);
    em.attachEntity(cust1);
    expect(order1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(order1.getProperty("customer")).toBe(cust1);
  });

  test("graph attach (1-n) - setProperties parent, attach child", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    const cust1Orders = cust1.getProperty("orders");
    cust1Orders.push(order1);
    expect(cust1Orders.length).toBe(1);
    em.attachEntity(order1);
    expect(order1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(order1.getProperty("customer")).toBe(cust1);
  });

  test("graph attach (1-n) - parent detach", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    const cust1Orders = cust1.getProperty("orders");
    cust1Orders.push(order1);
    expect(cust1Orders.length).toBe(1);
    em.attachEntity(order1);
    expect(order1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Unchanged);
    expect(order1.getProperty("customer")).toBe(cust1);
    const orderCustId = order1.getProperty(TestFns.wellKnownData.keyNames.customer);
    em.detachEntity(cust1);
    expect(cust1.entityAspect.entityState.isDetached());
    expect(order1.entityAspect.entityState.isUnchanged());
    const orderCustId2 = order1.getProperty(TestFns.wellKnownData.keyNames.customer);
    expect(orderCustId).toBe(orderCustId2);
  });


  test("graph attach (1-n) - piecewise", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");

    const order = orderType.createEntity();
    expect(order.entityAspect.entityState.isDetached()).toBe(true);

    order.setProperty("orderID", 888);

    em.attachEntity(order);
    const orderId = order.getProperty("orderID");
    expect(orderId);
    expect(order.entityAspect.entityState.isUnchanged()).toBe(true);
    for (let i = 0; i < 3; i++) {
      const od = orderDetailType.createEntity();
      od.setProperty("productID", i + 1); // part of pk && not the default value
      order.getProperty("orderDetails").push(od);
      expect(od.entityAspect.entityState.isAdded()).toBe(true);
      expect(od.getProperty("order")).toBe(order);
      expect(od.getProperty("orderID")).toBe(orderId);
    }
  });

  // TODO: will not yet work if both order and orderDetail keys are autogenerated.

  test("graph attach (1-n)- all together", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");

    const order = orderType.createEntity();
    expect(order.entityAspect.entityState.isDetached()).toBe(true);
    order.setProperty("orderID", 999);

    for (let i = 0; i < 3; i++) {
      const od = orderDetailType.createEntity();
      od.setProperty("productID", i + 1); // part of pk and not the default value
      order.getProperty("orderDetails").push(od);
      expect(od.entityAspect.entityState.isDetached()).toBe(true);
    }
    em.attachEntity(order);
    const orderId = order.getProperty("orderID");
    expect(orderId);
    expect(order.entityAspect.entityState.isUnchanged()).toBe(true);
    order.getProperty("orderDetails").forEach((od: Entity) => {
      expect(od.getProperty("order")).toBe(order);
      expect(od.getProperty("orderID")).toBe(orderId);
      expect(od.entityAspect.entityState.isUnchanged()).toBe(true);
    });
  });

  test("graph attach (1-n) - all together - autogenerated", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");

    const order = orderType.createEntity();
    expect(order.entityAspect.entityState.isDetached()).toBe(true);
    order.setProperty("orderID", 999);

    for (let i = 0; i < 3; i++) {
      const od = orderDetailType.createEntity();
      od.setProperty("productID", i); // part of pk
      order.getProperty("orderDetails").push(od);
      expect(od.entityAspect.entityState.isDetached()).toBe(true);
    }
    em.attachEntity(order);
    expect(order.entityAspect.entityState.isUnchanged()).toBe(true);
    const orderId = order.getProperty("orderID");
    expect(orderId);
    order.getProperty("orderDetails").forEach( (od: Entity) => {
      expect(od.getProperty("order")).toBe(order);
      expect(od.getProperty("orderID")).toBe(orderId);
      expect(od.entityAspect.entityState.isUnchanged()).toBe(true);
    });
  });

  // function createCustomer(em: EntityManager) {
  //   const custType = em.metadataStore.getAsEntityType("Customer");
  //   const cust = custType.createEntity();
  //   em.addEntity(cust);
  //   cust.setProperty("companyName", "TestXXX");
  //   return cust;
  // }
  

});

