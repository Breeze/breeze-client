// import { BreezeEnum } from '../src/enum';
import { BreezeEnum } from 'breeze-client';


class DayOfWeek extends BreezeEnum {
  dayIndex: number;
  isWeekend?: boolean;
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

class EntityState extends BreezeEnum {
  isGood: boolean;
  static Added = new EntityState({ isGood: true });
  static Modified = new EntityState({ isGood: true });
  static Deleted = new EntityState({ isGood: false });
}


describe("DayOfWeek2", () => {

   test("should support full enum capabilities", () => {
    // // custom methods
      let dowSymbols = DayOfWeek.getSymbols();
      let esSymbols = EntityState.getSymbols();
      expect(dowSymbols.length).toBe(7);
      expect(esSymbols.length).toBe(3);
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

});