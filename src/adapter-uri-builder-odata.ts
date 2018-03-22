import * as breeze from './breeze';

export class UriBuilderODataAdapter implements breeze.UriBuilderAdapter {

  name: string;

  constructor() {
    this.name = "odata";
  }

  initialize() { }

  buildUri(entityQuery: breeze.EntityQuery, metadataStore: breeze.MetadataStore) {
    // force entityType validation;
    let entityType = entityQuery._getFromEntityType(metadataStore, false);
    if (!entityType) {
      // anonymous type but still has naming convention info avail
      entityType = new breeze.EntityType(metadataStore);
    }

    let queryOptions = {};
    queryOptions["$filter"] = toWhereODataFragment(entityQuery.wherePredicate);
    queryOptions["$orderby"] = toOrderByODataFragment(entityQuery.orderByClause!);

    if (entityQuery.skipCount) {
      queryOptions["$skip"] = entityQuery.skipCount;
    }

    if (entityQuery.takeCount != null) {
      queryOptions["$top"] = entityQuery.takeCount;
    }

    queryOptions["$expand"] = toExpandODataFragment(entityQuery.expandClause);
    queryOptions["$select"] = toSelectODataFragment(entityQuery.selectClause!);

    if (entityQuery.inlineCountEnabled) {
      queryOptions["$inlinecount"] = "allpages";
    }

    let qoText = toQueryOptionsString(queryOptions as breeze.QueryOptions);
    return entityQuery.resourceName + qoText;

    // private methods to this func.

    function toWhereODataFragment(wherePredicate: breeze.Predicate) {
      if (!wherePredicate) return undefined;
      // validation occurs inside of the toODataFragment call here.
      let frag = wherePredicate.visit({ entityType: entityType }, toODataFragmentVisitor);
      return (frag && frag.length > 0) ? frag : undefined;
    }

    function toOrderByODataFragment(orderByClause: breeze.OrderByClause) {
      if (!orderByClause) return undefined;
      orderByClause.validate(entityType!);
      let strings = orderByClause.items.map(function (item) {
        return entityType!.clientPropertyPathToServer(item.propertyPath, "/") + (item.isDesc ? " desc" : "");
      });
      // should return something like CompanyName,Address/City desc
      return strings.join(',');
    }

    function toSelectODataFragment(selectClause?: breeze.SelectClause) {
      if (!selectClause) return undefined;
      selectClause.validate(entityType!);
      let frag = selectClause.propertyPaths.map(function (pp) {
        return entityType!.clientPropertyPathToServer(pp, "/");
      }).join(",");
      return frag;
    }

    function toExpandODataFragment(expandClause?: breeze.ExpandClause) {
      if (!expandClause) return undefined;
      // no validate on expand clauses currently.
      // expandClause.validate(entityType);
      let frag = expandClause.propertyPaths.map(function (pp) {
        return entityType!.clientPropertyPathToServer(pp, "/");
      }).join(",");
      return frag;
    }

    function toQueryOptionsString(queryOptions: breeze.QueryOptions) {
      let qoStrings: string[] = [];
      for (let qoName in queryOptions) {
        let qoValue = queryOptions[qoName];
        if (qoValue !== undefined) {
          if (qoValue instanceof Array) {
            qoValue.forEach(function (qov) {
              qoStrings.push(qoName + "=" + encodeURIComponent(qov));
            });
          } else {
            qoStrings.push(qoName + "=" + encodeURIComponent(qoValue));
          }
        }
      }

      if (qoStrings.length > 0) {
        return "?" + qoStrings.join("&");
      } else {
        return "";
      }
    }
  }


}

(breeze.Predicate.prototype as any).toODataFragment = function (context: breeze.VisitContext) {
  return this.visit(context, toODataFragmentVisitor);
};

let toODataFragmentVisitor = {

  passthruPredicate: function () {
    return this.value;
  },

  unaryPredicate: function (this: breeze.UnaryPredicate, context: breeze.VisitContext) {
    let predVal = this.pred.visit(context);
    return odataOpFrom(this) + " " + "(" + predVal + ")";
  },

  binaryPredicate: function (this: breeze.BinaryPredicate, context: breeze.VisitContext) {
    let expr1Val = this.expr1!.visit(context);
    let expr2Val = this.expr2!.visit(context);
    let prefix = (context as any).prefix;
    if (prefix) {
      expr1Val = prefix + "/" + expr1Val;
    }

    let odataOp = odataOpFrom(this);

    if (this.op.key === 'in') {
      let result = expr2Val.map(function (v: any) {
        return "(" + expr1Val + " eq " + v + ")";
      }).join(" or ");
      return result;
    } else if (this.op.isFunction) {
      if (odataOp === "substringof") {
        return odataOp + "(" + expr2Val + "," + expr1Val + ") eq true";
      } else {
        return odataOp + "(" + expr1Val + "," + expr2Val + ") eq true";
      }
    } else {
      return expr1Val + " " + odataOp + " " + expr2Val;
    }
  },

  andOrPredicate: function (this: breeze.AndOrPredicate, context: breeze.VisitContext) {
    let result = this.preds.map(function (pred) {
      let predVal = pred.visit(context);
      return "(" + predVal + ")";
    }).join(" " + odataOpFrom(this) + " ");
    return result;
  },

  anyAllPredicate: function (this: breeze.AnyAllPredicate, context: breeze.VisitContext) {
    let exprVal = this.expr.visit(context);
    if (!this.pred.op) { // added 21-Oct-2016 to fix breeze.js issue #172
      return exprVal + "/" + odataOpFrom(this) + "()";
    }
    let prefix = (context as any).prefix;
    if (prefix) {
      exprVal = prefix + "/" + exprVal;
      prefix = "x" + (parseInt(prefix.substring(1)) + 1);
    } else {
      prefix = "x1";
    }
    // need to create a new context because of 'prefix'
    let newContext = breeze.core.extend({}, context) as any;
    newContext.entityType = this.expr.dataType;
    newContext.prefix = prefix;
    let newPredVal = this.pred.visit(newContext);
    return exprVal + "/" + odataOpFrom(this) + "(" + prefix + ": " + newPredVal + ")";
  },

  litExpr: function () {
    if (Array.isArray(this.value)) {
      return this.value.map(function (v: any) { return this.dataType.fmtOData(v); }, this);
    } else {
      return this.dataType.fmtOData(this.value);
    }
  },

  propExpr: function (this: breeze.PropExpr, context: breeze.ExpressionContext) {
    let entityType = context.entityType;
    // '/' is the OData path delimiter
    return entityType ? entityType.clientPropertyPathToServer(this.propertyPath, "/") : this.propertyPath;
  },

  fnExpr: function (this: breeze.FnExpr, context: breeze.ExpressionContext) {
    let exprVals = this.exprs.map(function (expr) {
      return expr.visit(context);
    });
    return this.fnName + "(" + exprVals.join(",") + ")";
  }
};

let _operatorMap = {
  'contains': 'substringof'
};

function odataOpFrom(node: any) {
  let op = node.op.key;
  let odataOp = _operatorMap[op];
  return odataOp || op;
}

breeze.config.registerAdapter("uriBuilder", UriBuilderODataAdapter);



