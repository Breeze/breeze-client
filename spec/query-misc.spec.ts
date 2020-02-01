import { Entity, EntityQuery, EntityType, MetadataStore, Predicate, breeze, MergeStrategy, DataProperty, NavigationProperty, core, QueryOptions, EntityManager, EntityKey, FetchStrategy, EntityState } from 'breeze-client';
import { TestFns, skipTestIf, skipDescribeIf } from './test-fns';

function ok(a: any, b?: any) {
  throw new Error('for test conversion purposes');
}

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Query Misc", () => {

  test("queryOptions using", () => {
    let qo = QueryOptions.defaultInstance;
    expect(qo.fetchStrategy).toBe(FetchStrategy.FromServer);
    expect(qo.mergeStrategy).toBe(MergeStrategy.PreserveChanges);
    qo = qo.using(FetchStrategy.FromLocalCache);
    expect(qo.fetchStrategy).toBe(FetchStrategy.FromLocalCache);
    qo = qo.using({ mergeStrategy: MergeStrategy.OverwriteChanges });
    expect(qo.mergeStrategy).toBe(MergeStrategy.OverwriteChanges);
  });

  test("getEntities after query", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = breeze.EntityQuery.from("Categories");
    const qr1 = await em1.executeQuery(query);
    expect(qr1.results.length).toBeGreaterThan(0);
    const ents = em1.getEntities();
    expect(ents.length).toBe(qr1.results.length);
  });



  test("query results include query obj", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const alfredsID = '785efa04-cbf2-4dd7-a7de-083ee17b6ad2';
    const query = EntityQuery.from("Customers")
      .where(TestFns.wellKnownData.keyNames.customer, "==", alfredsID)
      .using(em1);

    const qr1 = await query.execute();
    const customer = qr1.results[0];
    const sameQuery = qr1.query;
    expect(query).toBe(sameQuery);
  });



  test("queried date property is a DateTime", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    // This is what the type of a date should be
    const someDate = new Date();
    expect("object").toBe(typeof someDate);

    const firstOrderQuery = new EntityQuery("Orders")
      .where("orderDate", ">", new Date(1998, 3, 1))
      .take(1);

    const qr1 = await em1.executeQuery(firstOrderQuery);
    const order = qr1.results[0];
    const orderDate = order.getProperty("orderDate");
    const ents = em1.getEntities();

    expect("object").toBe(typeof orderDate);
    expect(core.isDate(orderDate)).toBe(true);
  });

  test("can run two queries in parallel for fresh EM w/ empty metadataStore", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = breeze.EntityQuery.from("Customers");
    let successCount = 0;

    const prom1 = em1.executeQuery(query).then(() => {
      return successCount++;
    });
    const prom2 = em1.executeQuery(query).then(() => {
      return successCount++;
    });

    await Promise.all([prom1, prom2]);
    expect(successCount).toBe(2);
  });


  test("getAlfred", async () => {
    expect.hasAssertions();
    const em1 = TestFns.newEntityManager();
    const query = EntityQuery.from("Customers").where("companyName", "startsWith", "Alfreds");
    const qr1 = await em1.executeQuery(query);
    const alfred = qr1.results[0];
    const alfredsID = alfred.getProperty(TestFns.wellKnownData.keyNames.customer).toLowerCase();
    expect(alfredsID).toEqual(TestFns.wellKnownData.alfredsID);
  });

  // testFns.skipIf("odata,mongo", "has not yet implemented server side interception").
  test("insure that query is Not a duration query even without type mapping", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("AltCustomers").where('companyName', '==', 'Papa');

    const data = await em.executeQuery(q);
    expect(data.results.length).toBe(0);
  });

  // testFns.skipIf("mongo,odata,sequelize,hibernate", "is N/A for this EF specific test").
  test("query involving multiple entities on the server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const q = EntityQuery.from("QueryInvolvingMultipleEntities");

    const data = await em.executeQuery(q);
    expect(true).toBe(true);
  });
  


});