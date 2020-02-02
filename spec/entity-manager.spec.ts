import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Manager", () => {

  beforeEach(function () {

  });

  test("entityChanged event after query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    let changedArgs: EntityChangedEventArgs[] = [];
    let lastArgs, lastAction, lastEntity;
    em.entityChanged.subscribe( args => {
      changedArgs.push(args);
      lastArgs = args;
      lastAction = args.entityAction;
      lastEntity = args.entity;
    });
    const q1 = new EntityQuery()
        .from("Employees")
        .orderBy("lastName")
        .take(2);
    
    const qr1 = await em.executeQuery(q1);
    expect(changedArgs.length).toBe(2);
    changedArgs.forEach( arg => {
      expect(arg.entityAction).toBe(EntityAction.AttachOnQuery);
    });
    const emps = qr1.results;
    expect(emps.length).toBe(2);
    emps[0].setProperty("lastName", "Smith");
    changedArgs = [];

    const qr2 = await em.executeQuery(q1);
    expect(qr2.results.length).toBe(2);
    // default MergeStrategy is preserveChanges so only unmodified entities should get merged.
    expect(changedArgs.length).toBe(1);
    
    const q2 = q1.using(MergeStrategy.OverwriteChanges);
    changedArgs = [];
    const data2 = await em.executeQuery(q2);
    expect(data2.results.length).toBe(2);
    // two mergeOnQuery and 1 entityStateChange
    expect(changedArgs.length).toBe(3);
    
    let moqCount = 0;
    let esCount = 0;
    changedArgs.forEach(function (arg) {
      if (arg.entityAction === EntityAction.MergeOnQuery) {
        moqCount++;
      }
      if (arg.entityAction === EntityAction.EntityStateChange) {
        esCount++;
      }
    });
    expect(moqCount === 2 && esCount === 1).toBe(true);
  });

});