// import { breeze } from '../src/breeze';
// import { core } from '../src/core';
import { breeze, core } from 'breeze-client';


describe("Core", () => {

  test("should support strong typing at top level", () => {
    let fn1 = breeze.core.arrayFirst;
    let fn2 = core.arrayFirst;
    expect(fn1).not.toBe(null);
    expect(fn1).toEqual(fn2);

  });


});