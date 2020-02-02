import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Aspect", () => {


  test("entityAspect.wasLoaded", function (assert) {
    var done = assert.async();
    var em = newEm();
    var orderType = em.metadataStore.getEntityType("Order");
    var empType = em.metadataStore.getEntityType("Employee");
    var custType = em.metadataStore.getEntityType("Customer");
    var order1 = em.attachEntity(orderType.createEntity());
    ok(!order1.entityAspect.wasLoaded);
    var emp1 = em.attachEntity(empType.createEntity());
    ok(!emp1.entityAspect.wasLoaded);
    var q = new EntityQuery().from("Employees").take(2);
    
    em.executeQuery(q, function (data) {
      ok(data.results.length == 2, "results.length should be 2");
      data.results.forEach(function (r) {
        ok(r.entityAspect.wasLoaded === true);
      });
    }).fail(testFns.handleFail).fin(done);
  });
});
