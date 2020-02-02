import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Aspect", () => {


  test("entityAspect.wasLoaded", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const orderType = em.metadataStore.getAsEntityType("Order");
    const empType = em.metadataStore.getAsEntityType("Employee");
    
    const order1 = em.attachEntity(orderType.createEntity());
    expect(order1.entityAspect.wasLoaded).toBeFalsy();
    const emp1 = em.attachEntity(empType.createEntity());
    expect(emp1.entityAspect.wasLoaded).toBeFalsy();
    const q = new EntityQuery().from("Employees").take(2);
    
    const qr1 = await em.executeQuery(q);
    expect(qr1.results.length).toBe(2);
    qr1.results.forEach( r => {
      expect(r.entityAspect.wasLoaded).toBe(true);
    });
  });
});
