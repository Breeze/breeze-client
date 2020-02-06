import { Entity, EntityQuery, EntityType, MetadataStore, EntityChangedEventArgs, EntityAction, MergeStrategy, QueryOptions, FetchStrategy, EntityManager } from 'breeze-client';
import { TestFns } from './test-fns';

TestFns.initServerEnv();

beforeAll(async () => {
  await TestFns.initDefaultMetadataStore();

});

// NOTE: Promises and async 'done' are DELIBERATELY used in this test file.  Do not try to convert to 'await'.
// It will break the intent. 

describe("EntityManager Save Sync", () => {

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

  

});
