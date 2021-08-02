/* eslint-disable camelcase */

export interface IRuleValue {
  rule_id: string;
  rule_true_value: string;
  rule_false_value: string;
}

export interface IExpression {
  operation: string;
  values: string[];
  nested_expression: IExpression;
}

export interface ITypologyExpression {
  typology_name: string;
  typology_version: string;
  rules_values: IRuleValue[];
  typology_expression: IExpression;
}
