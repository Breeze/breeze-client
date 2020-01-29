// import { EntityAction } from './../src/entity-action';
// import { assertParam } from './../src/assert-param';
import { EntityAction, EntityState  } from 'breeze-client';
import { assertParam } from 'breeze-client';

describe("EntityState", () => {
  beforeEach(function () {

  });

  test("should have static members", () => {
    expect(EntityState.contains(EntityState.Modified));
    expect(EntityState.fromName('Added')).toBe(EntityState.Added);
    let est = EntityState;
    let nm = est.Added.name;
    if (nm == null) {
      fail("should not get here");
    }
    expect(EntityState.Added.name).toBe("Added");
    expect(EntityState.Added instanceof EntityState).toBe(true);
    expect(EntityState.Added.constructor).toBe(EntityState);
    let es = EntityState.Detached;
    assertParam(es, "entityState").isEnumOf(EntityState).check();
    try {
      assertParam(es, "entityState").isEnumOf(EntityAction).check();
      fail("should not get here");
    } catch (e) {
      // should get here
    }
  });
});