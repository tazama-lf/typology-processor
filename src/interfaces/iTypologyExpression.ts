// SPDX-License-Identifier: Apache-2.0
export interface IRuleValue {
  id: string;
  cfg: string;
  ref: string;
  wght: number;
  termId: string;
}

export interface IRule {
  id: string;
  cfg: string;
  ref?: string;
}

export type ExpressionMathJSON = Array<string | number | ExpressionMathJSON>;

export interface IWorkFlow {
  alertThreshold: number;
  interdictionThreshold?: number;
}

export interface ITypologyExpression {
  id: string;
  cfg: string;
  desc?: string | undefined;
  rules: IRuleValue[];
  expression: ExpressionMathJSON;
  workflow: IWorkFlow;
}
