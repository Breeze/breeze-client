import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey, RelationArray, FetchStrategy, EntityState } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

// function ok(a: any, b?: any) {
//   throw new Error('for test conversion purposes');
// }

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Key Generation", () => {

  test("store-gen keys are always set by key generator on add to manager if they have default values", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const orderEntityType = em.metadataStore.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const o1 = orderEntityType.createEntity();
    let tempOrderId = o1.getProperty(orderKeyName);
    expect(tempOrderId).toBe(0);

    em.addEntity(o1);
    tempOrderId = o1.getProperty(orderKeyName);
    expect(tempOrderId).not.toBe(0);
    const isTempKey = em.keyGenerator.isTempKey(o1.entityAspect.getKey());
    expect(isTempKey).toBe(true);

    const saveResult = await em.saveChanges();
    const orderId = o1.getProperty(orderKeyName);
    expect(orderId).not.toBe(tempOrderId);
    const keyMappings = saveResult.keyMappings;
    expect(keyMappings.length).toBe(1);
    const mapping = keyMappings[0];
    expect(mapping.tempValue).toBe(tempOrderId);
    expect(mapping.realValue).toBe(orderId);
  });

  test("store-gen keys are not re-set by key generator upon add to manager", async function () {
    expect.hasAssertions();
    const dummyOrderID = TestFns.wellKnownData.dummyOrderID;
    const em = TestFns.newEntityManager();
    const orderEntityType = em.metadataStore.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const o1 = orderEntityType.createEntity();
    o1.setProperty(orderKeyName, dummyOrderID); // waste of time to set id; it will be replaced.
    let orderId = o1.getProperty(orderKeyName);
    expect(orderId).toBe(dummyOrderID);
    
    em.addEntity(o1);
    orderId = o1.getProperty(orderKeyName);
    expect(orderId).toBe(dummyOrderID);
    
    const saveResult = await em.saveChanges();
    orderId = o1.getProperty(orderKeyName);
    expect(orderId).not.toBe(dummyOrderID);
    const keyMappings = saveResult.keyMappings;
    expect(keyMappings.length).toBe(1);
    const mapping = keyMappings[0];
    expect(mapping.tempValue).toBe(dummyOrderID);
    expect(mapping.realValue).toBe(orderId);
  });

  // test("key generator reset", function () {
  //   const em = TestFns.newEntityManager();
  //   const dummyKeyGenerator = function () {
  //     this.dummy = true;
  //   };
  //   em.setProperties({ keyGeneratorCtor: dummyKeyGenerator });
  //   expect(em.keyGenerator.dummy).toBe(true);


  // });
});