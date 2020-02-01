import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, EntityState } from 'breeze-client';
import { TestFns, skipTestIf } from './test-fns';

const metadata = require('./support/NorthwindIBMetadata.json');

TestFns.initServerEnv();

beforeAll(async () => {
  // MetadataStore.importMetadata(metadata);
  await TestFns.initDefaultMetadataStore();

});

describe("Old Fixed Bugs", () => {

  beforeEach(function () {

  });

  test("bug where we throw when add where clause to query with a `.fromEntityType` value", async () => {
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers");
    await TestFns.initDefaultMetadataStore(); // needed because a local query need to have an ms
    // Don't care about the query result.
    // Just want the `fromEntityType` property to set as a side effect or execution
    em.executeQueryLocally(query);
    // now we can repro the bug reported in https://github.com/Breeze/breeze.js/issues/44
    // This next statement throws the "undefined is not a function" exception in 1.5.1
    const q2 = query.where('city', 'eq', 'London');

    const qr = await em.executeQuery(q2);
    expect(qr.results.length).toBeGreaterThan(0);
    expect.assertions(1);
  });

  test("bug in local cache query for all Suppliers in region 'Papa'", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager(); // creates a new EntityManager configured with metadata
    const query = new breeze.EntityQuery("Suppliers");
    const data = await em.executeQuery(query);
    
    const count = data.results.length;
    expect(count).toBeGreaterThan(0);

    const predicate = breeze.Predicate.create(TestFns.wellKnownData.keyNames.supplier, '==', 0)
      .or('companyName', '==', 'Papa');

    const localQuery = breeze.EntityQuery
      .from('Suppliers')
      .where(predicate)
      .toType('Supplier');

    const suppliers = em.executeQueryLocally(localQuery);
    // Defect #2486 Fails with "Invalid ISO8601 duration 'Papa'"
    expect(suppliers.length).toBe(0);
  
  });

  test("bug with expand not working with paging or inlinecount", async () => {

    const em1 = TestFns.newEntityManager();
    const predicate = Predicate.create(TestFns.wellKnownData.keyNames.order, "<", 10500);

    const query = new EntityQuery()
      .from("Orders")
      .expand("orderDetails, orderDetails.product")
      .where(predicate)
      .inlineCount()
      .orderBy("orderDate")
      .take(2)
      .skip(1)
      .using(em1);
    const qr1 = await query.execute();

    expect(qr1.results.length).toBeGreaterThan(0);
    expect(qr1.inlineCount).toBeGreaterThan(0);

    // For ODATA this is a known bug: https://aspnetwebstack.codeplex.com/workitem/1037
    // having to do with mixing expand and inlineCount
    // it sounds like it might already be fixed in the next major release but not yet avail.
    const localQuery = EntityQuery.from('OrderDetails');
    const orderDetails = em1.executeQueryLocally(localQuery);
    expect(orderDetails.length).toBeGreaterThan(0);

    const localQuery2 = EntityQuery.from('Products');
    const products = em1.executeQueryLocally(localQuery2);
    expect(products.length).toBeGreaterThan(0);

  });

  test("bug with local cache query for all Suppliers in fax 'Papa'", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = new breeze.EntityQuery("Suppliers");
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    const predicate = Predicate.create(TestFns.wellKnownData.keyNames.supplier, '==', 0)
      .or('fax', '==', 'Papa');
    const localQuery = EntityQuery
      .from('Suppliers')
      .where(predicate)
      .toType('Supplier');

    const suppliers = em1.executeQueryLocally(localQuery);
    // Defect #2486 Fails with "Invalid ISO8601 duration 'Papa'"
    expect(suppliers.length).toBe(0);

  });

  // no expand support in Mongo
  skipTestIf(TestFns.isMongoServer)
    ("bug with detached unresolved children", async () => {
      expect.hasAssertions();
      const em1 = TestFns.newEntityManager();
      const metadataStore = em1.metadataStore;
      const orderType = metadataStore.getEntityType("Order") as EntityType;

      const query = EntityQuery.from("Customers")
        .where("customerID", "==", "729de505-ea6d-4cdf-89f6-0360ad37bde7")
        .expand("orders");
      let newOrder = orderType.createEntity(); // call the factory function for the Customer type
      em1.addEntity(newOrder);
      newOrder.setProperty("customerID", "729de505-ea6d-4cdf-89f6-0360ad37bde7");

      let items = em1.rejectChanges();

      const qr1 = await em1.executeQuery(query);
      let orders = qr1.results[0].getProperty("orders");
      // the bug was that this included the previously detached order above. ( making a length of 11).
      expect(orders.length).toBe(10);

      newOrder = orderType.createEntity(); // call the factory function for the Customer type
      em1.addEntity(newOrder);
      newOrder.setProperty("customerID", "729de505-ea6d-4cdf-89f6-0360ad37bde7");

      items = em1.rejectChanges();
      const qr2 = await em1.executeQuery(query);
      orders = qr2.results[0].getProperty("orders");
      expect(orders.length).toBe(10);
    });

  skipTestIf(TestFns.isMongoServer)("bug with duplicates after relation query", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    em1.queryOptions = em1.queryOptions.using(MergeStrategy.OverwriteChanges);
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
      .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID);
    // bug goes away if you add this.
    // .expand("orders");

    const qr1 = await query.using(em1).execute();
    const customer = qr1.results[0];
    const q2 = EntityQuery.from("Orders")
      .where("customerID", "==", alfredsID)
      .expand("customer"); // bug goes away if you remove this
    await q2.using(em1).execute();

    expect(em1.hasChanges()).toBe(false);
    expect(em1.getChanges().length).toBe(0);
    const details = customer.getProperty("orders");
    const dups = TestFns.getDups(details);
    expect(dups.length).toBe(0);
  });

  test("bug where we fill placeholder customer asynchronously", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const custType = em1.metadataStore.getEntityType("Customer") as EntityType;
    const custKeyName = TestFns.wellKnownData.keyNames.customer;
    const customer = custType.createEntity();
    customer.setProperty("companyName", "[don't know name yet]");
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    // TEST PASSES (NO DUPLICATE) IF SET ID HERE ... BEFORE ATTACH
    // customer.CustomerID(testFns.wellKnownData.alfredsID); // 785efa04-cbf2-4dd7-a7de-083ee17b6ad2

    em1.attachEntity(customer);

    // TEST FAILS  (2 IN CACHE W/ SAME ID) ... CHANGING THE ID AFTER ATTACH
    customer.setProperty(custKeyName, alfredsID); // 785efa04-cbf2-4dd7-a7de-083ee17b6ad2
    const ek = customer.entityAspect.getKey();
    const sameCustomer = em1.getEntityByKey(ek);
    customer.entityAspect.setUnchanged();

    // SHOULD BE THE SAME. EITHER WAY ITS AN ATTACHED UNCHANGED ENTITY
    expect(customer.entityAspect.entityState.isUnchanged()).toBe(true);
    expect(em1.getEntities().length).toBe(1);

    // this refresh query will fill the customer values from remote storage
    const refreshQuery = breeze.EntityQuery.fromEntities(customer);
    const qr1 = await refreshQuery.using(em1).execute();
    const results = qr1.results, count = results.length;
    expect(count).toBe(1);
    
    const inCache = em1.getEntities();
    if (inCache.length === 2) {
      const c1 = inCache[0], c2 = inCache[1];
      throw new Error("Two custs in cache with same ID");
      // "Two custs in cache with same ID, ({0})-{1} and ({2})-{3}".format(// format is my extension to String
      //   c1.getProperty(custKeyName), c1.getProperty("companyName"), c2.getProperty(custKeyName), c2.getProperty("companyName")));
    }

    // refresh query result is the same as the customer in cache" +
    // whose updated name is " + customer.getProperty("companyName"));
    // This test should succeed; it fails because of above bug!!!
    expect(results[0]).toBe(customer);
      
  });

  //Using EntityManager em1, query Entity A and it's nav property (R1) Entity B1.
  //Using EntityManager em2, query A and change it's nav property to B2. Save the change.
  //Using EntityManager em1, still holding A and B1, query A, including it's expanded nav property R1.
  //In R1.subscribeChanges, the correct new value of B2 will exist as R1's value but it will have a status of "Detached".
  test("bug with nav prop change and expand", async () => {
    const em1 = TestFns.newEntityManager();
    const em2 = TestFns.newEntityManager();
    const p = Predicate.create("freight", ">", 100).and("customerID", "!=", null);
    const query = new EntityQuery()
      .from("Orders")
      .where(p)
      .orderBy("orderID")
      .expand("customer")
      .take(1);

    let oldCust, newCust1a, newCust1b, order1, order1a, order1b;
    const qr1 = await em1.executeQuery(query);

    order1 = qr1.results[0];
    oldCust = order1.getProperty("customer");
    expect(oldCust).not.toBeNull();
    const qr2 = await em2.executeQuery(EntityQuery.fromEntityKey(order1.entityAspect.getKey()));

    order1a = qr2.results[0];
    expect(order1.entityAspect.getKey()).toEqual(order1a.entityAspect.getKey());

    const customerType = em2.metadataStore.getEntityType("Customer") as EntityType;
    newCust1a = customerType.createEntity();
    newCust1a.setProperty("companyName", "Test_compName");
    order1a.setProperty("customer", newCust1a);

    const sr = await em2.saveChanges();

    em1.entityChanged.subscribe((args) => {
      const entity = args.entity;
      expect(entity).not.toBeNull();
      expect(entity.entityAspect.entityState).not.toEqual(EntityState.Detached);
    });

    const qr3 = await em1.executeQuery(query);

    order1b = qr3.results[0];
    expect(order1b).toBe(order1);
    newCust1b = order1b.getProperty("customer");
    expect(newCust1a.entityAspect.getKey()).toEqual(newCust1b.entityAspect.getKey());
    expect(newCust1b).not.toBeNull();
    expect(newCust1b.entityAspect.entityState.isUnchanged()).toBe(true);
  });




});