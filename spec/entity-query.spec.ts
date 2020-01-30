import { EntityManager, EntityQuery, NamingConvention, Predicate } from 'breeze-client';
import { skipIf, TestFns } from './test-fns';

const defaultServiceName = 'http://localhost:61552/breeze/NorthwindIBModel';
TestFns.init(defaultServiceName);

const serverEnv = 'webApi';

describe("EntityQuery", () => {

  beforeEach(function () {

  });
  

  test("should allow simple metadata query", async () => {
    let em = new EntityManager('test');
    let ms = em.metadataStore;
    const metadata = await ms.fetchMetadata(defaultServiceName);
    expect(metadata).not.toBeNull();
    
  });

  test("should allow simple entity query", async () => {
    expect.assertions(2);
    let em = TestFns.newEntityManager();
    let ms = em.metadataStore;
    
    let query = new EntityQuery("Customers");
    expect(query.resourceName).toEqual("Customers");

    const qr = await em.executeQuery(query);
    expect(qr.results.length).toBeGreaterThan(100);

  });

  test("can handle simple json query syntax ", async() => {
    expect.assertions(1);
    let em = TestFns.newEntityManager();
    const query = EntityQuery.from('Customers').using(em).where({ 'city': { '==': 'London' } });
    const url = query._toUri(em);
    
    const qr = await em.executeQuery(query);
    
    const r = qr.results;
    expect(r.length).toBeGreaterThan(0);
  });

  test("JSON can use 'not' array with 'in' inside 'and'", async() => {
    const countries = ['Belgium', 'Germany'];
    const p2 = {
      and: [
        { companyName: { startswith: 'B' } },
        { not: { country: { in: countries } } }
      ]
    };

    const p = Predicate.create(p2);
    const q = new EntityQuery("Customers").where(p);
    const em = TestFns.newEntityManager();
    const qr = await em.executeQuery(q);
    const r = qr.results;
    expect(r.length).toBe(6);
    r.forEach((cust) => {
      expect(countries.indexOf(cust.country) < 0).toBe(true);
    });
    expect.assertions(7);
  });

  test("can handle parens in right hand side of predicate", async() => {
    const em = TestFns.newEntityManager();
    const query = new EntityQuery("Customers");
    // a valid query that returns no data
    const q2 = query.where('city', 'startsWith', 'Lon (don )');

    const qr = await em.executeQuery(q2);
    expect(qr.results.length).toBe(0);
    expect.assertions(1);
  });

  test("should not throw when add where clause to query with a `.fromEntityType` value", async() => {
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
    expect.assertions(1)  ;
  });

  test("query with 'in' clause", async () =>  {
    expect.assertions(3);
    const em1 = TestFns.newEntityManager();

    const countries = ['Austria', 'Italy', 'Norway']
    const query = EntityQuery.from("Customers")
      .where("country", 'in', countries);

    const qr1 = await em1.executeQuery(query);
    const r = qr1.results;
    expect(r.length).toBeGreaterThan(0);
     
    const isOk = r.every((cust) => {
      return countries.indexOf(cust.getProperty("country")) >= 0;
    });
    expect(isOk).toBe(true);

    const r2 = em1.executeQueryLocally(query);
    expect(r2.length).toBe(r.length);
    
  });

});

