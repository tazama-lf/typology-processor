// SPDX-License-Identifier: Apache-2.0
/* eslint-disable */
import { NetworkMap, Pacs002, RuleResult, Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { databaseManager, dbInit, runServer, server } from '../../src/index';
import { ITypologyExpression } from '../../src/interfaces/iTypologyExpression';
import { handleTransaction } from '../../src/logic.service';

const getMockReqPacs002 = (): Pacs002 => {
  return JSON.parse(
    '{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"136a-dbb6-43d8-a565-86b8f322411e","CreDtTm":"2023-02-03T09:53:58.069Z"},"TxInfAndSts":{"OrgnlInstrId":"5d158d92f70142a6ac7ffba30ac6c2db","OrgnlEndToEndId":"701b-ae14-46fd-a2cf-88dda2875fdd","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":300.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2023-02-03T09:53:58.069Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}',
  );
};

const getMockNetworkMapPacs002 = (): NetworkMap => {
  return JSON.parse(
    '{"active":true,"cfg":"1.0.0","messages":[{"id":"004@1.0.0","cfg":"1.0.0","txTp":"pacs.002.001.12","typologies":[{"id":"typology-processor@1.0.0","cfg":"028@1.0.0","rules":[{"id":"003@1.0.0","cfg":"1.0.0"}]},{"id":"typology-processor@1.0.0","cfg":"029@1.0.0","rules":[{"id":"003@1.0.0","cfg":"1.0.0"},{"id":"004@1.0.0","cfg":"1.0.0"}]}]}]}',
  );
};

const getMockTypologyExp028 = (): ITypologyExpression => {
  return JSON.parse(
    '{"cfg":"1.0.0","id":"028@1.0.0","workflow":{"alertThreshold":"125","interdictionThreshold":"150"},"rules":[{"id":"003@1.0.0","cfg":"1.0.0","ref":".err","wght":0},{"id":"003@1.0.0","cfg":"1.0.0","ref":".01","wght":100},{"id":"003@1.0.0","cfg":"1.0.0","ref":".03","wght":300},{"id":"003@1.0.0","cfg":"1.0.0","ref":".x00","wght":500}],"expression":{"operator":"+","terms":[{"id":"003@1.0.0","cfg":"1.0.0"}]}}',
  );
};

const getMockTypologyExp029 = (): ITypologyExpression => {
  return JSON.parse(
    '{"cfg":"1.0.0","id":"029@1.0.0","workflow":{"alertThreshold":"350","interdictionThreshold":"700"},"rules":[{"id":"003@1.0.0","cfg":"1.0.0","ref":".err","wght":1},{"id":"003@1.0.0","cfg":"1.0.0","ref":".01","wght":101},{"id":"003@1.0.0","cfg":"1.0.0","ref":".03","wght":301},{"id":"003@1.0.0","cfg":"1.0.0","ref":".x00","wght":501},{"id":"004@1.0.0","cfg":"1.0.0","ref":".err","wght":51},{"id":"004@1.0.0","cfg":"1.0.0","ref":".01","wght":151},{"id":"004@1.0.0","cfg":"1.0.0","ref":".03","wght":351},{"id":"004@1.0.0","cfg":"1.0.0","ref":".x00","wght":551}],"expression":{"operator":"+","terms":[{"id":"003@1.0.0","cfg":"1.0.0"},{"id":"004@1.0.0","cfg":"1.0.0"}]}}',
  );
};

beforeAll(async () => {
  await dbInit();
  await runServer();
});

afterAll((done) => {
  done();
});

const cacheStringArr: Map<string, Record<string, unknown>[]> = new Map();

describe('Logic Service', () => {
  let responseSpy: jest.SpyInstance;
  let addOneGetAllSpy: jest.SpyInstance;
  let getTypologyExpressionSpy: jest.SpyInstance;
  let deleteKeySpy: jest.SpyInstance;

  beforeEach(() => {
    addOneGetAllSpy = jest
      .spyOn(databaseManager, 'addOneGetAll')
      .mockImplementation((key: string, value: Record<string, unknown>): Promise<Array<Record<string, unknown>>> => {
        return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
          if (cacheStringArr.get(key)) {
            // Care for value dupes
            cacheStringArr.get(key)!.push(value);
          } else {
            cacheStringArr.set(key, [value]);
          }
          resolve(cacheStringArr.get(key) ?? []);
        });
      });

    getTypologyExpressionSpy = jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (_typology: Typology) => {
      switch (_typology.cfg) {
        case '028@1.0.0': {
          return new Promise((resolve, _reject) => {
            resolve([[getMockTypologyExp028()]]);
          });
        }
        case '029@1.0.0': {
          return new Promise((resolve, _reject) => {
            resolve([[getMockTypologyExp029()]]);
          });
        }
        default: {
          return new Promise((resolve, _reject) => {
            throw new Error('Extend getTypologyExpression Case');
          });
        }
      }
    });

    deleteKeySpy = jest.spyOn(databaseManager, 'deleteKey').mockImplementation((key: string): Promise<void> => {
      return new Promise<void>((resolve, _reject) => {
        cacheStringArr.delete(key);
        resolve();
      });
    });

    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation((response: any, _subject: string[] | undefined): any => {
      return new Promise((resolve, _reject) => {
        resolve(response);
      });
    });
  });

  afterEach(() => {
    // Clear 'Redis'
    cacheStringArr.clear();
  });

  describe('Handle Transaction', () => {
    it('should handle successful request, TP028, Rules 1/1', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      await handleTransaction({
        transaction: Req,
        networkMap,
        ruleResult,
      });

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(1);
      expect(responseSpy.mock.results.length).toEqual(1);

      const typology028Shallow = await responseSpy.mock.results[0].value;
      expect(typology028Shallow.networkMap).toEqual(networkMap);
      expect(typology028Shallow.transaction).toEqual(Req);
      expect(typology028Shallow.typologyResult.ruleResults.length).toEqual(1);
      expect(typology028Shallow.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 100 });
      expect(typology028Shallow.typologyResult.result).toEqual(100);
    });

    it('should handle successful request, TP028+TP029, Rules 2/2 and Typologies 2/2', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      await handleTransaction({
        transaction: Req,
        networkMap,
        ruleResult,
      });

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(1);
      expect(responseSpy.mock.results.length).toEqual(1);

      let typology028 = await responseSpy.mock.results[0].value;
      expect(typology028.networkMap).toEqual(networkMap);
      expect(typology028.transaction).toEqual(Req);
      expect(typology028.typologyResult.ruleResults.length).toEqual(1);
      expect(typology028.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 100 });
      expect(typology028.typologyResult.result).toEqual(100);

      const ruleResultTwo: RuleResult = {
        prcgTm: 0,
        id: '004@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      await handleTransaction({
        transaction: Req,
        networkMap,
        ruleResult: ruleResultTwo,
      });

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(2);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(2);
      expect(deleteKeySpy).toHaveBeenCalledTimes(1);
      expect(responseSpy).toHaveBeenCalledTimes(2);
      expect(responseSpy.mock.results.length).toEqual(2);

      typology028 = await responseSpy.mock.results[0].value;
      expect(typology028.networkMap).toEqual(networkMap);
      expect(typology028.transaction).toEqual(Req);
      expect(typology028.typologyResult.ruleResults.length).toEqual(1);
      expect(typology028.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 100 });
      expect(typology028.typologyResult.result).toEqual(100);

      const typology029 = await responseSpy.mock.results[1].value;
      expect(typology029.networkMap).toEqual(networkMap);
      expect(typology029.transaction).toEqual(Req);
      expect(typology029.typologyResult.ruleResults.length).toEqual(2);
      expect(typology029.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 101 });
      expect(typology029.typologyResult.ruleResults[1]).toEqual({ ...ruleResultTwo, wght: 151 });
      expect(typology029.typologyResult.result).toEqual(252);
    });

    it('should handle nested typology expressions using "+"', async () => {
      const Req = getMockReqPacs002();

      getTypologyExpressionSpy.mockRestore();
      getTypologyExpressionSpy = jest
        .spyOn(databaseManager, 'getTypologyExpression')
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '030@1.0.0',
                  workflow: { alertThreshold: '2000', interdictionThreshold: '4000' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      wght: 100,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      wght: 50,
                    },
                    {
                      id: '005@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      wght: 25,
                    },
                  ],
                  expression: {
                    operator: '+',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                      { id: '005@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '+',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                        { id: '005@1.0.0', cfg: '1.0.0' },
                      ],
                    },
                  },
                },
              ],
            ]),
          );
        });

      const localNetworkMap = JSON.parse(
        '{"active":true,"cfg":"1.0.0","messages":[{"id":"004@1.0.0","cfg":"1.0.0","txTp":"pacs.002.001.12","typologies":[{"id":"typology-processor@1.0.0","cfg":"030@1.0.0","rules":[{"id":"003@1.0.0","cfg":"1.0.0"},{"id":"004@1.0.0","cfg":"1.0.0"},{"id":"005@1.0.0","cfg":"1.0.0"}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), localNetworkMap);
      const ruleResult03: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const ruleResult04: RuleResult = {
        prcgTm: 0,
        id: '004@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const ruleResult05: RuleResult = {
        prcgTm: 0,
        id: '005@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      await handleTransaction({ transaction: Req, networkMap, ruleResult: ruleResult03 });
      await handleTransaction({ transaction: Req, networkMap, ruleResult: ruleResult04 });
      await handleTransaction({ transaction: Req, networkMap, ruleResult: ruleResult05 });

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(3);
      expect(deleteKeySpy).toHaveBeenCalledTimes(1); // Completed all rules in network map
      expect(responseSpy).toHaveBeenCalledTimes(1);
      expect(responseSpy.mock.results.length).toEqual(1);

      const typology030 = await responseSpy.mock.results[0].value;
      expect(typology030.networkMap).toEqual(networkMap);
      expect(typology030.transaction).toEqual(Req);
      expect(typology030.typologyResult.ruleResults.length).toEqual(3);
      expect(typology030.typologyResult.ruleResults[0]).toEqual({ ...ruleResult03, wght: 100 });
      expect(typology030.typologyResult.ruleResults[1]).toEqual({ ...ruleResult04, wght: 50 });
      expect(typology030.typologyResult.ruleResults[2]).toEqual({ ...ruleResult05, wght: 25 });
      expect(typology030.typologyResult.result).toEqual(350); // Nested expression is parental repeat ie. (100 + 50 + 25) + (100 + 50 + 25)
    });

    it('should handle successful request, TP028, Rules 1/1, Interdicting', async () => {
      const Req = getMockReqPacs002();

      getTypologyExpressionSpy = jest
        .spyOn(databaseManager, 'getTypologyExpression')
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) => {
            resolve([
              [
                JSON.parse(
                  '{"cfg":"1.0.0","id":"028@1.0.0","workflow":{"alertThreshold":"10","interdictionThreshold":"20"},"rules":[{"id":"003@1.0.0","cfg":"1.0.0","ref":".01","wght":20}],"expression":{"operator":"+","terms":[{"id":"003@1.0.0","cfg":"1.0.0"}]}}',
                ),
              ],
            ]);
          });
        });

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      await handleTransaction({
        transaction: Req,
        networkMap,
        ruleResult,
      });

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(2); // +1 to CMS for interdiction
      expect(responseSpy.mock.results.length).toEqual(2);

      const typology028 = await responseSpy.mock.results[0].value;
      expect(typology028.networkMap).toEqual(networkMap);
      expect(typology028.transaction).toEqual(Req);
      expect(typology028.typologyResult.ruleResults.length).toEqual(1);
      expect(typology028.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 20 });
      expect(typology028.typologyResult.result).toEqual(20);

      const typology028CMS = await responseSpy.mock.results[1].value;
      expect(typology028CMS.networkMap).toEqual(networkMap);
      expect(typology028CMS.transaction).toEqual(Req);
      expect(typology028CMS.typologyResult.ruleResults.length).toEqual(1);
      expect(typology028CMS.typologyResult.ruleResults[0]).toEqual({ ...ruleResult, wght: 20 });
      expect(typology028CMS.typologyResult.result).toEqual(20);
    });

    it('should handle successful request, with a unmatched ruleId', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();

      const badRuleResult: RuleResult = {
        prcgTm: 0,
        id: '001_Derived_account_age_payee',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      await handleTransaction({ transaction: Req, ruleResult: badRuleResult, networkMap: networkMap });
      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(0);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, getTypologyExpression error', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      jest.spyOn(databaseManager, 'getTypologyExpression').mockRejectedValue(async (_typology: Typology) => {
        return new Promise((resolve, _reject) => {
          resolve(new Error('Test'));
        });
      });

      try {
        await handleTransaction({ transaction: Req, networkMap, ruleResult });
      } catch {
        console.log('Error handle transaction');
      }

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, undefined typology expression', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (_typology: Typology) => {
        return new Promise((resolve, _reject) => {
          resolve([[]]);
        });
      });

      await handleTransaction({ transaction: Req, networkMap, ruleResult });
      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, cms and tadproc result error', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult03: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      responseSpy.mockImplementation().mockReturnValue(new Error('Test Failure Path'));

      try {
        await handleTransaction({ transaction: Req, networkMap, ruleResult: ruleResult03 });
        // Should error before
        expect(true).toEqual(false);
      } catch {
        console.log('Error of handling of transaction');
        expect(true).toEqual(true);
      }

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(responseSpy).toHaveBeenCalledTimes(1);
    });

    it('Should handle failure to post to TADP', async () => {
      const Req = getMockReqPacs002();

      const networkMap: NetworkMap = getMockNetworkMapPacs002();
      const ruleResult: RuleResult = {
        prcgTm: 0,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const errorSpy = jest.spyOn(server, 'handleResponse').mockRejectedValue(() => {
        throw new Error('Testing purposes');
      });

      try {
        await handleTransaction({
          transaction: Req,
          networkMap,
          ruleResult,
        });
      } catch (err) {
        // Error should not bubble up
        expect(true).toEqual(false);
      }

      expect(getTypologyExpressionSpy).toHaveBeenCalledTimes(1);
      expect(addOneGetAllSpy).toHaveBeenCalledTimes(1);
      expect(deleteKeySpy).toHaveBeenCalledTimes(0);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
