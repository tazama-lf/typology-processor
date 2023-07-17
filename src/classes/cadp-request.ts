import { NetworkMap } from './network-map';
import { Pain001V11Transaction } from './Pain.001.001.11/iPain001Transaction';
import { RuleResult } from './rule-result';

export class TypologyResult {
  id = '';
  cfg = '';
  desc = '';
  prcgTm = -1;
  result = 0.0;
  threshold = 0.0;
  ruleResults: RuleResult[] = [];
}

export class CADPRequest {
  typologyResult: TypologyResult;
  transaction: Pain001V11Transaction;
  networkMap: NetworkMap;
  metaData?: { prcgTmDp: number; prcgTmCRSP: number } | undefined;
  constructor(typologyResult: TypologyResult, transaction: Pain001V11Transaction, networkMap: NetworkMap, ruleResults: RuleResult[]) {
    this.typologyResult = typologyResult;
    this.transaction = transaction;
    this.networkMap = networkMap;
    this.typologyResult.ruleResults = ruleResults;
  }
}

export class CombinedResult {
  typologyResult = '';
  cadpRequests: CADPRequest[] = [];
}
