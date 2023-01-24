export class RuleResult {
  id = '';
  cfg = '';
  subRuleRef = '';
  result = false;
  reason = '';
}

/**
 * Adds a RuleResult to RuleResults[] if it doesn't already contain it
 *
 * @param {RuleResult[]} ruleResults - the destination of newRuleResult
 * @param {RuleResult} newRuleResult - the RuleResult to be added to RuleResults[]
 * @return {RuleResult[]} resulting RuleResults[]
 */
export function addRuleResult(ruleResults: RuleResult[], newRuleResult: RuleResult): RuleResult[] {
  if (!ruleResults.some((r) => r.id === newRuleResult.id && r.cfg === newRuleResult.cfg)) {
    ruleResults.push(newRuleResult);
  }
  return ruleResults;
}

/**
 * Check if the RuleResults[] already contains this RuleResult
 *
 * @param {RuleResult[]} ruleResults - the array of RuleResults
 * @param {RuleResult} ruleResult - the value to be checked against RuleResults[]
 * @return {boolean} result
 */
export function containsRuleResult(ruleResults: RuleResult[], ruleResult: RuleResult): boolean {
  return ruleResults.some((r) => r.id === ruleResult.id && r.cfg === ruleResult.cfg)
}
