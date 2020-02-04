import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy, EntityState, EntityKey, core, RelationArray, DataType, EntityManager } from 'breeze-client';
import { TestFns } from './test-fns';
import { ObservableArrayChangedArgs } from 'src/observable-array';
import { PropertyChangedEventArgs } from 'src/entity-aspect';

TestFns.initNonServerEnv();


beforeAll( () => {
  TestFns.initSampleMetadataStore();

});

describe("Entity Attach", () => {
  let testContext: any;

  beforeEach(() => {
    testContext = {};
  });

  test("setting another EntityState on a detached entity throws exception",
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

  test("infer unmapped boolean datatype", () => {
    const em = TestFns.newEntityManager();
    const Customer = function () {
      testContext.isBeingEdited = false;
    };
    em.metadataStore.registerEntityTypeCtor("Customer", Customer);

    const customerType = em.metadataStore.getAsEntityType("Customer");
    const unmapped = customerType.unmappedProperties[0];
    expect(unmapped.dataType).toBe(DataType.Boolean);
  });

  test("boolean reject changes", () => {
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

  function createCustomer(em: EntityManager) {
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust = custType.createEntity();
    em.addEntity(cust);
    cust.setProperty("companyName", "TestXXX");
    return cust;
  }

  test("createEntity", () => {
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee");
    expect(emp1.entityAspect.entityState).toBe(EntityState.Added);

    const emp2 = em.createEntity("Employee", { firstName: "John", lastName: "Smith" });
    expect(emp2.entityAspect.entityState).toBe(EntityState.Added);

    const emp3 = em.createEntity("Employee", { firstName: "John", lastName: "Smith" }, EntityState.Detached);
    expect(emp3.entityAspect.entityState).toBe(EntityState.Detached);
    expect(emp3.getProperty("lastName")).toBe("Smith");
  });

  test("store-managed int ID remains '0' after attachEntity", () => {
    const em = TestFns.newEntityManager();
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;
    const employeeType = em.metadataStore.getAsEntityType("Employee");
    const empIdProp = employeeType.getProperty(employeeKeyName);

    const defaultValue = 0;
    const emp = employeeType.createEntity();
    expect(emp.getProperty(employeeKeyName)).toBe(defaultValue);
    const agkType = employeeType.autoGeneratedKeyType;
    // manager should NOT replace '0' with generated temp id
    em.attachEntity(emp);
    const id = emp.getProperty(employeeKeyName);
    expect(id).toBe(defaultValue);
  });


  test("disallow setting collection navigation properties", () => {

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

  test("cannot attach an entity created by a different metadataStore", () => {
    const em = TestFns.newEntityManager();
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const customer = customerType.createEntity();
    const newMs = MetadataStore.importMetadata(em.metadataStore.exportMetadata());
    const em2 = TestFns.newEntityManager(newMs);
    try {
      em2.attachEntity(customer);
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message).toMatch(/MetadataStore/);
    }

  });

  test(
    "can attach a detached entity to a different manager via attach/detach",
    () => {
      const em = TestFns.newEntityManager();
      const customerType = em.metadataStore.getAsEntityType("Customer");
      const customer = customerType.createEntity();
      const orderType = em.metadataStore.getAsEntityType("Order");
      const order = orderType.createEntity();
      em.attachEntity(customer);
      const orders = customer.getProperty("orders");
      expect(orders.length).toBe(0);
      orders.push(order);
      const em2 = TestFns.newEntityManager();
      em.detachEntity(customer);
      em2.attachEntity(customer);
      expect(customer.entityAspect.entityManager).toBe(em2);
    }
  );

  test(
    "can attach a detached entity to a different manager via clear",
    () => {
      const em1 = TestFns.newEntityManager();
      const cust = em1.metadataStore.getAsEntityType("Customer").createEntity() as Entity;
      cust.setProperty(TestFns.wellKnownData.keyNames.customer, core.getUuid());

      em1.attachEntity(cust);

      em1.clear(); // should detach cust
      expect(cust.entityAspect.entityState.isDetached()).toBe(true);

      // therefore this should be ok
      const em2 = TestFns.newEntityManager();
      em2.attachEntity(cust); // D#2206 throws exception
    }
  );


  test("setting child's parent entity null removes it from old parent", () => {
    // D2183
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


  test("unidirectional attach - n->1", () => {
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
  test("unidirectional attach - 1->n", () => {
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
  test("unidirectional attach - 1->n - part 2", () => {
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

  test("primary key fixup", () => {
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



  test("post create init 1", () => {
    const em = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Product = createProductCtor();
    const productType = em.metadataStore.getAsEntityType("Product");
    em.metadataStore.registerEntityTypeCtor("Product", Product, function (entity: Entity) {
      expect(entity.entityType).toBe(productType);
      expect(entity.getProperty("isObsolete")).toBe(false);
      entity.setProperty("isObsolete", true);
    });

    const product = productType.createEntity();
    expect(product.getProperty("isObsolete")).toBe(true);

    product.setProperty("isObsolete", false);
    expect(product.getProperty("isObsolete")).toBe(false);
  });

  test("post create init 2", () => {
    const em = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Product = createProductCtor();

    const productType = em.metadataStore.getAsEntityType("Product");
    em.metadataStore.registerEntityTypeCtor("Product", Product, "init");

    const product = productType.createEntity();
    expect(product.getProperty("isObsolete")).toBe(true);
  });

  test("post create init 3", () => {
    const em = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Product = createProductCtor();
    const productType = em.metadataStore.getAsEntityType("Product");
    em.metadataStore.registerEntityTypeCtor("Product", Product, "init");

    const product = productType.createEntity();
    expect(product.getProperty("isObsolete")).toBe(true);
  });

  test("post create init after new and attach", () => {
    const em = TestFns.newEntityManager(MetadataStore.importMetadata(TestFns.sampleMetadata));
    const Product = createProductCtor() as any;
    const product = new Product();
    const productType = em.metadataStore.getAsEntityType("Product");
    em.metadataStore.registerEntityTypeCtor("Product", Product, "init");
    em.attachEntity(product);

    expect(product.getProperty("isObsolete")).toBe(true);
  });

  test("changing FK to null removes it from old parent", () => {
    // D2183
    const em = TestFns.newEntityManager();
    const customerType = em.metadataStore.getAsEntityType("Customer");
    const customer = customerType.createEntity();
    em.attachEntity(customer);

    //const orderType = em.metadataStore.getAsEntityType("Order");
    //const newOrder = orderType.createEntity();
    //em.addEntity(newOrder);
    // newOrder.setProperty("customer", customer); // assign order to customer1
    const newOrder = em.createEntity("Order", { customer: customer });

    expect(customer.getProperty("orders").indexOf(newOrder) >= 0).toBe(true);

    newOrder.setProperty("customerID", null);
    expect(customer.getProperty("orders").indexOf(newOrder)).toBe(-1);
  });


  test("add, detach and readd", () => {
    // D2182
    const em = TestFns.newEntityManager();
    const newOrder = em.createEntity("Order");

    em.detachEntity(newOrder);
    em.addEntity(newOrder); // Exception thrown: "this key is already attached"
  });


  test("attach, detach, reattach", () => {
    // D2182
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const order = orderType.createEntity();
    em.attachEntity(order);

    em.detachEntity(order);
    em.attachEntity(order); // Exception thrown: "this key is already attached"
  });


  test("exception if set nav to entity with different manager", () => {
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


  test("attach across entityManagers", () => {
    const em1 = TestFns.newEntityManager();
    const custType = em1.metadataStore.getAsEntityType("Customer");
    const cust = custType.createEntity();
    em1.attachEntity(cust);
    const em2 = TestFns.newEntityManager();
    expect(() => em2.attachEntity(cust)).toThrow(/EntityManager/);
  });

  test("rejectChanges on added entity", () => {
    const em = TestFns.newEntityManager();
    const newEntity = em.createEntity("Order");

    let entityState = newEntity.entityAspect.entityState;
    expect(entityState.isAdded()).toBe(true);

    newEntity.entityAspect.rejectChanges();

    entityState = newEntity.entityAspect.entityState;
    expect(entityState.isDetached()).toBe(true);

    expect(em.hasChanges()).toBe(false);

    const inCache = em.getEntities(), count = inCache.length;
    expect(count).toBe(0);

  });

  test("delete added entity", () => {
    const em = TestFns.newEntityManager();
    const typeInfo = em.metadataStore.getAsEntityType("Order");

    const newEntity = em.createEntity(typeInfo);
    expect(newEntity.entityAspect.entityState.isAdded()).toBe(true);

    newEntity.entityAspect.setDeleted();
    expect(newEntity.entityAspect.entityState.isDetached()).toBe(true);

    // get the first (and only) entity in cache
    expect(em.getEntities().length).toBe(0);

  });


  test("add entity - no key", function () {

    const em = TestFns.newEntityManager();
    const odType = em.metadataStore.getAsEntityType("OrderDetail");
    const od = odType.createEntity();
    expect(() => em.addEntity(od)).toThrow(/key/);
    expect(() => em.generateTempKeyValue(od)).toThrow(/multipart keys/);

    // only need to set part of the key
    od.setProperty("orderID", 999);
    em.addEntity(od);
    expect(true).toBe(true);
  });


  test("add entity - no key 2", function () {

    const em = TestFns.newEntityManager();

    expect(() => em.createEntity("OrderDetail")).toThrow(/key/);

    const od = em.createEntity("OrderDetail", null, EntityState.Detached);
    expect(() => em.generateTempKeyValue(od)).toThrow(/multipart keys/);

    // only need to set part of the key
    od.setProperty("orderID", 999);
    em.addEntity(od);
    expect(true).toBe(true);
  });


  test("add child", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();

    em.addEntity(cust1);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Added);
    expect(cust1.entityAspect.hasTempKey).toBe(true);
    const orders = cust1.getProperty("orders") as RelationArray;

    let changeArgs: ObservableArrayChangedArgs = null;
    orders.arrayChanged.subscribe((args) => {
      changeArgs = args;
    });
    orders.push(order1);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Added);
    expect(order1.entityAspect.entityState).toBe(EntityState.Added);
    expect(orders.parentEntity).toBe(cust1);
    const navProperty = cust1.entityType.getProperty("orders");
    expect(orders.navigationProperty).toBe(navProperty);
    expect(changeArgs.added).toBeTruthy();
    expect(changeArgs.added[0]).toBe(order1);
    const sameCust = order1.getProperty("customer");
    expect(sameCust).toBe(cust1);

  });

  test("detach child", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity();
    const order2 = orderType.createEntity() as Entity;

    em.addEntity(cust1);
    expect(cust1.entityAspect.entityState).toBe(EntityState.Added);
    const orders = cust1.getProperty("orders") as RelationArray;
    orders.push(order1);
    orders.push(order2);
    let arrayChangeCount = 0;
    orders.arrayChanged.subscribe(function (args) {
      arrayChangeCount += 1;
      expect(args.removed[0]).toBe(order2);
    });
    let order2ChangeCount = 0;
    order2.entityAspect.propertyChanged.subscribe(function (args2) {
      expect(args2.entity).toBe(order2);
      if (args2.propertyName === "customer") {
        order2ChangeCount += 1;
      } else if (args2.propertyName === "customerID") {
        order2ChangeCount += 1;
      } else {
        throw new Error("should not have gotten here");
      }
    });
    const orders2 = cust1.getProperty("orders");
    expect(orders).toBe(orders2);
    const ix = (orders as any).indexOf(order2);
    orders.splice(ix, 1);
    expect(orders.length).toBe(1);
    expect(arrayChangeCount).toBe(1);
    expect(order2ChangeCount).toBe(2);

    const sameCust = order2.getProperty("customer");
    expect(sameCust).toBeNull;
  });

  test("add parent", () => {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const orderType = em.metadataStore.getAsEntityType("Order");
    const cust1 = custType.createEntity();
    const order1 = orderType.createEntity() as Entity;


    em.addEntity(order1);
    expect(order1.entityAspect.entityState.isAdded()).toBe(true);
    const emptyCust = order1.getProperty("customer");
    expect(!emptyCust);
    let changeArgs: PropertyChangedEventArgs = null;
    order1.entityAspect.propertyChanged.subscribe((args) => {
      changeArgs = args;
    });
    order1.setProperty("customer", cust1);
    expect(order1.entityAspect.entityState.isAdded()).toBe(true);
    expect(cust1.entityAspect.entityState.isAdded()).toBe(true);
    expect(changeArgs).toBeTruthy();
    expect(changeArgs.propertyName).toBe("customer");
    expect(changeArgs.newValue).toBe(cust1);
    expect(changeArgs.oldValue).toBeNull;
    const orders = cust1.getProperty("orders");
    expect(orders[0]).toBe(order1);

  });

  test("change parent (1-n)", () => {
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

  test("change child (1-n)", () => {
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


  test("duplicate entity keys", () => {
    const em = TestFns.newEntityManager();

    const cust1 = em.createEntity("Customer", null, EntityState.Detached);
    const cust2 = em.createEntity("Customer", null, EntityState.Detached);
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    em.attachEntity(cust1);
    try {
      const cust1Id = cust1.getProperty(customerKeyName);
      cust2.setProperty(customerKeyName, cust1Id);
      em.attachEntity(cust2);
      throw new Error('should not get here');
    } catch (e) {
      expect(e.message).toMatch(/key/);
    }

  });

  test("fk fixup - fk to nav - attached", () => {
    const em = TestFns.newEntityManager();
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    const cust1 = em.createEntity("Customer", null, EntityState.Detached);
    const cust2 = em.createEntity("Customer", null, EntityState.Detached);
    const order1 = em.createEntity("Order", null, EntityState.Detached);

    em.attachEntity(order1);
    em.attachEntity(cust1);
    const custIdValue = cust1.getProperty(customerKeyName);
    order1.setProperty("customerID", custIdValue);
    const orderCustomer = order1.getProperty("customer");
    expect(orderCustomer).toBe(cust1);

  });

  test("fk fixup - nav to fk - attached", () => {
    const em = TestFns.newEntityManager();
    const customerKeyName = TestFns.wellKnownData.keyNames.customer;
    const cust1 = em.createEntity("Customer", null, EntityState.Detached);
    const cust2 = em.createEntity("Customer", null, EntityState.Detached);
    const orderType = em.metadataStore.getAsEntityType("Order");
    const order1 = em.createEntity(orderType, null, EntityState.Detached);

    em.attachEntity(order1);
    em.attachEntity(cust1);

    order1.setProperty("customer", cust1);
    const orderCustId = order1.getProperty("customerID");
    const custId = cust1.getProperty(customerKeyName);
    expect(orderCustId).toBe(custId);

  });

  test("fk fixup - unattached children", () => {
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

  test("fk fixup - unattached parent pushes attached child", () => {
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

  test("recursive navigation fixup", () => {
    const em = TestFns.newEntityManager();
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;
    const empType = em.metadataStore.getAsEntityType("Employee");
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

  function createProductCtor() {
    const init = function (entity: Entity) {
      expect(entity.entityType.shortName).toBe("Product");
      expect(entity.getProperty("isObsolete")).toBe(false);
      entity.setProperty("isObsolete", true);
    };
    return function () {
      this.isObsolete = false;
      this.init = init;
    };

  }
});