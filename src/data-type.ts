import { core } from './core';
import { BreezeEnum } from './enum';
import { Validator } from './validate';

let _localTimeRegex = /.\d{3}$/;

/**  
DataType is an 'Enum' containing all of the supported data types.
@dynamic
**/
export class DataType extends BreezeEnum {
  /** The default value of this DataType. __Read Only__ **/
  declare defaultValue?: any;
  /** Whether this is a 'numeric' DataType. __Read Only__ **/
  declare isNumeric?: boolean;
  /** Whether this is an 'integer' DataType. __Read Only__ **/
  declare isInteger?: boolean;
  /** Whether to quote the json value when formatting this DataType for OData. */
  declare quoteJsonOData?: boolean;

  /** The constructor function to create a [[Validator]] to be used in validating instances of this DataType. */
  validatorCtor?(context?: any): Validator;
  /** 
  Optional function to normalize a data value for comparison, if its value cannot be used directly. 
  Note that this will be called each time a property is changed, so make it fast.
  @return value appropriate for this DataType
  **/
  normalize?(value: any): any;
  /**
  Optional function to convert a raw (server) value from string to this DataType.
  @return value appropriate for this DataType
  **/
  parseRawValue?(value: any): any;
  /**
  Optional function to convert a value from string to this DataType.  Note that this will be called each time a property is changed, so make it fast.
  @return value appropriate for this DataType 
  **/
  parse?(source: any, sourceTypeName: string): any;
  /** 
  Optional function to format this DataType for OData queries.
  @return value appropriate for OData query   
  **/
  fmtOData?(value: any): any;
  /** 
  Optional function to get the next value for key generation, if this datatype is used as a key.  Uses an internal table of previous values.
  @return value appropriate for this DataType 
  **/
  getNext?(): any;
  /**
  Optional function to get the next value when the datatype is used as a concurrency property.
  @param previousValue
  @return the next concurrency value, which may be a function of the previousValue.
  **/
  getConcurrencyValue?(previousValue?: any): any;

  static parseDateFromServer = (value: any) => DataType.parseDateAsUTC(value);
  // same effect as above but doesn't give right TSDOC.
  // static parseDateFromServer = DataType.parseDateAsUTC;

  /** @hidden @internal */
  static constants: { stringPrefix: string, nextNumber: number, nextNumberIncrement: number };

  static String = new DataType({
    defaultValue: "",
    parse: coerceToString,
    fmtOData: fmtString,
    getNext: getNextString
  });

  static Int64 = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isInteger: true,
    quoteJsonOData: true,
    parse: coerceToInt,
    fmtOData: makeFloatFmt("L"),
    getNext: getNextNumber
  });

  static Int32 = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isInteger: true,
    parse: coerceToInt,
    fmtOData: fmtInt,
    getNext: getNextNumber
  });

  static Int16 = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isInteger: true,
    parse: coerceToInt,
    fmtOData: fmtInt,
    getNext: getNextNumber
  });

  static Byte = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isInteger: true,
    parse: coerceToInt,
    fmtOData: fmtInt
  });

  static Decimal = new DataType({
    defaultValue: 0,
    isNumeric: true,
    quoteJsonOData: true,
    isFloat: true,
    parse: coerceToFloat,
    fmtOData: makeFloatFmt("m"),
    getNext: getNextNumber
  });

  static Double = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isFloat: true,
    parse: coerceToFloat,
    fmtOData: makeFloatFmt("d"),
    getNext: getNextNumber
  });

  static Single = new DataType({
    defaultValue: 0,
    isNumeric: true,
    isFloat: true,
    parse: coerceToFloat,
    fmtOData: makeFloatFmt("f"),
    getNext: getNextNumber
  });

  static DateOnly = new DataType({
    defaultValue: new Date(1900, 0, 1),
    isDate: true,
    parse: coerceToDate,
    parseRawValue: parseRawDate,
    normalize: function (value: any) { return value && value.getTime && (new Date(value.getYear(), value.getMonth(), value.getDate())).getTime(); }, // dates don't perform equality comparisons properly
    fmtOData: fmtDateTime,
    getNext: getNextDateTime,
    getConcurrencyValue: getConcurrencyDateTime
  });

  static DateTime = new DataType({
    defaultValue: new Date(1900, 0, 1),
    isDate: true,
    parse: coerceToDate,
    parseRawValue: parseRawDate,
    normalize: function (value: any) { return value && value.getTime && value.getTime(); }, // dates don't perform equality comparisons properly
    fmtOData: fmtDateTime,
    getNext: getNextDateTime,
    getConcurrencyValue: getConcurrencyDateTime
  });

  static DateTimeOffset = new DataType({
    defaultValue: new Date(1900, 0, 1),
    isDate: true,
    parse: coerceToDate,
    parseRawValue: parseRawDate,
    normalize: function (value: any) { return value && value.getTime && value.getTime(); }, // dates don't perform equality comparisons properly
    fmtOData: fmtDateTimeOffset,
    getNext: getNextDateTime,
    getConcurrencyValue: getConcurrencyDateTime
  });

  static Time = new DataType({
    defaultValue: "PT0S",
    fmtOData: fmtTime,
    parseRawValue: DataType.parseTimeFromServer
  });

  static Boolean = new DataType({
    defaultValue: false,
    parse: coerceToBool,
    fmtOData: fmtBoolean
  });

  static Guid = new DataType({
    defaultValue: "00000000-0000-0000-0000-000000000000",
    parse: coerceToGuid,
    fmtOData: fmtGuid,
    getNext: getNextGuid,
    parseRawValue: function (val: string) { return val.toLowerCase(); },
    getConcurrencyValue: core.getUuid
  });

  static Binary = new DataType({
    defaultValue: null,
    fmtOData: fmtBinary,
    parseRawValue: parseRawBinary
  });

  static Undefined = new DataType({
    defaultValue: undefined,
    fmtOData: fmtUndefined
  });

  static getComparableFn(dataType?: DataType) {
    if (dataType && dataType.normalize) {
      return dataType.normalize;
    } else if (dataType === DataType.Time) {
      // durations must be converted to compare them
      return function (value: any) {
        return value && core.durationToSeconds(value);
      };
    } else {
      // TODO: __identity
      return function (value: any) {
        return value;
      };
    }
  }

  /** Returns the DataType for a specified EDM type name.
  **/
  static fromEdmDataType(typeName: string) {
    let dt: DataType | undefined;
    let parts = typeName.split(".");
    if (parts.length > 1) {
      let simpleName = parts[1];
      if (simpleName === "image") {
        // hack
        dt = DataType.Byte;
      } else if (parts.length === 2) {
        dt = DataType.fromName(simpleName) || DataType.Undefined;
      } else {
        // enum
        // dt = DataType.Int32;
        dt = DataType.String;
      }
    }

    return dt;
  }

  /** Returns the DataType for a specified input. */
  static fromValue(val: any) {
    if (core.isDate(val)) return DataType.DateTime;
    switch (typeof val) {
      case "string":
        if (core.isGuid(val)) return DataType.Guid;
        // the >3 below is a hack to insure that if we are inferring datatypes that
        // very short strings that are valid but unlikely ISO encoded Time's are treated as strings instead.
        else if (core.isDuration(val) && val.length > 3) return DataType.Time;
        else if (core.isDateString(val)) return DataType.DateTime;
        return DataType.String;
      case "boolean":
        return DataType.Boolean;
      case "number":
        return DataType.Double;
    }
    return DataType.Undefined;
  }

  static parseTimeFromServer(source: any) {
    if (typeof source === 'string') {
      return source;
    }
    // ODATA v3 format
    if (source && source.__edmType === 'Edm.Time') {
      let seconds = Math.floor(source.ms / 1000);
      return 'PT' + seconds + 'S';
    }
    return source;
  }

  static parseDateAsUTC(source: any) {
    if (typeof source === 'string') {
      // convert to UTC string if no time zone specifier.
      let isLocalTime = _localTimeRegex.test(source);
      // var isLocalTime = !hasTimeZone(source);
      source = isLocalTime ? source + 'Z' : source;
    }
    source = new Date(Date.parse(source));
    return source;
  }


  /** Returns a raw value converted to the specified DataType */
  static parseRawValue(val: any, dataType?: DataType) {
    // undefined values will be the default for most unmapped properties EXCEPT when they are set
    // in a jsonResultsAdapter ( an unusual use case).
    if (val === undefined) return undefined;
    if (!val) return val;
    if (dataType && dataType.parseRawValue) {
      val = dataType.parseRawValue(val);
    }
    return val;
  }

  /** @hidden @internal */
  // used during initialization; visible on instance for testing purposes.
  static _resetConstants() {
    DataType.constants = {
      stringPrefix: "K_",
      nextNumber: -1,
      nextNumberIncrement: -1
    };
  }

  // NOT YET NEEDED --------------------------------------------------
  // var _utcOffsetMs = (new Date()).getTimezoneOffset() * 60000;

  //DataType.parseDateAsLocal = function (source) {
  //    var dt = DataType.parseDatesAsUTC(source);
  //    if (__isDate(dt)) {
  //        dt = new Date(dt.getTime() + _utcOffsetMs);
  //    }
  //    return dt;
  //};
}
DataType.prototype._$typeName = "DataType";
Error['x'] = DataType._resetConstants();
Error['x'] = DataType.resolveSymbols();
Error['x'] = DataType.getSymbols().forEach((sym: DataType) => sym.validatorCtor = getValidatorCtor(sym));

// private functions;


function getValidatorCtor(dataType: DataType) {
  switch (dataType) {
    case DataType.String:
      return Validator.string;
    case DataType.Int64:
      return Validator.int64;
    case DataType.Int32:
      return Validator.int32;
    case DataType.Int16:
      return Validator.int16;
    case DataType.Decimal:
      return Validator.number;
    case DataType.Double:
      return Validator.number;
    case DataType.Single:
      return Validator.number;
    case DataType.DateTime:
      return Validator.date;
    case DataType.DateTimeOffset:
      return Validator.date;
    case DataType.Boolean:
      return Validator.bool;
    case DataType.Guid:
      return Validator.guid;
    case DataType.Byte:
      return Validator.byte;
    case DataType.Binary:
      // TODO: don't quite know how to validate this yet.
      return Validator.none;
    case DataType.Time:
      return Validator.duration;
    case DataType.Undefined:
      return Validator.none;
  }
}

function getNextString() {
  return DataType.constants.stringPrefix + getNextNumber().toString();
}

function getNextNumber() {
  let result = DataType.constants.nextNumber;
  DataType.constants.nextNumber += DataType.constants.nextNumberIncrement;
  return result;
}

function getNextGuid() {
  return core.getUuid();
}

function getNextDateTime() {
  return new Date();
}

function getConcurrencyDateTime(val: any) {
  // use the current datetime but insure that it is different from previous call.
  let dt = new Date();
  let dt2 = new Date();
  while (dt.getTime() === dt2.getTime()) {
    dt2 = new Date();
  }
  return dt2;
}

function coerceToString(source: any, sourceTypeName?: string) {
  return (source == null) ? source : source.toString();
}

function coerceToGuid(source: any, sourceTypeName: string) {
  if (sourceTypeName === "string") {
    return source.trim().toLowerCase();
  }
  return source;
}

function coerceToInt(source: any, sourceTypeName: string) {
  if (sourceTypeName === "string") {
    let src = source.trim();
    if (src === "") return null;
    let val = parseInt(src, 10);
    return isNaN(val) ? source : val;
  } else if (sourceTypeName === "number") {
    return Math.round(source);
  }
  // do we want to coerce floats -> ints
  return source;
}

function coerceToFloat(source: any, sourceTypeName: string) {
  if (sourceTypeName === "string") {
    let src = source.trim();
    if (src === "") return null;
    let val = parseFloat(src);
    return isNaN(val) ? source : val;
  }
  return source;
}

function coerceToDate(source: any, sourceTypeName: string) {
  let val: any;
  if (sourceTypeName === "string") {
    let src = source.trim();
    if (src === "") return null;
    val = new Date(Date.parse(src));
    return core.isDate(val) ? val : source;
  } else if (sourceTypeName === "number") {
    val = new Date(source);
    return core.isDate(val) ? val : source;
  }
  return source;
}

function coerceToBool(source: any, sourceTypeName: string) {
  if (sourceTypeName === "string") {
    let src = source.trim().toLowerCase();
    if (src === "false" || src === "") {
      return false;
    } else if (src === "true") {
      return true;
    } else {
      return source;
    }
  }
  return source;
}

function fmtString(val: any) {
  return val == null ? null : "'" + val.replace(/'/g, "''") + "'";
}

function fmtInt(val: any) {
  return val == null ? null : ((typeof val === "string") ? parseInt(val, 10) : val);
}

function makeFloatFmt(fmtSuffix: string) {
  return function (val: any) {
    if (val == null) return null;
    if (typeof val === "string") {
      val = parseFloat(val);
    }
    return val + fmtSuffix;
  };
}

function fmtDateTime(val: Date) {
  if (val == null) return null;
  try {
    return "datetime'" + val.toISOString() + "'";
  } catch (e) {
    throwError("'%1' is not a valid dateTime", val);
  }
}

function fmtDateTimeOffset(val: Date) {
  if (val == null) return null;
  try {
    return "datetimeoffset'" + val.toISOString() + "'";
  } catch (e) {
    throwError("'%1' is not a valid dateTime", val);
  }
}

function fmtTime(val: any) {
  if (val == null) return null;
  if (!core.isDuration(val)) {
    throwError("'%1' is not a valid ISO 8601 duration", val);
  }
  return "time'" + val + "'";
}

function fmtGuid(val: any) {
  if (val == null) return null;
  if (!core.isGuid(val)) {
    throwError("'%1' is not a valid guid", val);
  }
  return "guid'" + val + "'";
}

function fmtBoolean(val: any) {
  if (val == null) return null;
  if (typeof val === "string") {
    return val.trim().toLowerCase() === "true";
  } else {
    return !!val;
  }
}

function fmtBinary(val: any) {
  if (val == null) return val;
  return "binary'" + val + "'";
}

// TODO: use __identity instead;
function fmtUndefined(val: any) {
  return val;
}

function throwError(msg: string, val: any) {
  msg = core.formatString(msg, val);
  throw new Error(msg);
}

function parseRawDate(val: any) {
  if (!core.isDate(val)) {
    val = DataType.parseDateFromServer(val);
  }
  return val;
}

function parseRawBinary(val: any) {
  if (val && val.$value !== undefined) {
    val = val.$value; // this will be a byte[] encoded as a string
  }
  return val;
}

//function hasTimeZone(source) {
//  var ix = source.indexOf("T");
//  var timePart = source.substring(ix+1);
//  return  timePart.indexOf("-") >= 0 || timePart.indexOf("+") >= 0 || timePart.indexOf("Z");
//}
