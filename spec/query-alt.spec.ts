import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes')
}

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query Alternatives", () => {

  test("fetchEntityByKey", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;

    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    // should have been from database
    expect(fr1.fromCache).toBe(false);
    const fr2 = await em1.fetchEntityByKey("Customer", alfredsID, true);

    const alfred2 = fr2.entity;
    expect(alfred2).not.toBeNull();
    expect(alfred).toBe(alfred2);
    // should have been from cache
    expect(fr2.fromCache).toBe(true);
    const fr3 = await em1.fetchEntityByKey(fr2.entityKey);
    const alfred3 = fr3.entity;
    expect(alfred3).toBe(alfred);
    expect(fr3.fromCache).toBe(false);
  });

  test("fetchEntityByKey without metadata", async () => {
    expect.hasAssertions();
    const emX = new breeze.EntityManager(TestFns.defaultServiceName);
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await emX.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
  });

  test("fetchEntityByKey - deleted", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID);

    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
    alfred.entityAspect.setDeleted();
    const fr2 = await em1.fetchEntityByKey("Customer", alfredsID, true);

    const alfred2 = fr2.entity;
    expect(alfred).not.toBeNull();
    expect(fr2.fromCache).toBe(true);
    const fr3 = await em1.fetchEntityByKey(fr2.entityKey, true);

    const alfred3 = fr3.entity;
    // alfred3 should not have been found because it was deleted.
    expect(alfred3).toBeUndefined();
    expect(fr3.fromCache).toBe(true);

    em1.setProperties({ queryOptions: em1.queryOptions.using(MergeStrategy.OverwriteChanges) });

    const fr4 = await em1.fetchEntityByKey(fr3.entityKey, true);
    const alfred4 = fr4.entity;
    expect(alfred4).toBe(alfred);
    expect(fr4.fromCache).toBe(false);
  });


  test("fetchEntityByKey - cache first not found", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = TestFns.wellKnownData.alfredsID;
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).not.toBeNull();
    expect(fr1.fromCache).toBe(false);
  });

  test("fetchEntityByKey - missing key", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '885efa04-cbf2-4dd7-a7de-083ee17b6ad7'; // not a valid key
    const fr1 = await em1.fetchEntityByKey("Customer", alfredsID, true);
    const alfred = fr1.entity;
    expect(alfred).toBeUndefined();
    expect(fr1.fromCache).toBe(false);
    expect(fr1.entityKey).not.toBeNull();
  });

  test("fromEntityKey without preexisting metadata", async () => {
    expect.assertions(1);
    const manager = new EntityManager(TestFns.defaultServiceName);

    await manager.fetchMetadata();
    const empType = manager.metadataStore.getEntityType("Employee") as EntityType;
    const entityKey = new EntityKey(empType, 1);
    const query = EntityQuery.fromEntityKey(entityKey);
    const qr = await manager.executeQuery(query);

    expect(qr.results.length).toBe(1);
  });

  test("getEntityByKey", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery
      .from("Customers");
    const qr1 = await em1.executeQuery(query);

    const cust1 = qr1.results[0];
    const key = cust1.getProperty(TestFns.wellKnownData.keyNames.customer);
    const cust2 = em1.getEntityByKey("Customer", key);
    expect(cust1).toBe(cust2);
  });

  test("fromEntities", async () => {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const query = new EntityQuery()
      .from("Orders")
      .take(2);
    const qr1 = await em.executeQuery(query);
    const orders = qr1.results;
    expect(orders.length).toBe(2);
    const q2 = EntityQuery.fromEntities(orders);
    const qr2 = await q2.execute();
    expect(qr2.results.length).toBe(2);
  });

  test("isNavigationPropertyLoaded on expand", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").where("companyName", "startsWith", "An").take(2).expand("orders.orderDetails");
    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;

    expect(r.length).toBe(2);
    r.forEach((cust) => {
      const ordersLoaded = cust.entityAspect.isNavigationPropertyLoaded("orders");
      expect(ordersLoaded).toBe(true);
      const orders = cust.getProperty("orders") as Entity[];
      expect(orders.length).toBeGreaterThan(0);
      orders.forEach((order) => {
        const detailsLoaded = order.entityAspect.isNavigationPropertyLoaded("orderDetails");
        expect(detailsLoaded).toBe(true);
      });
    });
  });

  test("load with uni (1-n) region and territories", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const q = new EntityQuery()
      .from("Regions")
      .where("regionDescription", "==", "Northern");

    const qr1 = await em1.executeQuery(q);
    expect(em1.hasChanges()).toBe(false);
    expect(em1.getChanges().length).toBe(0);
    const region = qr1.results[0];
    const terrs = region.getProperty("territories");
    const lr1 = await terrs.load();
    expect(em1.hasChanges()).toBe(false);
    expect(em1.getChanges().length).toBe(0);
    expect(lr1.results.length).toBeGreaterThan(0);
  });

});