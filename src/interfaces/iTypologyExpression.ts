// SPDX-License-Identifier: Apache-2.0
export interface IRuleValue {
  id: string;
  cfg: string;
  ref: string;
  wght: number;
}

export interface IRule {
  id: string;
  cfg: string;
  ref?: string;
}

export interface IExpression {
  operator: string;
  terms: IRule[];
  expression: IExpression | undefined;
}

export interface IWorkFlow {
  alertThreshold: number;
  interdictionThreshold?: number;
}

export interface ITypologyExpression {
  id: string;
  cfg: string;
  desc?: string | undefined;
  rules: IRuleValue[];
  expression: IExpression;
  workflow: IWorkFlow;
}
