import { EntityManager, EntityType, ComplexType, EntityState, EntityAction, EntityChangedEventArgs, breeze, MetadataStore, SaveOptions, QueryOptions, ValidationOptions, Entity, DataType, core, EntityKey, RelationArray, MergeStrategy, AnyAllPredicate, EntityQuery, QueryResult, StructuralType, EntityProperty, DataProperty, NavigationProperty, EntityAspect, PropertyChangedEventArgs } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { TestFns, JsonObj } from './test-fns';

ModelLibraryBackingStoreAdapter.register();

TestFns.initNonServerEnv();

describe("Entity operations - no server", () => {

  beforeEach(function () {
    TestFns.initSampleMetadataStore();
  });

  
  test("event token is the same for different entities", function () {
    const em = TestFns.newEntityManager();

    const emp1 = em.createEntity("Employee", { firstName: "Joe1", lastName: "Smith1", birthDate: new Date(2000, 1, 1) });
    const emp2 = em.createEntity("Employee", { firstName: "Joe2", lastName: "Smith2", birthDate: new Date(2000, 1, 1) });

    const token1 = emp1.entityAspect.propertyChanged.subscribe(function (changeArgs) {
      const a = changeArgs;
    });
    const token2 = emp2.entityAspect.propertyChanged.subscribe(function (changeArgs) {
      const a = changeArgs;
    });

    expect(token1).not.toBe(token2);
  });


  test("entityType.getProperty nested", function () {
    const odType = TestFns.sampleMetadataStore.getEntityType("OrderDetail");
    const orderType = TestFns.sampleMetadataStore.getEntityType("Order");

    const customerProp = odType.getProperty("order.customer");
    const customerProp2 = orderType.getProperty("customer");
    expect(customerProp).toBeTruthy();
    expect(customerProp).toBe(customerProp2);
    const prop1 = odType.getProperty("order.customer.companyName");
    const prop2 = orderType.getProperty("customer.companyName");
    expect(prop1).toBeTruthy();
    expect(prop1).toBe(prop2);
  });

  test("generate ids", function () {
    const orderType = TestFns.sampleMetadataStore.getAsEntityType("Order");
    const em = TestFns.newEntityManager();
    const count = 10;
    for (let i = 0; i < count; i++) {
      const ent = orderType.createEntity();
      em.addEntity(ent);
    }
    const tempKeys = em.keyGenerator.getTempKeys();
    expect(tempKeys.length).toBe(count);
    tempKeys.forEach(function (k) {
      expect(em.keyGenerator.isTempKey(k)).toBe(true);
    });
  });

  test("propertyChanged", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    expect(orderType).toBeTruthy();
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    expect(orderDetailType).toBeTruthy();
    const order = orderType.createEntity() as Entity;
    let lastProperty, lastOldValue, lastNewValue: any;
    order.entityAspect.propertyChanged.subscribe(function (args) {
      expect(args.entity).toBe(order);
      lastProperty = args.propertyName;
      lastOldValue = args.oldValue;
      lastNewValue = args.newValue;
    });
    const order2 = orderType.createEntity();

    order.setProperty("employeeID", 1);
    order2.setProperty("employeeID", 999); // should not raise event
    expect(lastProperty).toBe("employeeID");
    expect(lastNewValue).toBe(1);
    order.setProperty("freight", 123.34);
    expect(lastProperty).toBe("freight");
    expect(lastNewValue).toBe(123.34);
    order.setProperty("shippedDate", new Date(2000, 1, 1));
    expect(lastProperty).toBe("shippedDate");
    expect(lastNewValue!.toDateString()).toEqual(new Date(2000, 1, 1).toDateString());

    order.setProperty("employeeID", 2);
    expect(lastProperty).toBe("employeeID");
    expect(lastNewValue).toBe(2);
    expect(lastOldValue).toBe(1);
  });

  test("propertyChanged unsubscribe", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    expect(orderType);
    const order = orderType.createEntity() as Entity;
    let lastProperty, lastOldValue, lastNewValue;
    const key = order.entityAspect.propertyChanged.subscribe(function (args) {
      lastProperty = args.propertyName;
      lastOldValue = args.oldValue;
      lastNewValue = args.newValue;
    });
    order.setProperty(orderKeyName, TestFns.wellKnownData.dummyOrderID);
    expect(lastProperty).toBe(orderKeyName);
    expect(lastNewValue).toBe(TestFns.wellKnownData.dummyOrderID);
    order.entityAspect.propertyChanged.unsubscribe(key);
    order.setProperty("employeeID", TestFns.wellKnownData.dummyEmployeeID);
    expect(lastProperty).toBe(orderKeyName);
    expect(lastNewValue).toBe(TestFns.wellKnownData.dummyOrderID);
  });


  test("delete entity - check children", function () {
    const em = TestFns.newEntityManager();
    const order = createOrderAndDetails(em, true);
    const orderId = order.getProperty("orderID");
    const details = order.getProperty("orderDetails");
    const copyDetails = details.slice(0);
    expect(details.length).toBeGreaterThan(0);
    order.entityAspect.setDeleted();
    expect(order.entityAspect.entityState.isDeleted()).toBe(true);

    expect(details.length).toBe(0);

    copyDetails.forEach(function (od: Entity) {
      expect(od.getProperty("order")).toBeNull();
      expect(od.getProperty("orderID")).toBe(orderId);
      expect(od.entityAspect.entityState.isModified()).toBe(true);
    });
  });


  test("delete entity children then parent - check children", function () {
    const em = TestFns.newEntityManager();
    const order = createOrderAndDetails(em, true);
    const orderID = order.getProperty("orderID");
    const details = order.getProperty("orderDetails");
    const copyDetails = details.slice(0);
    expect(details.length).toBeGreaterThan(0);
    copyDetails.forEach(function (od: Entity) {
      od.entityAspect.setDeleted();
    });
    order.entityAspect.setDeleted();
    expect(order.entityAspect.entityState.isDeleted()).toBe(true);

    expect(details.length).toBe(0);

    copyDetails.forEach(function (od: Entity) {
      expect(od.getProperty("order")).toBeNull();
      expect(od.getProperty("orderID")).toBe(orderID);
      expect(od.entityAspect.entityState.isDeleted()).toBe(true);
    });
  });


  test("delete entity children then parent - check children (guid ids)", function () {
    const em = TestFns.newEntityManager();
    const customer = createCustomerAndOrders(em, true);
    const custID = customer.getProperty("customerID");
    const orders = customer.getProperty("orders");
    const copyOrders = orders.slice(0);
    expect(copyOrders.length).toBeGreaterThan(0);
    copyOrders.forEach(function (order: Entity) {
      order.entityAspect.setDeleted();
    });
    customer.entityAspect.setDeleted();
    expect(customer.entityAspect.entityState.isDeleted()).toBe(true);

    expect(orders.length).toBe(0);

    copyOrders.forEach(function (order: Entity) {
      expect(order.getProperty("customer")).toBeNull();
      expect(order.getProperty("customerID")).toBe(custID);
      expect(order.entityAspect.entityState.isDeleted()).toBe(true);
    });
  });


  test("delete entity - check parent", function () {
    const em = TestFns.newEntityManager();
    const order = createOrderAndDetails(em, true);
    const details = order.getProperty("orderDetails");
    const od = details[0];
    expect(details.indexOf(od) !== -1).toBe(true);
    const copyDetails = details.slice(0);
    expect(details.length).toBeGreaterThan(0);
    od.entityAspect.setDeleted();
    expect(od.entityAspect.entityState.isDeleted()).toBe(true);

    expect(details.length).toBe(copyDetails.length - 1);
    expect(details.indexOf(od)).toBe(-1);

    expect(od.getProperty("order")).toBeNull();
    const defaultOrderId = od.entityType.getProperty("orderID").defaultValue;
    // we deliberately leave the orderID alone after a delete - we are deleting the entity and do not want a 'mod' to cloud the issue
    // ( but we do 'detach' the Order itself.)
    expect(od.getProperty("orderID")).toBe(order.getProperty("orderID"));
  });


  test("detach entity - check children", function () {
    const em = TestFns.newEntityManager();
    const order = createOrderAndDetails(em);
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const orderId = order.getProperty(orderKeyName);
    const details = order.getProperty("orderDetails");
    const copyDetails = details.slice(0);
    expect(details.length).toBeGreaterThan(0);
    em.detachEntity(order);
    expect(order.entityAspect.entityState.isDetached()).toBe(true);

    expect(details.length).toBe(0);

    copyDetails.forEach(function (od: Entity) {
      expect(od.getProperty("order")).toBeNull();
      expect(od.getProperty(orderKeyName)).toBe(orderId);
      expect(od.entityAspect.entityState.isUnchanged()).toBe(true);
    });
  });

  test("getChanges", function () {
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
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


  test("hasChanges", function () {
    const em = TestFns.newEntityManager();

    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    const order1 = createOrderAndDetails(em, false);
    const order2 = createOrderAndDetails(em, false);

    let valid = em.hasChanges();
    expect(valid).toBe(true);
    try {
      const x = em.hasChanges("order");
      throw new Error('should not get here');
    } catch (e) {
      expect(e.message).toMatch(/order/);
    }
    valid = em.hasChanges("Order");
    expect(valid).toBe(true);
    try {
      const y = em.hasChanges(["Order", "OrderDetXXX"]);
      throw new Error('should not get here');
    } catch (e) {
      expect(e.message).toMatch(/OrderDetXXX/);
    }
    valid = em.hasChanges([orderType, orderDetailType]);
    expect(valid).toBe(true);
    em.getChanges(orderType).forEach(function (e) {
      e.entityAspect.acceptChanges();
    });
    valid = !em.hasChanges(orderType);
    expect(valid).toBe(true);
    valid = em.hasChanges("OrderDetail");
    expect(valid).toBe(true);
    em.getChanges(orderDetailType).forEach(function (e) {
      e.entityAspect.acceptChanges();
    });

    valid = !em.hasChanges(["Order", "OrderDetail"]);
    expect(valid).toBe(true);
    valid = !em.hasChanges();
    expect(valid).toBe(true);
  });

  test("hasChanges basic", function () {
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");

    let count = 0;
    em.hasChangesChanged.subscribe(args => {
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
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
    em.createEntity('Order');
    em.createEntity('Product', null, breeze.EntityState.Unchanged);
    // There are Order changes but there are no Product changes
    expect(em.hasChanges()).toBe(true);
    expect(em.hasChanges(['Order'])).toBe(true);
    expect(em.hasChanges(['Product'])).toBe(false);
  });

  // D#2663
  test("hasChanges is false when filter for a type that is not in cache", function () {
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
    em.createEntity('Order');
    // While 'Product' is a defined type, there are no Products in cache this time.
    // There are changes but there are no Product changes
    const hasChanges = em.hasChanges();
    expect(em.hasChanges()).toBe(true);
    expect(em.hasChanges(['Product'])).toBe(false);
  });

  test("hasChanges throws error when filter for a type that doesn't exist", function () {
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
    em.createEntity('Order');

    expect(em.hasChanges()).toBe(true);
    // There are changes but there is no 'Foo' type
    expect(function () {
      em.hasChanges(['Foo']);
    }).toThrow(/unable to locate a 'Type'/i);
  });

  test("hasChanges with em.acceptChanges", function () {
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
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
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
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
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    const custType = em.metadataStore.getAsEntityType("Customer");

    let changedArgs: any[] = [];
    let lastArgs: EntityChangedEventArgs, lastAction, lastEntity;
    em.entityChanged.subscribe(args => {
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

  test("entityChanged event on multiple setDeleted calls", function () {
    const em = TestFns.newEntityManager();
    const entity1 = em.createEntity("Customer");
    const entity2 = em.createEntity("Customer");
    const entity3 = em.createEntity("Customer");
    const entity4 = em.createEntity("Customer");
    entity1.entityAspect.acceptChanges();
    entity2.entityAspect.acceptChanges();
    entity3.entityAspect.acceptChanges();
    entity4.entityAspect.acceptChanges();
    let changedCount = 0;
    em.entityChanged.subscribe(function (changeArgs) {
      changedCount++;
    });
    entity1.entityAspect.setDeleted();
    // entityChanged is called on the manager, where entityAction === EntityStateChange - all good.
    expect(changedCount).toBe(1);
    entity2.entityAspect.setDeleted();
    expect(changedCount).toBe(2);
    // entityChanged event no longer fired on the manager.
    entity3.entityAspect.setDeleted();
    expect(changedCount).toBe(3);
    // same problem
    entity4.entityAspect.setDeleted();
    expect(changedCount).toBe(4);
  });

  test("entityChanged event and hasChanges interop", function () {
    const em = TestFns.newEntityManager();

    const emp = em.createEntity("Employee", { firstName: "Joe", lastName: "Smith", birthDate: new Date(2000, 1, 1) });
    emp.entityAspect.acceptChanges();
    em.entityChanged.subscribe(function (args) {
      const hasChanges = em.hasChanges();
      expect(hasChanges).toBe(true);
    });
    emp.setProperty("firstName", "test");
    expect(em.hasChanges());
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
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
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
    const em = TestFns.newEntityManager(TestFns.sampleMetadataStore);
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


  test("rejectChanges", function () {
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    const order1 = createOrderAndDetails(em, false);
    const order2 = createOrderAndDetails(em, false);

    let valid = em.hasChanges();
    expect(valid).toBe(true);
    valid = em.hasChanges(orderType);
    expect(valid).toBe(true);
    valid = em.hasChanges([orderType, orderDetailType]);
    expect(valid).toBe(true);
    em.getChanges(orderType).forEach(function (e) {
      e.entityAspect.acceptChanges();
      e.setProperty("freight", 100);
      expect(e.entityAspect.entityState.isModified()).toBe(true);
    });
    const rejects = em.rejectChanges();
    expect(rejects.length).toBeGreaterThan(0);
    let hasChanges = em.hasChanges(orderType);
    expect(hasChanges).toBe(false);
    hasChanges = em.hasChanges(orderDetailType);
    expect(hasChanges).toBe(false);

    valid = !em.hasChanges();
    expect(valid).toBe(true);
  });

  test("rejectChanges notification", function () {
    //1) attach propertyChangedHandler to an existing entity
    //2) modify entity (handler hears it, and reports that the entity is "Modified")
    //3) entity.entityAspect.rejectChanges()
    //4) handler hears it ... but reports "Modified" rather than "Unchanged"
    const em = TestFns.newEntityManager();

    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const order = orderType.createEntity() as Entity;
    order.setProperty(orderKeyName, 1);
    em.attachEntity(order);
    let count = 0;
    let lastArgs: PropertyChangedEventArgs;

    order.entityAspect.propertyChanged.subscribe(function (args) {
      count++;
      lastArgs = args;
    });
    order.setProperty("freight", 55.55);
    expect(count).toBe(1);
    expect(lastArgs.entity).toBe(order);
    expect(lastArgs.propertyName).toBe("freight");
    expect(lastArgs.entity.entityAspect.entityState.isModified()).toBe(true);
    order.entityAspect.rejectChanges();
    expect(count).toBe(2);
    expect(lastArgs.entity).toBe(order);
    expect(lastArgs.propertyName).toBeNull();
    expect(lastArgs.entity.entityAspect.entityState.isUnchanged()).toBe(true);
  });

  test("rejectChanges on unmapped property", function () {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Customer = TestFns.getCustomerCtor();
    em1.metadataStore.registerEntityTypeCtor("Customer", Customer);

    const custType = em1.metadataStore.getAsEntityType("Customer");
    const cust = custType.createEntity();
    em1.addEntity(cust);
    cust.setProperty("companyName", "foo2");
    cust.setProperty("miscData", "zzz");
    cust.entityAspect.acceptChanges();
    cust.setProperty("miscData", "xxx");
    cust.entityAspect.rejectChanges();
    const miscData = cust.getProperty("miscData");
    expect(miscData).toBe('zzz');
  });

  test("rejectChanges with ES5 props", function () {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Customer = TestFns.getCustomerWithES5PropsCtor();
    em1.metadataStore.registerEntityTypeCtor("Customer", Customer);

    const custType = em1.metadataStore.getAsEntityType("Customer");
    const cust = custType.createEntity();
    em1.addEntity(cust);
    cust.setProperty("companyName", "foo2");
    let companyName = cust.getProperty("companyName");
    expect(companyName).toBe("FOO2");
    cust.entityAspect.acceptChanges();
    cust.setProperty("companyName", "foo3");
    companyName = cust.getProperty("companyName");
    expect(companyName).toBe("FOO3");
    cust.entityAspect.rejectChanges();
    companyName = cust.getProperty("companyName");
    expect(companyName).toBe('FOO2');
  });


  test("rejectChanges of a child entity restores it to its parent", function () {
    const em = TestFns.newEntityManager();

    const orderType = em.metadataStore.getAsEntityType("Order");
    const parent = orderType.createEntity();
    parent.setProperty("orderID", 1);
    em.attachEntity(parent);

    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    const child = orderDetailType.createEntity();
    child.setProperty("orderID", 42);
    child.setProperty("order", parent); // adds child to parent's manager
    child.entityAspect.setUnchanged();

    // parent and child are now unchanged ... as if freshly queried
    expect(em.hasChanges()).toBe(false);
    child.entityAspect.setDeleted();

    // child should still have the parent's FK Id after delete
    expect(parent.getProperty("orderID")).toBe(child.getProperty("orderID"));
    expect(child.getProperty("order")).toBeNull();
    // parent should no longer have the child after child delete
    expect(parent.getProperty("orderDetails").length).toBe(0);
    em.rejectChanges();

    expect(em.hasChanges()).toBe(false);
    expect(parent.getProperty("orderID")).toBe(child.getProperty("orderID"));
    expect(parent).toBe(child.getProperty("order"));
    expect(parent.getProperty("orderDetails")[0]).toBe(child);
  });

  test("rejectChanges of a child entity restores it to its parent - v2", function () {
    const em = TestFns.newEntityManager();

    const parent = em.createEntity("Customer", { customerID: breeze.core.getUuid(), companyName: "Test 111" });
    parent.entityAspect.acceptChanges();

    const child = em.createEntity("Order", { orderID: 1 });
    child.setProperty("customerID", parent.getProperty("customerID"));
    child.entityAspect.acceptChanges();
    // parent and child are now unchanged ... as if freshly queried

    expect(child.getProperty("customer")).toBe(parent);
    expect(em.hasChanges()).toBe(false);

    child.entityAspect.setDeleted();

    expect(parent.getProperty("customerID")).toBe(child.getProperty("customerID"));
    expect(child.getProperty("customer")).toBeNull();
    expect(parent.getProperty("orders").length).toBe(0);

    em.rejectChanges();

    expect(em.hasChanges()).toBe(false);
    expect(parent.getProperty("customerID")).toBe(child.getProperty("customerID"));
    expect(parent).toBe(child.getProperty("customer"));
    expect(parent.getProperty("orders")[0]).toBe(child);
  });


  test("rejectChanges with boolean values", () => {
    const em = TestFns.newEntityManager();
    const propName = "isDiscontinued"; // 'discontinued'
    const emp1 = em.createEntity("Product", null, EntityState.Detached);
    emp1.setProperty(propName, false);
    em.attachEntity(emp1);
    emp1.setProperty(propName, true);
    emp1.setProperty(propName, false);
    emp1.entityAspect.rejectChanges();
    const dc = emp1.getProperty(propName);
    expect(dc).toBe(false);

  });

  test("detached entity - setting another EntityState on a detached entity throws exception",
    () => {
      const em = TestFns.newEntityManager(); // new empty EntityManager
      const order = em.createEntity('Order', { OrderID: 1 });

      const aspect = order.entityAspect;

      aspect.setDetached();
      expect(aspect.entityState.isDetached()).toBeTruthy();

      expect(() => aspect.setDeleted()).toThrow(/detached/);
      expect(() => aspect.setModified()).toThrow(/detached/);
      expect(() => aspect.setUnchanged()).toThrow(/detached/);
    }
  );

  test("detached entity retains its foreign keys", () => {
    const em = TestFns.newEntityManager();
    const cust = em.createEntity("Customer", { companyName: "TestXXX" });
    const emp = em.createEntity("Employee", { firstName: "John", lastName: "Smith" });
    const order = em.createEntity('Order', {
      orderID: 1,
      customer: cust,
      employee: emp
    });

    // Pre-detach asserts
    expect(order.getProperty('customerID')).toBe(cust.getProperty('customerID'));
    expect(order.getProperty('employeeID')).toBe(emp.getProperty('employeeID'));
    expect(order.getProperty('customer')).toBe(cust);
    expect(order.getProperty('employee')).toBe(emp);

    order.entityAspect.setDetached();

    // Post-detach asserts
    expect(order.getProperty('customerID')).toBe(cust.getProperty('customerID'));
    expect(order.getProperty('employeeID')).toBe(emp.getProperty('employeeID'));
    expect(order.getProperty('customer')).toBe(null);
    expect(order.getProperty('employee')).toBe(null);
    expect(order.entityAspect.originalValues).toEqual({});
  });

  test("acceptChanges - detach deleted", function () {
    const em = TestFns.newEntityManager(); // new empty EntityManager
    const empType = em.metadataStore.getAsEntityType("Employee");
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;

    const employee = empType.createEntity(); // created but not attached
    employee.setProperty(employeeKeyName, 42);
    em.attachEntity(employee); // simulate existing employee

    employee.entityAspect.setDeleted();
    employee.entityAspect.acceptChanges(); // simulate post-save state
    //em.acceptChanges(); // this works too ... for all changed entities in cache

    expect(employee.entityAspect.entityState.isDetached()).toBe(true);
  });



  function createOrderAndDetails(em: EntityManager, shouldAttachUnchanged: boolean = true) {

    const metadataStore = em.metadataStore;
    const orderType = em.metadataStore.getAsEntityType("Order");
    const orderDetailType = em.metadataStore.getAsEntityType("OrderDetail");
    const order = em.createEntity(orderType);

    expect(order.entityAspect.entityState.isAdded()).toBe(true);
    for (let i = 0; i < 3; i++) {
      const od = orderDetailType.createEntity();
      od.setProperty("productID", i + 1); // part of pk
      order.getProperty("orderDetails").push(od);
      expect(od.entityAspect.entityState.isAdded()).toBe(true);
    }
    const orderId = order.getProperty("orderID");
    expect(orderId).not.toBe(0);
    if (shouldAttachUnchanged) {
      order.entityAspect.acceptChanges();
      order.getProperty("orderDetails").forEach(function (od: Entity) {
        od.entityAspect.acceptChanges();
        expect(od.getProperty("order")).toBe(order);
        expect(od.getProperty("orderID")).toBe(orderId);
        expect(od.entityAspect.entityState.isUnchanged()).toBe(true);
      });
    } else {
      order.getProperty("orderDetails").forEach(function (od: Entity) {
        expect(od.getProperty("order")).toBe(order);
        expect(od.getProperty("orderID")).toBe(orderId);
        expect(od.entityAspect.entityState.isAdded()).toBe(true);
      });
    }
    return order;
  }

  function createCustomerAndOrders(em: EntityManager, shouldAttachUnchanged: boolean = true, orderCount: number = 3) {
    const metadataStore = em.metadataStore;
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");

    const customer = em.createEntity(customerType);
    expect(customer.entityAspect.entityState.isAdded()).toBe(true);
    for (let i = 0; i < orderCount; i++) {
      const order = em.createEntity(orderType);
      customer.getProperty("orders").push(order);
      expect(order.entityAspect.entityState.isAdded()).toBe(true);
    }

    if (shouldAttachUnchanged) {
      customer.entityAspect.acceptChanges();
      const custId = customer.getProperty("customerID");
      customer.getProperty("orders").forEach((order: Entity) => {
        order.entityAspect.acceptChanges();
        expect(order.getProperty("customer")).toBe(customer);
        expect(order.getProperty("customerID")).toBe(custId);
        expect(order.entityAspect.entityState.isUnchanged()).toBe(true);
      });
    } else {
      const custId = customer.getProperty("customerID");
      customer.getProperty("orders").forEach((order: Entity) => {
        expect(order.getProperty("customer")).toBe(customer);
        expect(order.getProperty("customerID")).toBe(custId);
        expect(order.entityAspect.entityState.isAdded()).toBe(true);
      });
    }
    return customer;
  }

});