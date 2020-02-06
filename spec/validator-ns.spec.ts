// import { config } from '../src/config';
// import { Validator } from '../src/validate';

import { config, Validator, ValidationOptions } from 'breeze-client';

describe("Validator", () => {

  beforeEach(function () {
  });

  test("should be able to register a validator", () => {

    let factory = createNumericRangeValidatorFactory();
    Validator.registerFactory(factory, "numericRange");

    let factory2 = config.getRegisteredFunction("Validator.numericRange");
    expect(factory2).toEqual(factory);
  });

  test("validation options", function () {
    let vo = ValidationOptions.defaultInstance;
    const origVo = vo.using({});
    expect(vo.validateOnQuery).toBe(false);
    expect(vo.validateOnSave).toBe(true);
    vo = vo.using({ validateOnQuery: true, validateOnSave: false });
    expect(vo.validateOnQuery).toBe(true);
    expect(vo.validateOnSave).toBe(false);
    vo.setAsDefault();
    expect(ValidationOptions.defaultInstance.validateOnQuery).toBe(true);
    expect(ValidationOptions.defaultInstance.validateOnSave).toBe(false);
    origVo.setAsDefault();
  });

  test("string validation - custom messages", function () {
    const v0 = Validator.maxLength({ maxLength: 5, displayName: "City" });
    const r0 = v0.validate("asdf");
    expect(r0 === null);
    const r0a = v0.validate("adasdfasdf");
    let err = r0a.errorMessage;
    expect(err.indexOf("City") >= 0 && err.indexOf("5") >= 0).toBe(true);

    const v1 = Validator.maxLength({ maxLength: 5, message: "City > 5" });
    const r1 = v1.validate("2342343242");
    expect(r1.errorMessage).toBe("City > 5");

    const v2 = Validator.maxLength({
      maxLength: 5,
      messageTemplate: "Invalid %displayName%: '%value%' is longer than %maxLength% chars",
      displayName: "City"
    });
    const r2 = v2.validate("Try this value");
    err = r2.errorMessage;
    expect(err.indexOf("Invalid") >= 0 && err.indexOf("Try this value") >= 0 && err.indexOf("5") >= 0).toBe(true);

    const v3 = Validator.maxLength({ maxLength: 5 });
    const r3 = v3.validate("2342342");
    expect(r3.errorMessage).toContain("Value");

    const customMessageFn = function (args: any) {
      return "Custom message: " + args.name + " value:" + args.value +
        " messageTemplate: " + args.messageTemplate +
        " displayName: " + args.displayName;
    };
    const v4 = Validator.maxLength({ maxLength: 5, message: customMessageFn, displayName: "Foo" });
    const r4 = v4.validate("123456");
    err = r4.errorMessage;
    expect(err.indexOf("Foo") >= 0 && err.indexOf("123456") >= 0);

  });

  test("required validation", function () {
    const v0 = Validator.required();
    const r0 = v0.validate("asdf");
    expect(r0 === null);
    const r0a = v0.validate("");
    expect(r0a.errorMessage).toMatch(/required/);
    const data: any = {};
    const r0b = v0.validate(data.notThere);
    expect(r0b.errorMessage).toMatch(/required/);

  });

  test("required validation allow empty strings", function () {
    const v0 = Validator.required({ allowEmptyStrings: true });
    const r0 = v0.validate("asdf");
    expect(r0 === null);
    const r0a = v0.validate("");
    expect(r0 === null);
    const data: any = {};
    const r0b = v0.validate(data.notThere);
    expect(r0b.errorMessage).toMatch(/required/);

  });

  test("replace required validation", function () {
    const oldVal = Validator.required;
    try {
      Validator.required = function (context) {
        const valFn = function (v: any, ctx: any) {
          return v != null;
        };
        return new Validator("required", valFn, context);
      };
      Validator.registerFactory(Validator.required, "required");
      const v0 = Validator.required();
      const r0 = v0.validate("asdf");
      expect(r0 === null);
      const r0a = v0.validate("");
      expect(r0 === null);
      const data: any = {};
      const r0b = v0.validate(data.notThere);
      expect(r0b.errorMessage).toMatch(/required/);
    } finally {
      Validator.required = oldVal;
      Validator.registerFactory(Validator.required, "required");
    }

  });


  test("stringLength validation", function () {
    const v0 = Validator.stringLength({ minLength: 2, maxLength: 7 });
    let r0 = v0.validate("asdf");
    expect(r0 === null);
    expect(v0.validate("1234567") === null);

    expect(v0.validate(null) === null);
    expect(v0.validate("a")).toBeTruthy();
    r0 = v0.validate("a");
    expect(r0.errorMessage).toBe(v0.getMessage());

    const v1 = Validator.stringLength({ minLength: 2, maxLength: 7, messageTemplate: "%value% is invalid. Must be between %minLength% AND %maxLength% chars" });
    const r1 = v1.validate("12345678");
    const err = r1.errorMessage;
    expect(err.indexOf("12345678") >= 0 && err.indexOf("between 2 AND 7") >= 0).toBe(true);

  });

  test("date validation", function () {
    const v0 = Validator.date();
    let r = v0.validate("asdf");
    expect(r != null).toBe(true);
    r = v0.validate("1234567");
    expect(r != null).toBe(true);
    expect(v0.validate(null) === null);
    r = v0.validate(new Date(2001, 9, 11));
    expect(r).toBeNull();
  });

  test("custom validation message", function () {
    Validator['min'] = function (context: any) {
      const fn = function (val: any, ctx: any) {
        return val >= ctx.min;
      };
      return new Validator('min', fn, context);
    };
    Validator.messageTemplates['min'] = "Insert value >= %min%";
    const v0 = Validator['min']({ min: 0 });
    const r = v0.validate(-3);
    expect(r != null).toBe(true);
    expect(r.errorMessage).toMatch(/>= 0/);

  });

  test("creditCard validation", function () {
    const v0 = Validator.creditCard();
    valFail(v0, "asdf");
    valFail(v0, "4388576020733634");

    valGood(v0, null);
    valGood(v0, "4388576020733633");
  });

  test("emailAddress validation", function () {
    const v0 = Validator.emailAddress();
    valFail(v0, "asdf");
    valFail(v0, "1234567");
    valFail(v0, "john.doe@abc"); // missing '.com'

    valGood(v0, null);
    valGood(v0, "john.doe@abc.com");
  });

  test("phone validation", function () {
    const v0 = Validator.phone();
    valFail(v0, "asdf");
    valFail(v0, "Pennsylvania 6500");
    valFail(v0, "5");

    valGood(v0, null);
    valGood(v0, "(510) 686-8275");
    valGood(v0, "01 510 686-8275");
    valGood(v0, "+1 510 686-8275");

    // these pass too. You might not expect that
    valGood(v0, "51");
    valGood(v0, "1234567");
    valGood(v0, "123456789012345678901234567890");
  });

  test("regularExpression validation for a US State abbreviation", function () {
    const v0 = Validator.regularExpression({ expression: '^[A-Z]{2}$' });
    valFail(v0, "asdf");
    valFail(v0, "1234567");
    valFail(v0, "ca");
    valFail(v0, "C1");

    valGood(v0, null);
    valGood(v0, "CA");
  });

  test("url validation", function () {
    const v0 = Validator.url();
    valFail(v0, "asdf");
    valFail(v0, "1234567");
    valFail(v0, "traband.contoso.com"); // missing protocol


    valGood(v0, "http://traband");
    valGood(v0, null);
    valGood(v0, "http://traband.contoso.com");
    valGood(v0, "https://traband.contoso.com");
    valGood(v0, "ftp://traband.contoso.com");
    valGood(v0, "http://traband.contoso.commiepinko");
  });

  // from CCJS
  test("makeRegExpValidator creates a twitter validator", function () {
    const v0 = Validator.makeRegExpValidator(
      'twitter', /^@([a-zA-Z]+)([a-zA-Z0-9_]+)$/,
      "Invalid Twitter User Name: '%value%'");

    valFail(v0, "asdf");
    valFail(v0, "1234567");
    valFail(v0, "@1234567");
    valFail(v0, "a@b1234567");
    valFail(v0, "@J");

    valGood(v0, null);
    valGood(v0, "@jaytraband");
    valGood(v0, "@Jay_Traband22");
    valGood(v0, "@b1234567");
  });

  // from the example in the code
  test("makeRegExpValidator creates a zip validator", function () {
    const v0 = Validator.makeRegExpValidator(
      'zipVal', /^\d{5}([\-]\d{4})?$/,
      "The %displayName% '%value%' is not a valid U.S. zipcode");

    valFail(v0, "asdf");
    valFail(v0, "1234567");

    valGood(v0, null);
    valGood(v0, "94801");
    valGood(v0, "94801-1234");
  });

  function valFail(validator: Validator, arg: any) {
    const r = validator.validate(arg);
    expect(r != null).toBe(true);
    expect(r.errorMessage.length).toBeGreaterThanOrEqual(0);
    
  }

  function valGood(validator: Validator, arg: any) {
    const r = validator.validate(arg);
    expect(r == null).toBe(true);
  }


  function createNumericRangeValidatorFactory() {
    let validatorFactory = function (context: any) {
      let valFn = function (v: number, ctx: any) {
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


});