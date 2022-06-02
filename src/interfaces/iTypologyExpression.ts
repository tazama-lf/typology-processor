/* eslint-disable camelcase */

export interface IRuleValue {
  id: string;
  cfg: string;
  ref: string;
  true: number;
  false: number;
}

export interface IRule {
  id: string;
  cfg: string;
}

export interface IExpression {
  operator: string;
  terms: IRule[];
  expression: IExpression;
}

export interface ITypologyExpression {
  id: string;
  cfg: string;
  rules: IRuleValue[];
  threshold: number;
  expression: IExpression;
}
