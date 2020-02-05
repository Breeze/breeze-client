import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy, QueryOptions, FetchStrategy, EntityManager, breeze } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

describe("Entity Operations", () => {

  beforeEach(function () {

  });

  test("set foreign key property to null", async function () {
    expect.hasAssertions();
    const productQuery = new EntityQuery("Products").where("supplierID", "ne", null).take(1);

    const em = TestFns.newEntityManager();
    const qr = await em.executeQuery(productQuery);
    await qr.results[0].entityAspect.loadNavigationProperty("supplier");
    const products = qr.results;
    const firstProduct = products[0];
    const supplierKeyName = TestFns.wellKnownData.keyNames.supplier;
    expect(firstProduct.getProperty(supplierKeyName)).toBeTruthy();
    firstProduct.setProperty(supplierKeyName, null);
    expect(firstProduct.getProperty(supplierKeyName)).toBeNull();
  });


  test("null foriegn key", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const productType = em.metadataStore.getAsEntityType("Product");
    let product = productType.createEntity();
    em.attachEntity(product);
    product.setProperty("productName", "foo");
    product.setProperty('supplierID', null);
    let errs = product.entityAspect.getValidationErrors();
    expect(errs.length).toBe(0);
    const q = EntityQuery.from("Products").take(1);

    const qr1 = await em.executeQuery(q);
    const products = qr1.results;
    product = products[0];
    product.setProperty('supplierID', null);
    errs = product.entityAspect.getValidationErrors();
    expect(errs.length).toBe(0);
  });

  test("propertyChanged on query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const empType = em.metadataStore.getAsEntityType("Employee");
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;
    expect(empType).toBeTruthy();
    const emp = empType.createEntity() as Entity;
    emp.setProperty(employeeKeyName, TestFns.wellKnownData.nancyID);
    let changes: any[] = [];
    emp.entityAspect.propertyChanged.subscribe(function (args) {
      changes.push(args);
    });
    em.attachEntity(emp);
    // now fetch
    const q = EntityQuery.fromEntities(emp);
    const uri = q._toUri(em);

    const data = await em.executeQuery(q);
    expect(changes.length).toBe(1);
    expect(changes[0].propertyName).toBeNull();
  });

  test("propertyChanged suppressed on query", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;
    const empType = em.metadataStore.getAsEntityType("Employee");
    expect(empType).toBeTruthy();
    const emp = empType.createEntity() as Entity;
    emp.setProperty(employeeKeyName, TestFns.wellKnownData.nancyID);
    const changes = [];
    emp.entityAspect.propertyChanged.subscribe(function (args) {
      changes.push(args);
    });
    breeze.Event.enable("propertyChanged", em, false);
    em.attachEntity(emp);
    // now fetch
    const q = EntityQuery.fromEntities(emp);

    const data = await em.executeQuery(q);
    expect(changes.length).toBe(0);
  });




});