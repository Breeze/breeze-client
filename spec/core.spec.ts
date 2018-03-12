import { breeze } from '../src/breeze';
import { core } from '../src/core';

// declare let console: any;

describe("Core", () => {

  it("should support strong typing at top level", function () {
    let fn1 = breeze.core.arrayFirst;
    let fn2 = core.arrayFirst;
    expect(fn1).not.toBe(null);
    expect(fn1).toEqual(fn2);

  });


});