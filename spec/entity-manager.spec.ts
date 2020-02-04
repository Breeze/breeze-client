import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy, QueryOptions, FetchStrategy, EntityManager } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Manager", () => {

  beforeEach(function () {

  });

  test("createEmptyCopy", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const em2 = em.createEmptyCopy();
    const q = EntityQuery.from("Customers").take(1);
    
    const data = await em2.executeQuery(q);
    expect(data.results.length).toBe(1);
  });

  test("mergeStrategy.overwrite", async function () {
    expect.hasAssertions();
    
    const queryOptions = new QueryOptions({
      mergeStrategy: MergeStrategy.OverwriteChanges,
      fetchStrategy: FetchStrategy.FromServer
    });

    let em = TestFns.newEntityManager();
    em.setProperties( { queryOptions: queryOptions });
    const q = EntityQuery.from("Customers").take(2).using(em);
    const val = Date.now().toString();
    
    const data = await q.execute();
    const custs = data.results;
    custs[0].setProperty("companyName", val);
    custs[1].setProperty("city", val);
    const data2 = await q.execute();
    const custs2 = data2.results;
    const companyName = custs2[0].getProperty("companyName");
    const city = custs2[1].getProperty("city");
    expect(companyName).not.toEqual(val);
    expect(city).not.toEqual(val);
  });

  
  test("mergeStrategy.overwriteChanges and change events", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    em.queryOptions = em.queryOptions.using(MergeStrategy.OverwriteChanges);
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
        .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID);

    const entityChangedArgs = [];
    const hasChangesChangedArgs = [];
    
    em.entityChanged.subscribe( args => {
      entityChangedArgs.push(args);
    });
    em.hasChangesChanged.subscribe(function (args) {
      hasChangesChangedArgs.push(args);
    });
    
    const data = await query.using(em).execute();
    expect(em.hasChanges()).toBe(false);
    const customer = data.results[0];
    customer.setProperty("companyName", "Foo");
    expect(em.hasChanges()).toBe(true);
    hasChangesChangedArgs.length = 0;
    entityChangedArgs.length = 0;
    await query.using(em).execute();
    expect(em.hasChanges()).toBe(false);
    expect(em.getChanges().length).toBe(0);
    // hasChangeschanged should have been fired
    expect(hasChangesChangedArgs.length).toBe(1);
    // entityStateChange and propertyChange
    // so entityChanged should have been fired twice
    expect(entityChangedArgs.length).toBe(2);

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
    const qr3 = await em.executeQuery(q2);
    expect(qr3.results.length).toBe(2);
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

  test("hasChanges with query mods", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();

    let hasChanges = false;
    let count = 0;
    em.hasChangesChanged.subscribe( args => {
      count = count + 1;
      hasChanges = args.hasChanges;
    });
    expect(count).toBe(0);
    expect(em.hasChanges()).toBe(false);
    
    const qr1 = await EntityQuery.from("Customers").take(3).using(em).execute();
    const custs = qr1.results;
    expect(em.hasChanges()).toBe(false);
    custs[0].setProperty("companyName", "xxx");
    custs[1].entityAspect.setDeleted();
    custs[2].entityAspect.setModified();
    expect(count).toBe(1);
    expect(em.hasChanges()).toBe(true);
    expect(hasChanges).toBe(true);
    
    em.rejectChanges();
    expect(count).toBe(2);
    expect(em.hasChanges()).toBe(false);
    expect(hasChanges).toBe(false);
  });

});