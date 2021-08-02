export interface IRuleValue {
    rule_id: string;
    rule_true_value: string;
    rule_false_value: string;
}

export enum Operators{
    "+","-","*","/"
}

export interface IExpression {
    operation: Operators;
    values: string[];
    nestedExpression: IExpression;
}

export interface ITypologyExpression {
    typology_name: string;
    typology_version: string;
    rules_values: IRuleValue[];
    typology_expression: IExpression;
}