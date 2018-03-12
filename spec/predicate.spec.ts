import { Predicate } from '../src/predicate';

declare let console: any;

describe("Predicate", () => {

   it("should support both new and old ctor mechs", function() {
      let p1 = new Predicate("CompanyName", "StartsWith", "B");
      let p2 = (Predicate as any)("CompanyName", "StartsWith", "B"); // calling without ctor
      let p3 = Predicate.create("CompanyName", "startsWith", "B");
      let p4 = Predicate.create(["CompanyName", "StartsWith", "B"]);
      let p5 = Predicate.create({ CompanyName: { startsWith: "B"}} );
      let p6 = (Predicate as any)({ CompanyName: { StartsWith: "B"}} ); // calling without ctor
      expect(p1.toString()).toEqual(p2.toString());
      expect(p1.toString()).toEqual(p3.toString());
      expect(p1.toString()).toEqual(p4.toString());
      expect(p1.toString()).toEqual(p5.toString());
      expect(p1.toString()).toEqual(p6.toString());

    });

    it("should support toJson", function() {
      let p1 = new Predicate("CompanyName", "StartsWith", "B");
      let json = p1.toJSON();
      let s = JSON.stringify(json);
      console.log('\ntest');
      console.log(s);
    });

});