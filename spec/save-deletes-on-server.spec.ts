import { breeze, core, Entity, EntityKey, EntityQuery, FilterQueryOp, SaveOptions, EntityManager } from 'breeze-client';
import { skipTestIf, TestFns, skipDescribeIf } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

skipDescribeIf(TestFns.isSequelizeServer || TestFns.isODataServer,
  "Saves with deletions on the server", function () {


  test("delete new product on server before", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");
    const saveOptions = new SaveOptions({ tag: "deleteProductOnServer.Before" });

    const sr = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(1);
  });

  test("delete new product on server after", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");
    const saveOptions = new SaveOptions({ tag: "deleteProductOnServer" });

    const sr = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(1);
  });

  test("delete unchanged product on server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");

    const sr = await em.saveChanges();
    expect(product.entityAspect.entityState.isUnchanged()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    supplier.setProperty("contactName", "Harry Arms");
    const saveOptions = new SaveOptions({ tag: "deleteProductOnServer:" + product.getProperty("productID") });
    const sr_1 = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(1);
  });

  test("delete new supplier and product on server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");
    const saveOptions = new SaveOptions({ tag: "deleteSupplierAndProductOnServer" });

    const sr = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isDetached()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(0);
  });

  test("delete unchanged supplier and product on server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");

    const sr = await em.saveChanges();
    expect(product.entityAspect.entityState.isUnchanged()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    const saveOptions = new SaveOptions({ tag: "deleteSupplierAndProductOnServer" });
    const sr_1 = await em.saveChanges([supplier, product], saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isDetached()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(0);
  });

  test("delete modified supplier and product on server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");

    const sr = await em.saveChanges();
    expect(product.entityAspect.entityState.isUnchanged()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    supplier.setProperty("contactName", "Harry Arms");
    product.setProperty("unitsInStock", 25);
    const saveOptions = new SaveOptions({ tag: "deleteSupplierAndProductOnServer" });
    const sr_1 = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isDetached()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(0);
  });

  test("delete supplier on client and product on server", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");

    const sr = await em.saveChanges();
    expect(product.entityAspect.entityState.isUnchanged()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    supplier.entityAspect.setDeleted();
    const saveOptions = new SaveOptions({ tag: "deleteProductOnServer:" + product.getProperty("productID") });
    const sr_1 = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isDetached()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(0);
  });

  test("delete product on client and supplier on server before save", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const product = createSupplierAndProduct(em);
    const supplier = product.getProperty("supplier");

    const sr = await em.saveChanges();
    expect(product.entityAspect.entityState.isUnchanged()).toBeTrue();
    expect(supplier.entityAspect.entityState.isUnchanged()).toBeTrue();
    product.entityAspect.setDeleted();
    const saveOptions = new SaveOptions({ tag: "deleteSupplierOnServer.Before" });
    const sr_1 = await em.saveChanges(null, saveOptions);
    expect(product.entityAspect.entityState.isDetached()).toBeTrue();
    expect(supplier.entityAspect.entityState.isDetached()).toBeTrue();
    const addedProducts = em.getEntities(["Product"]);
    expect(addedProducts.length).toBe(0);
    const addedSuppliers = em.getEntities(["Supplier"]);
    expect(addedSuppliers.length).toBe(0);
  });

  function createSupplierAndProduct(em: EntityManager) {
    const dt = new Date();
    const supplier = em.createEntity("Supplier", { companyName: "Sup-" + dt.getTime(), contactName: "Phillip Wiggs", location: { region: "Cornwall", country: "UK" } });
    const supplierID = supplier.getProperty("supplierID");
    const product = em.createEntity("Product", { productName: "Prod-" + dt.getTime(), supplierID: supplierID, quantityPerUnit: "EA", unitsInStock: 30 });
    return product;
  }

});
