import { NetworkMap } from "./network-map";
import { Pain001V11Transaction } from "./Pain.001.001.11/iPain001Transaction";
import { RuleResult } from "./rule-result";
import { TypologyResult } from "./typology-result"

export class CADPRequest {
    typologyResult: TypologyResult;
    transaction: Pain001V11Transaction;
    networkMap: NetworkMap;
    ruleResults: RuleResult[];

    constructor(typologyResult: TypologyResult,
        transaction: Pain001V11Transaction,
        networkMap: NetworkMap,
        ruleResults: RuleResult[]) {
        this.typologyResult = typologyResult;
        this.transaction = transaction;
        this.networkMap = networkMap;
        this.ruleResults = ruleResults;
    }
}

export class CombinedResult {
    typologyResult: string = "";
    cadpRequests: CADPRequest[] = [];
}