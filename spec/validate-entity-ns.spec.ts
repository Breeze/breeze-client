import { EntityManager, EntityType, ComplexType, EntityState, EntityAction, EntityChangedEventArgs, breeze, MetadataStore, SaveOptions, QueryOptions, ValidationOptions, Entity, DataType, core, EntityKey, RelationArray, MergeStrategy, AnyAllPredicate, EntityQuery, QueryResult, StructuralType, EntityProperty, DataProperty, NavigationProperty, EntityAspect, PropertyChangedEventArgs, Validator, ValidationError, ValidationErrorsChangedEventArgs } from 'breeze-client';
import { ModelLibraryBackingStoreAdapter } from 'breeze-client/adapter-model-library-backing-store';
import { TestFns, JsonObj } from './test-fns';
import 'jest-extended';


ModelLibraryBackingStoreAdapter.register();

TestFns.initNonServerEnv();

describe("Entity operations - no server", () => {

  beforeEach(function () {
    TestFns.initSampleMetadataStore();
  });

  test("scalar navigation property validation", function () {
    const newMs = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(newMs);
    const orderType = em.metadataStore.getEntityType("Order");
    const custProp = orderType.getProperty("customer");
    const valFn = function (v: any) {
      if (v == null) return true;
      const companyName = v.getProperty("companyName");
      return breeze.core.stringStartsWith(companyName, "C");
    };
    const customerValidator = new Validator("customerValidator", valFn, { messageTemplate: "'%displayName%'.companyName must start with 'C'" });
    custProp.validators.push(customerValidator);
    const cust1 = em.createEntity("Customer");
    cust1.setProperty("companyName", "ABC");
    const cust2 = em.createEntity("Customer");
    cust2.setProperty("companyName", "CDE");
    const order1 = em.createEntity("Order", { customer: cust1 });
    const isOk = order1.entityAspect.validateEntity();
    expect(isOk).toBe(false);
    let valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(valErrors[0].errorMessage).toEndWith("with 'C'");
    order1.setProperty("customer", cust2);
    valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);


  });

  test("nonscalar navigation property validation", function () {
    const newMs = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(newMs);

    const customerType = em.metadataStore.getEntityType("Customer");
    const ordersProp = customerType.getProperty("orders");
    // create a validator that insures that all orders on a customer have a freight cost > $100
    const valFn = function (v: any) {
      // v will be a list of orders
      if (v.length === 0) return true; // ok if no orders
      return v.every(function (order: Entity) {
        const freight = order.getProperty("freight");
        return freight > 100;
      });
    };
    const ordersValidator = new Validator("ordersValidator", valFn, { messageTemplate: "All of the orders for this customer must have a freight cost > 100" });
    ordersProp.validators.push(ordersValidator);
    const cust1 = em.createEntity("Customer");
    cust1.setProperty("companyName", "ABC");
    const order1 = em.createEntity("Order", { customer: cust1, freight: 200 });
    const order2 = em.createEntity("Order", { customer: cust1, freight: 99 });
    const isOk = cust1.entityAspect.validateEntity();
    expect(isOk).toBe(false);
    let valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(valErrors[0].errorMessage).toStartWith("All of the orders");
    order2.setProperty("freight", 101);
    // need to force a customer validation error
    cust1.entityAspect.validateEntity();
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);

  });

  test("int32 validation with custom error", function () {
    const em = TestFns.newEntityManager();
    const emp = createNewEmp(em);
    let errs = emp.entityAspect.getValidationErrors();
    expect(errs.length).toBe(0);
    emp.setProperty("rowVersion", 9999999999999);
    errs = emp.entityAspect.getValidationErrors();
    expect(errs.length).toBe(1);
    expect(errs[0].errorMessage).toMatch(/integer between the values/);

    Validator.messageTemplates["int32"] = "'%displayName%' must be an int32 value";
    const newMs = MetadataStore.importMetadata(em.metadataStore.exportMetadata());
    const em2 = TestFns.newEntityManager(newMs);
    const emp2 = createNewEmp(em2);
    emp2.setProperty("rowVersion", 8888888888888);
    errs = emp2.entityAspect.getValidationErrors();
    expect(errs.length).toBe(1);
    expect(errs[0].errorMessage).toMatch(/must be an int32/);

    emp2.setProperty("rowVersion", 7);
    errs = emp2.entityAspect.getValidationErrors();
    expect(errs.length).toBe(0);
  });



  /*********************************************************
   * Can call getValidationErrors('someProperty) when have entity errors
   * Defect #2552 Null reference exception in getValidationErrors
   * MOVE THIS TEST TO BREEZE's OWN TESTS
   *********************************************************/
  test("can call getValidationErrors('someProperty) when have entity errors", function () {
    const em = TestFns.newEntityManager();

    const cust = em.createEntity('Customer', {
      CustomerID: breeze.core.getUuid()
    }, breeze.EntityState.Unchanged);

    // We need a validator to make a ValidationError
    // but it could be anything and we won't bother to register it
    const fakeValidator = new Validator(
      "fakeValidator",
      function () {
        return false;
      },
      { message: "You are always wrong!" }
    );


    // create a fake error
    const fakeError = new ValidationError(
      fakeValidator,                // the marker validator
      {},                           // validation context
      "You were wrong this time!"   // error message
    );

    // add the fake error
    cust.entityAspect.addValidationError(fakeError);

    // Act & Assert
    let property: string = undefined;
    let errs = cust.entityAspect.getValidationErrors(property);
    expect(errs.length).toBeGreaterThan(0);

    property = 'someProperty';
    errs = cust.entityAspect.getValidationErrors(property);
    expect(errs.length).toBe(0);
  });


  test("customize validation display name", function () {
    const newMs = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(newMs);
    const custType = em.metadataStore.getAsEntityType("Customer");
    const dp = custType.getProperty("companyName");
    dp.displayName = "xxx Company name xxx";
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let s = "long value long value";
    s = s + s + s + s + s + s + s + s + s + s + s + s;
    cust1.setProperty("companyName", s);
    const errors = cust1.entityAspect.getValidationErrors();
    expect(errors[0].errorMessage).toMatch(/xxx Company name xxx/);

  });


  test("Remove a rule", function () {
    const newMs = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(newMs);

    const alwaysWrong = new Validator(
      "alwaysWrong",
      function () {
        return false;
      },
      { message: "You are always wrong!" }
    );

    const custType = em.metadataStore.getAsEntityType("Customer");
    const custValidators = custType.validators;

    // add alwaysWrong to the entity (not to a property)
    custValidators.push(alwaysWrong);

    const cust = custType.createEntity({ companyName: "Presumed Guilty" });

    // Attach triggers entity validation by default
    em.attachEntity(cust);

    let errs = cust.entityAspect.getValidationErrors();
    expect(errs.length).not.toBe(0);

    // remove validation rule
    custValidators.splice(custValidators.indexOf(alwaysWrong), 1);

    // Clear out the "alwaysWrong" error
    // Must do manually because that rule is now gone
    // and, therefore, can't cleanup after itself
    const valKey = ValidationError.getKey(alwaysWrong);
    cust.entityAspect.removeValidationError(valKey);

    cust.entityAspect.validateEntity(); // re-validate

    errs = cust.entityAspect.getValidationErrors();
    expect(errs.length).toBe(0);
  });

  test("Attached employee validation errors raised when properties set to bad values", function () {
    expect.assertions(8); // asserts about validation errors

    const em = TestFns.newEntityManager();  // new empty EntityManager
    const empType = em.metadataStore.getAsEntityType("Employee");
    const employeeKeyName = TestFns.wellKnownData.keyNames.employee;

    const employee = empType.createEntity() as Entity; // created but not attached
    employee.setProperty(employeeKeyName, TestFns.wellKnownData.dummyEmployeeID);
    employee.setProperty("firstName", "John");
    employee.setProperty("lastName", "Doe");

    // enter the cache as 'Unchanged'
    em.attachEntity(employee);

    // Start monitoring validation error changes
    employee.entityAspect
      .validationErrorsChanged.subscribe(assertValidationErrorsChangedRaised);

    employee.setProperty("lastName", null); // 1. LastName is required

    employee.setProperty("birthDate", new Date()); // ok date

    employee.setProperty("birthDate", null); // ok. no problem; it's nullable

    employee.setProperty("birthDate", "today"); // 2. Nice try! Wrong data type

    employee.setProperty(employeeKeyName, null); // 3. Id is the pk; automatically required

    employee.setProperty("lastName",          // 4. adds "too long", 5. removes "required",
      "IamTheGreatestAndDontYouForgetIt");

    employee.entityAspect.rejectChanges(); // (6, 7, 8) remove ID, Date, LastName errs
  });



  test("numeric validators - disallow string", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const empType = em.metadataStore.getAsEntityType("Employee");
    const extnProp = empType.getDataProperty("extension");
    const emp = empType.createEntity();
    const vo = em.validationOptions.using({ validateOnAttach: false });
    em.setProperties({ validationOptions: vo });
    em.attachEntity(emp);
    extnProp.validators.push(Validator.number());
    emp.setProperty("extension", "456");
    const valErrors = emp.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(valErrors[0].errorMessage).toMatch(/number/);
  });

  test("numeric validators - allow string", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const empType = em.metadataStore.getAsEntityType("Employee");
    const extnProp = empType.getDataProperty("extension");
    const emp = empType.createEntity();
    const vo = em.validationOptions.using({ validateOnAttach: false });
    em.setProperties({ validationOptions: vo });
    em.attachEntity(emp);
    extnProp.validators.push(Validator.number({ allowString: true }));
    emp.setProperty("extension", "456");
    let valErrors = emp.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    emp.setProperty("extension", "x456");
    valErrors = emp.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(valErrors[0].errorMessage).toMatch(/number/);
  });

  test("validate props", function () {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let s = "long value long value";
    s = s + s + s + s + s + s + s + s + s + s + s + s;
    cust1.setProperty("companyName", s);
    expect(cust1.entityAspect.getValidationErrors().length).toBe(1);
    let valErrors = cust1.entityAspect.getValidationErrors();
    const errMessage = valErrors[0].errorMessage;
    expect(errMessage).toMatch(/must be a string with 40 characters or less/);
    cust1.setProperty("companyName", "much shorter");
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    cust1.setProperty("companyName", "");
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
  });

  test("validate props - bad data types", function () {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let valErrorsChanged: ValidationErrorsChangedEventArgs;
    cust1.entityAspect.validationErrorsChanged.subscribe(function (args: ValidationErrorsChangedEventArgs) {
      expect(args.entity).toBe(cust1);
      valErrorsChanged = args;
    });

    cust1.setProperty("companyName", 222);
    // no longer a bug with DataType.parseString addition
    //expect(valErrorsChanged.added[0].property.name === "companyName");

    cust1.setProperty("rowVersion", "asdf");
    expect(valErrorsChanged.added[0].property.name).toBe("rowVersion");
    cust1.setProperty("rowVersion", 3);
    expect(valErrorsChanged.removed[0].property.name).toBe("rowVersion");

  });

  test("validationErrorsChanged event", function () {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let lastNotificationArgs: ValidationErrorsChangedEventArgs, emNotification;
    let notificationCount = 0;
    let emNotificationCount = 0;
    cust1.entityAspect.validationErrorsChanged.subscribe(function (args: ValidationErrorsChangedEventArgs) {
      lastNotificationArgs = args;
      notificationCount++;
    });
    let emLastNotification;
    em.validationErrorsChanged.subscribe(function (args) {
      emLastNotification = args;
      emNotificationCount++;
    });
    let s = "long value long value";
    s = s + s + s + s + s + s + s + s + s + s + s + s;
    cust1.setProperty("companyName", s);
    expect(lastNotificationArgs.added.length).toBeGreaterThan(0);
    expect(lastNotificationArgs).toBe(emLastNotification);
    expect(lastNotificationArgs.added[0].property.name).toBe("companyName");
    expect(lastNotificationArgs.removed[0].property.name).toBe("companyName");
    expect(notificationCount).toBe(1);
    cust1.setProperty("companyName", "much shorter");
    expect(lastNotificationArgs).toBe(emLastNotification);
    expect(lastNotificationArgs.removed.length).toBeGreaterThan(0);
    expect(lastNotificationArgs.removed[0].property.name).toBe("companyName");
    expect(notificationCount).toBe(2);
    cust1.setProperty("companyName", "");
    expect(lastNotificationArgs).toBe(emLastNotification);
    expect(lastNotificationArgs.added.length).toBeGreaterThan(0);
    expect(lastNotificationArgs.added[0].property.name).toBe("companyName");
    expect(notificationCount).toBe(3);
  });

  test("validationErrorsChanged event suppressed", function () {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let lastNotification;
    let notificationCount = 0;
    breeze.Event.enable("validationErrorsChanged", em, false);
    cust1.entityAspect.validationErrorsChanged.subscribe(function (args: ValidationErrorsChangedEventArgs) {
      lastNotification = args;
      notificationCount++;
    });
    let s = "long value long value";
    s = s + s + s + s + s + s + s + s + s + s + s + s;
    cust1.setProperty("companyName", s);
    cust1.setProperty("companyName", "much shorter");
    cust1.setProperty("companyName", "");
    expect(cust1.entityAspect.hasValidationErrors).toBe(true);
    expect(notificationCount).toBe(0);
  });

  test("get validationError for a property", function () {
    const em = TestFns.newEntityManager();
    const custType = em.metadataStore.getAsEntityType("Customer");
    const cust1 = custType.createEntity();
    em.attachEntity(cust1);
    let lastNotification;
    let notificationCount = 0;
    cust1.entityAspect.validationErrorsChanged.subscribe(function (args: ValidationErrorsChangedEventArgs) {
      lastNotification = args;
      notificationCount++;
    });
    let s = "long value long value";
    s = s + s + s + s + s + s + s + s + s + s + s + s;
    cust1.setProperty("companyName", s);
    expect(cust1.entityAspect.hasValidationErrors).toBe(true);
    let errors = cust1.entityAspect.getValidationErrors("companyName");
    expect(errors.length).toBe(1);
    errors = cust1.entityAspect.getValidationErrors("foo");
    expect(errors.length).toBe(0);
    errors = cust1.entityAspect.getValidationErrors(custType.getProperty("companyName"));
    expect(errors.length).toBe(1);
  });

  test("custom property validation", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const custType = ms.getAsEntityType("Customer");
    const prop = custType.getProperty("country");

    const valFn = function (v: any) {
      if (v === null) return true;
      return (core.stringStartsWith(v, "US"));
    };
    const countryValidator = new Validator("countryIsUS", valFn, { displayName: "Country", messageTemplate: "'%displayName%' must start with 'US'" });
    prop.validators.push(countryValidator);
    const cust1 = custType.createEntity();
    cust1.setProperty("country", "GER");
    em.attachEntity(cust1);
    expect(cust1.entityAspect.hasValidationErrors).toBe(true);
    let valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(2);
    cust1.setProperty("country", "US");
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    cust1.setProperty("country", null);
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    cust1.entityAspect.validateProperty("country");
    expect(valErrors.length).toBe(1);
  });

  test("custom entity validation", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const custType = ms.getAsEntityType("Customer");

    const zipCodeValidator = createZipCodeValidatorFactory()();
    custType.validators.push(zipCodeValidator);

    const cust1 = custType.createEntity();
    cust1.setProperty("companyName", "Test1Co");
    cust1.setProperty("country", "GER");
    em.attachEntity(cust1);
    let valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    cust1.setProperty("country", "USA");
    expect(cust1.entityAspect.hasValidationErrors).toBe(false);
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    const isOk = cust1.entityAspect.validateEntity();
    expect(isOk).toBe(false);
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(cust1.entityAspect.hasValidationErrors).toBe(true);
  });

  test("custom entity validation - register validator", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const custType = ms.getEntityType("Customer");

    const zipCodeValidatorFactory = createZipCodeValidatorFactory();
    const zipCodeValidator = zipCodeValidatorFactory();
    custType.validators.push(zipCodeValidator);

    const msSerialized = em.metadataStore.exportMetadata();

    Validator.register(zipCodeValidator);
    const newMs = MetadataStore.importMetadata(msSerialized);
    const em2 = TestFns.newEntityManager(newMs);
    const custType2 = newMs.getAsEntityType("Customer");
    const cust1 = custType2.createEntity();
    cust1.setProperty("companyName", "Test1Co");
    cust1.setProperty("country", "GER");
    em2.attachEntity(cust1);
    expect(cust1.entityAspect.hasValidationErrors).toBe(false);
    let valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    cust1.setProperty("country", "USA");
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(cust1.entityAspect.hasValidationErrors).toBe(false);
    expect(valErrors.length).toBe(0);
    const isOk = cust1.entityAspect.validateEntity();
    expect(isOk).toBe(false);
    expect(cust1.entityAspect.hasValidationErrors).toBe(true);
    valErrors = cust1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
  });

  test("custom property numeric range validation", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const orderType = ms.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const freightProperty = orderType.getProperty("freight");

    const numericRangeValidatorFactory = createNumericRangeValidatorFactory();

    freightProperty.validators.push(numericRangeValidatorFactory({ min: 100, max: 500 }));
    const order1 = orderType.createEntity();
    order1.setProperty(orderKeyName, TestFns.wellKnownData.dummyOrderID);
    em.attachEntity(order1);
    let valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    order1.setProperty("freight", 0);
    valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    expect(order1.entityAspect.hasValidationErrors).toBe(true);
    const ix = valErrors[0].errorMessage.indexOf("between the values of 100 and 500");
    order1.setProperty("freight", 200);
    valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    expect(order1.entityAspect.hasValidationErrors).toBe(false);
  });

  test("custom property numeric range validation - register validatorFactory", function () {
    const ms = MetadataStore.importMetadata(TestFns.sampleMetadata);
    const em = TestFns.newEntityManager(ms);
    const orderType = ms.getAsEntityType("Order");
    const orderKeyName = TestFns.wellKnownData.keyNames.order;
    const freightProperty = orderType.getProperty("freight");

    const numericRangeValidatorFactory = createNumericRangeValidatorFactory();
    freightProperty.validators.push(numericRangeValidatorFactory({ min: 100, max: 500 }));

    const serializedEm = em.exportEntities();
    Validator.registerFactory(numericRangeValidatorFactory, "numericRange");

    const em2 = EntityManager.importEntities(serializedEm);
    const orderType2 = em2.metadataStore.getAsEntityType("Order");
    const order1 = orderType2.createEntity();
    order1.setProperty(orderKeyName, TestFns.wellKnownData.dummyOrderID);
    em2.attachEntity(order1);
    let valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);
    order1.setProperty("freight", 0);
    valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(1);
    const ix = valErrors[0].errorMessage.indexOf("between the values of 100 and 500");
    order1.setProperty("freight", 200);
    valErrors = order1.entityAspect.getValidationErrors();
    expect(valErrors.length).toBe(0);

  });

  function createZipCodeValidatorFactory() {
    return function () {
      // v in this case will be a Customer entity
      const valFn = function (v: any) {
        // This validator only validates US Zip Codes.
        if (v.getProperty("country") === "USA") {
          const postalCode = v.getProperty("postalCode");
          return isValidZipCode(postalCode);
        }
        return true;
      };
      const zipCodeValidator = new Validator("zipCodeValidator", valFn,
        { messageTemplate: "For the US, this is not a valid PostalCode" });
      return zipCodeValidator;
    };
  }

  function createNumericRangeValidatorFactory() {
    const validatorFactory = function (context: any) {
      const valFn = function (v: any, ctx: any) {
        if (v == null) return true;
        if (typeof (v) !== "number") return false;
        if (ctx.min != null && v < ctx.min) return false;
        if (ctx.max != null && v > ctx.max) return false;
        return true;
      };
      return new Validator("numericRange", valFn, {
        messageTemplate: "'%displayName%' must be an integer between the values of %min% and %max%",
        min: context.min,
        max: context.max
      });
    };
    return validatorFactory;
  }

  function isValidZipCode(value: string) {
    const re = /^\d{5}([\-]\d{4})?$/;
    return (re.test(value));
  }

  function assertValidationErrorsChangedRaised(errorsChangedArgs: ValidationErrorsChangedEventArgs) {

    const addedMessages = errorsChangedArgs.added.map(function (a) {
      return a.errorMessage;
    });
    const addedCount = addedMessages.length;
    if (addedCount > 0) {
      expect(true).toBe(true); // just to add to expected errors count
    }

    const removedMessages = errorsChangedArgs.removed.map(function (r) {
      return r.errorMessage;
    });
    const removedCount = removedMessages.length;
    if (removedCount > 0) {
      expect(true).toBe(true); // just to add to expected errors count
    }
  }

  function createNewEmp(em: EntityManager) {
    const empType = em.metadataStore.getAsEntityType("Employee");
    const employee = empType.createEntity(); // created but not attached
    employee.setProperty(TestFns.wellKnownData.keyNames.employee, TestFns.wellKnownData.dummyEmployeeID);
    employee.setProperty("firstName", "John");
    employee.setProperty("lastName", "Doe");
    // enter the cache as 'Unchanged'
    em.attachEntity(employee);
    return employee;
  }

});