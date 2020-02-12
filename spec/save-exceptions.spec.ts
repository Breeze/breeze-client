import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy, QueryOptions, FetchStrategy, EntityManager, SaveOptions, ValidationErrorsChangedEventArgs } from 'breeze-client';
import { TestFns, JsonObj, skipTestIf } from './test-fns';
import { SaveTestFns } from './save-test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();
});

afterAll( async () => {
  await SaveTestFns.cleanup();
});

// NOTE: Promises and async 'done' are DELIBERATELY used in this test file.  Do not try to convert to 'await'.
// It will break the intent. 

describe("Save exception handling", () => {

  beforeEach(function () {

  });


  test("should throw when delete saved added entity (store-gen key) before server save response", async function (done) {
    expect.assertions(7);
    // Fails D#2649 "Internal Error in key fixup - unable to locate entity"
    const em = TestFns.newEntityManager();
    // Surround target emp (emp2) with other adds to see the effect on the cached adds
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });
    const emp2 = em.createEntity("Employee", { firstName: 'Test fn2', lastName: 'Test fn2' });
    const emp3 = em.createEntity("Employee", { firstName: 'Test fn3', lastName: 'Test fn3' });

    // deliberately left as a promise impl
    // We expect the saveChanges to succeed AND for the code in the try block to fail
    em.saveChanges().then(function (sr) {
      expect(emp1.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp2.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp2.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp3.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp3.entityAspect.entityState.isUnchanged()).toBe(true);
    }).catch(function (e) {
      throw new Error('should not get here');
    }).finally(done);


    // try to delete the 2nd new employee before save can return;
    try {
      emp2.entityAspect.setDeleted();
    } catch (error) {
      // hope to trap error when call setDeleted() on added entity that is being saved.
      expect(error.message).toMatch(/in the process of being saved/);
    }
  });

  test("should throw when detach saved added entity (store-gen key) before server save response", async function (done) {
    expect.assertions(7);
    // Fails D#2650 fixupKeys: "Internal Error in key fixup - unable to locate entity"
    const em = TestFns.newEntityManager();
    // Surround target emp (emp2) with other adds to see the effect on the cached adds
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });
    const emp2 = em.createEntity("Employee", { firstName: 'Test fn2', lastName: 'Test fn2' });
    const emp3 = em.createEntity("Employee", { firstName: 'Test fn3', lastName: 'Test fn3' });

    // deliberately left as a promise impl
    // We expect the saveChanges to succeed AND for the code in the try block to fail
    em.saveChanges().then(function (sr) {
      expect(emp1.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp2.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp2.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp3.getProperty("employeeID")).toBeGreaterThanOrEqual(-1);
      expect(emp3.entityAspect.entityState.isUnchanged()).toBe(true);
    }).catch(function (e) {
      throw new Error('should not get here');
    }).finally(done);

    // try to detach the added entity before save can return;
    try {
      em.detachEntity(emp1);
    } catch (error) {
      // hope to trap error when call em.detachEntity on added entity that is being saved.
      expect(error.message).toMatch(/in the process of being saved/);
    }
  });

  test("should throw when call rejectChanges for saved added entity (store-gen key) before server save response", async function (done) {
    expect.assertions(7);
    // Fails D#2649 fixupKeys: "Internal Error in key fixup - unable to locate entity"
    const em = TestFns.newEntityManager();
    // Surround target emp (emp2) with other adds to see the effect on the cached adds
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });
    const emp2 = em.createEntity("Employee", { firstName: 'Test fn2', lastName: 'Test fn2' });
    const emp3 = em.createEntity("Employee", { firstName: 'Test fn3', lastName: 'Test fn3' });

    em.saveChanges().then(function (sr) {
      expect(emp1.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp2.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp2.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp3.getProperty("employeeID")).toBeGreaterThanOrEqual(-1);
      expect(emp3.entityAspect.entityState.isUnchanged()).toBe(true);
    }).catch(function (e) {
      throw new Error('should not get here');
    }).finally(done);


    // try to rejectChanges for the added entity before save can return;
    try {
      emp1.entityAspect.rejectChanges();
    } catch (error) {
      // hope to trap error when call em.rejectChanges on added entity that is being saved.
      expect(error.message).toMatch(/in the process of being saved/);

    }
  });

  test("should throw when clear manager before server save response of saved added entity (store-gen key)", async function (done) {
    expect.assertions(3);
    // Fails D#2650 fixupKeys: "Unable to locate the following fully qualified EntityType..."
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });

    em.saveChanges().then(function (sr) {
      expect(emp1.getProperty("employeeID")).toBeGreaterThan(-1);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
    }).catch(function (e) {
      throw new Error('should not get here');
    }).finally(done);


    // try to clear the manager before save can return;
    try {
      em.clear();
    } catch (error) {
      // hope to trap error when call em.clear() when an added entity is being saved.
      expect(error.message).toMatch(/in the process of being saved/);

    }
  });

  test("can clear manager before server save response when no fixup needed", async function () {
    expect.hasAssertions();
    // See D#2650. What should be the behavior?
    const query = EntityQuery.from('Employees').take(1);
    const em = TestFns.newEntityManager();
    let emp1: Entity;
    return em.executeQuery(query).then(function (data) {
      emp1 = data.results[0];
      emp1.entityAspect.setModified();
      const promise = em.saveChanges();

      // THE FATEFUL MOMENT
      // try to clear the manager before save can return;
      try {
        em.clear(); // should we throw?
      } catch (error) {
        // hope to trap error when call em.clear() when an added entity is being saved.
        expect(error.message).toMatch(/in the process of being saved/);
        // This would trap the error and assert that if we decided to throw
      }
      return promise;
    }).then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
    }).catch(function (e) {
      throw new Error('should not get here');
      const id1 = emp1 && emp1.getProperty('employeeID');
      // D#2650: Break here to see state of the emp.
      // handleFail(e);
    });
  });

  // This test passes when the server returns the saved added entity as most servers do
  test("reverts to saved values when save an added entity then modify it before save response", function (done) {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });

    em.saveChanges().then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp1.getProperty('firstName')).toBe('Test fn1');
    }).finally(done);

    // modify it while save is in-flight
    emp1.setProperty('firstName', 'Test fn1 mod');
  });

  // This test passes when the server returns the saved entity
  // That won't be true for every server and therefore behavior can be different
  test("reverts to saved values when save modifed entity then modify it again before save response", function (done) {
    expect.assertions(4);
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });

    em.saveChanges().then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      emp1.setProperty('firstName', 'Test fn1 mod1');
      const promise = em.saveChanges(); // save modified emp

      // modify it again while save is in-flight
      emp1.setProperty('firstName', 'Test fn1 mod2');
      return promise;
    }).then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp1.getProperty('firstName')).toBe('Test fn1 mod1');
    }).finally(done);

  });

  // This test passes when the server returns the whole saved entity
  // That won't be true for servers that return patch values
  // rather than entire entities and therefore behavior can be different
  test("reverts to saved values when save modified entity then modify a different value before save response", function (done) {
    expect.assertions(4);
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });

    em.saveChanges().then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      emp1.setProperty('firstName', 'Test fn1 mod1');
      const promise = em.saveChanges(); // save modified emp

      // modify a different property while save is in-flight
      emp1.setProperty('lastName', 'Test ln1 mod2');

      return promise;
    }).then(function (sr) {
      expect(sr.entities.length).toBeGreaterThan(0);
      expect(emp1.entityAspect.entityState.isUnchanged()).toBe(true);
      expect(emp1.getProperty('lastName')).toBe('Test ln1');
    }).finally(done);

  });


  test("manager.hasChanges() is true after save if manager other changes were made during save", async function (done) {
    expect.hasAssertions();
    // D#2651
    expect(2);
    const em = TestFns.newEntityManager();
    const emp1 = em.createEntity("Employee", { firstName: 'Test fn1', lastName: 'Test ln1' });

    em.saveChanges().then(function (sr) {
      const hasChanges = em.hasChanges();
      const changes = em.getChanges();
      expect(changes.length).toBe(1);
      expect(hasChanges).toBe(true);
    }).finally(done);

    // Create another entity while save is in progress
    const emp2 = em.createEntity("Employee", { firstName: 'Test fn2', lastName: 'Test fn2' });

  });

  //TestFns.skipIf("odata", "does not support server interception or alt resources").
  test("adds with EntityErrorsException", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const zzz = SaveTestFns.createParentAndChildren(em);
    const cust1 = zzz.cust1;
    const so = new SaveOptions({ resourceName: "SaveWithEntityErrorsException", tag: "entityErrorsException" });
    const order1ValErrorsChangedArgs: ValidationErrorsChangedEventArgs[] = [];
    zzz.order1.entityAspect.validationErrorsChanged.subscribe(function (e: ValidationErrorsChangedEventArgs) {
      order1ValErrorsChangedArgs.push(e);
    });

    try {
      await em.saveChanges(null, so);
      throw new Error("should not get here");

    } catch (e) {
      expect(e.message).toMatch(/test of custom exception message/);
      expect(order1ValErrorsChangedArgs.length).toBe(1);
      expect(order1ValErrorsChangedArgs[0].added.length).toBe(1);
      expect(order1ValErrorsChangedArgs[0].removed.length).toBe(0);
      expect(e.entityErrors.length).toBe(2);
      expect(zzz.order1.entityAspect.getValidationErrors().length).toBe(1);
      const order2Errs = zzz.order2.entityAspect.getValidationErrors();
      expect(order2Errs.length).toBe(1);
      expect(order2Errs[0].propertyName).toBe("orderID");
      // now save it properly
      order1ValErrorsChangedArgs.length = 0;

      const sr = await em.saveChanges();

      expect(sr.entities.length).toBe(4);
      expect(order1ValErrorsChangedArgs.length).toBe(1);
      expect(order1ValErrorsChangedArgs[0].added.length).toBe(0);
      expect(order1ValErrorsChangedArgs[0].removed.length).toBe(1);
    }

  });

  test("mods with EntityErrorsException", async function () {
    expect.hasAssertions();

    const em = TestFns.newEntityManager();
    const zzz = SaveTestFns.createParentAndChildren(em);
    const cust1 = zzz.cust1;

    try {
      const sr = await em.saveChanges();
      zzz.cust1.setProperty("contactName", "foo");
      zzz.cust2.setProperty("contactName", "foo");
      zzz.order1.setProperty("freight", 888.11);
      zzz.order2.setProperty("freight", 888.11);
      expect(zzz.cust1.entityAspect.entityState.isModified()).toBe(true);
      expect(zzz.order1.entityAspect.entityState.isModified()).toBe(true);
      const so = new SaveOptions({ resourceName: "SaveWithEntityErrorsException", tag: "entityErrorsException" });
      await em.saveChanges(null, so);
      throw new Error("should not get here");
    } catch (e) {
      expect(e.message).toBe("test of custom exception message");
      expect(e.entityErrors.length).toBe(2);
      expect(zzz.order1.entityAspect.getValidationErrors().length).toBe(1);
      const order2Errs = zzz.order2.entityAspect.getValidationErrors();
      expect(order2Errs.length).toBe(1);
      expect(order2Errs[0].propertyName).toBe("orderID");
      // now save it properly
      const sr = await em.saveChanges();
      expect(sr.entities.length).toBe(4);
    }

  });

  test("with client side validation error", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const zzz = SaveTestFns.createParentAndChildren(em);
    const cust1 = zzz.cust1;
    cust1.setProperty("companyName", null);

    try {
      await em.saveChanges();
      throw new Error("should not get here");
    } catch (e) {
      expect(e.entityErrors.length).toBe(1);
      // should NOT be a server error
      expect(e.entityErrors[0].isServerError).toBe(false);
      const custErrors = cust1.entityAspect.getValidationErrors();
      // error message should appear on the cust
      expect(custErrors[0].errorMessage).toBe(e.entityErrors[0].errorMessage);
    }
  });

  //TestFns.skipIf("odata", "does not support server interception or alt resources").
  // skipIf("hibernate", "is not applicable because this test uses EF validation annotations")
  skipTestIf(TestFns.isAspCoreServer,
    "with server side entity level validation error", async function () {
      expect.hasAssertions();
      const em = TestFns.newEntityManager();
      const zzz = SaveTestFns.createParentAndChildren(em);
      const cust1 = zzz.cust1;
      cust1.setProperty("companyName", "error");

      try {
        await em.saveChanges();
        throw new Error('should not get here');
      } catch (e) {
        expect(e.entityErrors.length).toBe(1);
        expect(e.entityErrors[0].isServerError).toBe(true);
        const custErrors = cust1.entityAspect.getValidationErrors();
        // error message should appear on the cust
        expect(custErrors[0].errorMessage).toBe(e.entityErrors[0].errorMessage);
      }
    });

  //TestFns.skipIf("odata", "does not support server interception or alt resources").
  // AspCore does not have server validation.
  skipTestIf(TestFns.isAspCoreServer,
    "with server side entity level validation error + repeat", async function () {
      expect.hasAssertions();

      const em = TestFns.newEntityManager();
      const zzz = SaveTestFns.createParentAndChildren(em);
      const cust1 = zzz.cust1;
      cust1.setProperty("companyName", "error");

      try {
        await em.saveChanges();
        throw new Error('should not get here');
      } catch (e) {
        expect(e.entityErrors.length).toBe(1);
        const custErrors = cust1.entityAspect.getValidationErrors();
        expect(custErrors.length).toBe(1);
        expect(custErrors[0].errorMessage).toBe(e.entityErrors[0].errorMessage);
        try {
          await em.saveChanges();
          throw new Error('should not get here');
        } catch (e2) {
          expect(e2.entityErrors.length).toBe(1);
          const custError = cust1.entityAspect.getValidationErrors();
          expect(custErrors.length).toBe(1);
          expect(custErrors[0].errorMessage).toBe(e.entityErrors[0].errorMessage);
        }
      }
    });

  //TestFns.skipIf("sequelize,hibernate", " is unsupported because MySQL does not support millisecond resolution").
  // ASP Core is skipped because it does not do server validations 
  skipTestIf(TestFns.isAspCoreServer || TestFns.isSequelizeServer || TestFns.isHibernateServer,
  "custom data annotation validation", async function () {
    expect.hasAssertions();

    // This test will fail currently with the DATABASEFIRST_OLD define.
    // This is because ObjectContext.SaveChanges() does not automatically validate
    // entities. It must be done manually.
    const em = TestFns.newEntityManager();
    const q = new EntityQuery("Customers").skip(20).take(1).orderBy("contactName");

    let cust1;
    try {
      const qr1 = await q.using(em).execute();
      expect(qr1.results.length).toBe(1);
      cust1 = qr1.results[0];
      const region = cust1.getProperty("contactName");
      const newRegion = region === "Error" ? "Error again" : "Error";
      cust1.setProperty("contactName", newRegion);
      await em.saveChanges();

      throw new Error("should not get here - except with servers that do not perform validation");
    } catch (error) {
      expect(error.entityErrors.length).toBe(1);
      expect(error.entityErrors[0].errorMessage).toMatch(/the word 'Error'/);
      const custErrors = cust1.entityAspect.getValidationErrors();
      expect(error.entityErrors[0].errorMessage).toBe(custErrors[0].errorMessage);
    }
  });

  test("insert of existing entity", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const em2 = TestFns.newEntityManager();
    // need to use a resource that does NOT do autoGeneratedKeys
    const resourceName = "OrderDetails";
    const q = new EntityQuery()
      .from(resourceName)
      .take(2);

    const data = await em.executeQuery(q);
    const o = data.results[0];
    em.detachEntity(o);

    em2.addEntity(o);
    try {
      await em2.saveChanges();
      throw new Error('should not get here');
    } catch (error) {
      expect(em2.hasChanges()).toBeTrue();

      let frag;
      if (TestFns.isSequelizeServer) {
        frag = "SequelizeUniqueConstraintError".toLowerCase();
      } else if (TestFns.isHibernateServer) {
        frag = "duplicate entry";
      } else {
        frag = "primary key constraint";
      }
      expect(error.message.toLowerCase()).toInclude(frag);
    }
  });

  test("concurrency violation", async function () {
    expect.hasAssertions();
    const em = TestFns.newEntityManager();
    const em2 = TestFns.newEntityManager();
    const q = new EntityQuery()
      .from("Customers")
      .take(2);

    const qr1 = await em.executeQuery(q);
    // query cust
    const cust = qr1.results[0];
    const q2 = EntityQuery.fromEntities(cust);
    const qr2 = await em2.executeQuery(q2);
    // query same cust in dif em
    // and modify it and resave it
    expect(qr2.results.length).toBe(1);
    const sameCust = qr2.results[0];
    expect(cust.entityAspect.getKey().equals(sameCust.entityAspect.getKey()));
    TestFns.morphStringProp(sameCust, "companyName");
    const sr2 = await em2.saveChanges();
    TestFns.morphStringProp(cust, "companyName");
    try {
      // different em
      await em.saveChanges();
      throw new Error('should not get here');
    } catch (error) {
      expect(em.hasChanges()).toBeTrue();
      if (TestFns.isAspCoreServer) {
        expect(error.message).toMatch(/optimistic concurrency/);
      } else if (TestFns.isSequelizeServer) {
        expect(error.message).toMatch(/concurrency violation/);
      } else {
        expect(error.message).toMatch('need to determine correct error message for this server type');
      }
    }
  });

  //test("concurrency violation on delete", function() {
  //    expect.hasAssertions();
  //    expect(false, "not yet implemented");
  //});

  test("bad save call", function () {
    const em = TestFns.newEntityManager();
    try {
      // we have to cast as 'any' to allow typescript to even call this with invalid args
      (em as any).saveChanges(null, new SaveOptions(), "adfa");
    } catch (e) {
      expect(e.message).toMatch(/callback/);
    }
    try {
      // we have to cast as 'any' to allow typescript to even call this with invalid args
      (em as any).saveChanges(null, "adfa");
    } catch (e) {
      expect(e.message).toMatch(/saveOptions/);
    }
    try {
      (em as any).saveChanges("adfa");
    } catch (e) {
      expect(e.message).toMatch(/entities/);
    }
  });


});
