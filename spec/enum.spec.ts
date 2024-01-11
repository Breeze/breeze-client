// import { BreezeEnum } from '../src/enum';
import { BreezeEnum, EntityAction, EntityState, assertParam } from 'breeze-client';


class DayOfWeek extends BreezeEnum {
  declare dayIndex: number;
  declare isWeekend?: boolean;
  nextDay() {
      let nextIndex = (this.dayIndex + 1) % 7;
      return DayOfWeek.getSymbols()[nextIndex];
  }

  static Monday = new DayOfWeek( { dayIndex: 0});
  static Tuesday = new DayOfWeek( { dayIndex: 1 });
  static Wednesday = new DayOfWeek( { dayIndex: 2 });
  static Thursday = new DayOfWeek( { dayIndex: 3 });
  static Friday = new DayOfWeek( { dayIndex: 4 });
  static Saturday = new DayOfWeek( { dayIndex: 5, isWeekend: true });
  static Sunday = new DayOfWeek( { dayIndex: 6, isWeekend: true });

}

describe("Breeze Enums", () => {

   test("should support full enum capabilities", () => {
    // // custom methods
      let dowSymbols = DayOfWeek.getSymbols();
      expect(dowSymbols.length).toBe(7);
      
      expect(DayOfWeek.Monday.nextDay()).toBe(DayOfWeek.Tuesday);
      expect(DayOfWeek.Sunday.nextDay()).toBe(DayOfWeek.Monday);
    // // custom properties
      expect(DayOfWeek.Tuesday.isWeekend).toBe(undefined);
      expect(DayOfWeek.Saturday.isWeekend).toBe(true);
    // // Standard enum capabilities
      expect(DayOfWeek.Thursday instanceof DayOfWeek).toBe(true);
      // expect(BreezeEnum.isSymbol(DayOfWeek.Wednesday)).toBe(true);
      expect(DayOfWeek.contains(DayOfWeek.Thursday)).toBe(true);
      let json = DayOfWeek.Wednesday.toJSON();
      expect(json._$typeName).toBe('DayOfWeek');

      expect(DayOfWeek.Friday.toString()).toBe("Friday");
    });

    test("EntityAction - should have static members", () => {
      expect(EntityAction.contains(EntityAction.Attach));
      // expect(EntityAction.name).toBe("EntityAction");
      expect(EntityAction.Attach.name).toBe("Attach");
      expect(EntityAction.Attach instanceof EntityAction);
      expect(EntityAction.Attach.isAttach()).toBe(true);
      expect(EntityAction.Attach.isDetach()).toBe(false);
      expect(EntityAction.Detach.isAttach()).toBe(false);
      expect(EntityAction.Detach.isDetach()).toBe(true);
    });

    test("EntityState - should have static members", () => {
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