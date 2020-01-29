
// import { EntityAction } from '../src/entity-action';
import { EntityAction } from 'breeze-client';

describe("EntityAction", () => {

  beforeEach(function () {

  });

  test("should have static members", () => {
    expect(EntityAction.contains(EntityAction.Attach));
    // expect(EntityAction.name).toBe("EntityAction");
    expect(EntityAction.Attach.name).toBe("Attach");
    expect(EntityAction.Attach instanceof EntityAction);
    expect(EntityAction.Attach.isAttach()).toBe(true);
    expect(EntityAction.Attach.isDetach()).toBe(false);
    expect(EntityAction.Detach.isAttach()).toBe(false);
    expect(EntityAction.Detach.isDetach()).toBe(true);
  });
});