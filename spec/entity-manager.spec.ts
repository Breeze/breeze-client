
import { EntityManager } from '../src/entity-manager';
// import jasmine from 'jasmine';

describe("EntityManager", function() {


  beforeEach(function() {

  });

  it("should be able to create", function() {
    let em = new EntityManager('test');
    let r = em.getChanges();
    expect(r.length).toBe(0);

  });
});