import { config } from '../src/config';
import { Validator } from '../src/validate';


describe("Validator", function () {

  beforeEach(function () {
  });

  it("should be able to register a validator", function () {

    let factory = createNumericRangeValidatorFactory();
    debugger;
    Validator.registerFactory(factory, "numericRange");

    let factory2 = config.getRegisteredFunction("Validator.numericRange");
    expect(factory2).toEqual(factory);
  });
});

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
