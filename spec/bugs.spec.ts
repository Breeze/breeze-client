import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy } from 'breeze-client';
import { TestFns, skipTestIf } from './test-fns';

const metadata = require('./support/NorthwindIBMetadata.json');

TestFns.initServerEnv();

beforeAll(async () => {
  // MetadataStore.importMetadata(metadata);
  await TestFns.initDefaultMetadataStore();

});

describe("Old Bugs", () => {

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


});