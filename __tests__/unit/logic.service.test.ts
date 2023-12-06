// SPDX-License-Identifier: Apache-2.0
/* eslint-disable */
import { NetworkMap, RuleResult, Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';
import axios from 'axios';
import { databaseManager, dbInit, runServer, server } from '../../src/index';
import { handleTransaction } from '../../src/logic.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const getMockRequest = () => {
  const pacs002 = JSON.parse(
    '{"TxTp":"pacs.002.001.12","FIToFIPmtSts":{"GrpHdr":{"MsgId":"136a-dbb6-43d8-a565-86b8f322411e","CreDtTm":"2023-02-03T09:53:58.069Z"},"TxInfAndSts":{"OrgnlInstrId":"5d158d92f70142a6ac7ffba30ac6c2db","OrgnlEndToEndId":"701b-ae14-46fd-a2cf-88dda2875fdd","TxSts":"ACCC","ChrgsInf":[{"Amt":{"Amt":307.14,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":153.57,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}}},{"Amt":{"Amt":300.71,"Ccy":"USD"},"Agt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}],"AccptncDtTm":"2023-02-03T09:53:58.069Z","InstgAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"typolog028"}}},"InstdAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}}}}}',
  );

  return pacs002;
};

beforeAll(async () => {
  await dbInit();
  await runServer();
});

afterAll((done) => {
  done();
});

let cacheString: Record<string, unknown>;
let cacheStringArr: Map<string, Record<string, unknown>[]> = new Map();
let weight: number;

describe('Logic Service', () => {
  let responseSpy: jest.SpyInstance;

  beforeEach(() => {

    jest.spyOn(databaseManager, 'addOneGetAll')
      .mockImplementation((_key: string, _value: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
        return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
          //cacheString = value;
          resolve([
            { ruleResult: { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' } },
            { ruleResult: { result: false, id: '004@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' } },
          ]);
        });
      });

    jest.spyOn(databaseManager, 'getNetworkMap').mockImplementation(async () => {
      return new Promise((resolve, _reject) => {
        resolve(
          JSON.parse(
            '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"028@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"029@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
          ),
        );
      });
    });

    jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (typology: Typology) => {
      return new Promise((resolve, _reject) => {
        if (typology.id === '028@1.0.0')
          resolve([
            [
              {
                cfg: '1.0.0',
                id: '028@1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [
                  { id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 },
                  { id: '004@1.0.0', cfg: '1.0.0', ref: '.01', true: 50, false: 2 },
                ],
                expression: {
                  operator: '+',
                  terms: [
                    { id: '003@1.0.0', cfg: '1.0.0' },
                    { id: '004@1.0.0', cfg: '1.0.0' },
                  ],
                  expression: {
                    operator: '-',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '*',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: {
                        operator: '/',
                        terms: [
                          { id: '003@1.0.0', cfg: '1.0.0' },
                          { id: '004@1.0.0', cfg: '1.0.0' },
                        ],
                        expression: {
                          operator: '/',
                          terms: [
                            { id: '003@1.0.0', cfg: '1.0.0' },
                            { id: '004@1.0.0', cfg: '1.0.0' },
                          ],
                          expression: undefined,
                        },
                      },
                    },
                  },
                },
              },
            ],
          ]);
        else
          resolve([
            [
              {
                cfg: '1.0.0',
                id: '029@1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [
                  { id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 },
                  { id: '004@1.0.0', cfg: '1.0.0', ref: '.01', true: 50, false: 2 },
                ],
                expression: {
                  operator: '+',
                  terms: [
                    { id: '003@1.0.0', cfg: '1.0.0' },
                    { id: '004@1.0.0', cfg: '1.0.0' },
                  ],
                  expression: {
                    operator: '-',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '*',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: {
                        operator: '/',
                        terms: [
                          { id: '003@1.0.0', cfg: '1.0.0' },
                          { id: '004@1.0.0', cfg: '1.0.0' },
                        ],
                        expression: {
                          operator: '/',
                          terms: [
                            { id: '003@1.0.0', cfg: '1.0.0' },
                            { id: '004@1.0.0', cfg: '1.0.0' },
                          ],
                          expression: undefined,
                        },
                      },
                    },
                  },
                },
              },
            ],
          ]);
      });
    });

    jest.spyOn(databaseManager, 'getMemberValues').mockImplementation((_key: string): Promise<Record<string, unknown>[]> => {
      return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
        resolve([{ alreadySent: cacheString }]);
      });
    });

    jest.spyOn(databaseManager, 'addOneGetCount').mockImplementation((_key: string, value: Record<string, unknown>): Promise<number> => {
      return new Promise<number>((resolve, _reject) => {
        cacheString = value;
        resolve(1);
      });
    });

    jest.spyOn(databaseManager, 'setAdd').mockImplementation((_key: string, value: Record<string, unknown>): Promise<void> => {
      return new Promise<void>((resolve, _reject) => {
        cacheString = value;
        resolve();
      });
    });

    jest.spyOn(databaseManager, 'deleteKey').mockImplementation((_key: string): Promise<void> => {
      return new Promise<void>((resolve, _reject) => {
        cacheString = {};
        cacheStringArr = new Map();
        resolve();
      });
    });

    responseSpy = jest.spyOn(server, 'handleResponse').mockImplementation((response: any, _subject: string[] | undefined): Promise<any> => {
      return new Promise<any>((resolve, _reject) => {
        cacheString = {};
        resolve(response as any);
        weight = (response?.typologyResult?.ruleResults[0].wght as any) ?? 0;
      });
    });
  });

  describe('Handle Transaction', () => {
    it('should handle successful request, and should have weight of 100', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"028@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"029@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (_typology: Typology) => {
        return new Promise((resolve, _reject) => {
          resolve([
            [
              {
                cfg: '028@1.0.0',
                id: '1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [{ id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 }],
                expression: {
                  operator: '+',
                  terms: [{ id: '003@1.0.0', cfg: '1.0.0' }],
                },
              },
            ],
          ]);
        });
      });

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap,
        ruleResult,
      });

      expect(responseSpy).toHaveBeenCalled();
      expect(weight).toEqual(100);
    });

    it('should handle successful request, wrong status code', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      mockedAxios.post.mockResolvedValue({ status: 201 });

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap,
        ruleResult,
      });

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle successful handle axio error code response', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };
      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (_typology: Typology) => {
        return new Promise((resolve, _reject) => {
          resolve([
            [
              {
                cfg: '1.0.0',
                id: '028@1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [{ id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 }],
                expression: {
                  operator: '+',
                  terms: [{ id: '003@1.0.0', cfg: '1.0.0' }],
                },
              },
            ],
          ]);
        });
      });
      mockedAxios.post.mockResolvedValue({ status: 401 });

      const result = await handleTransaction({
        transaction: expectedReq,
        networkMap,
        ruleResult,
      });

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle description element from config in 3 different states', async () => {
      const expectedReq = getMockRequest();
      jest
        .spyOn(databaseManager, 'getTypologyExpression')
        .mockImplementationOnce(async (_typology: unknown) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  //No desc element present in this config
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '-',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '-',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: unknown) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '+',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '/',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '*',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '*',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        });
      jest
        .spyOn(databaseManager, 'addOneGetAll')
        .mockImplementation((_key: string, _value: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
          return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
            //cacheString = value;
            resolve([
              { ruleResult: { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' } },
              { ruleResult: { result: false, id: '004@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' } },
            ]);
          });
        });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      //Case of no element of desc and element found with empty string (Negetive Testing)
      let result = await handleTransaction({ transaction: expectedReq, networkMap, ruleResult: ruleResult03 });
      // expect(result.cadpRequests[0].typologyResult.desc).toBe("No description provided in typology config.");
      // expect(result.cadpRequests[1].typologyResult.desc).toBe("No description provided in typology config.");

      //Test the desc value that is similar to the one found in config file (Positive Testing)
      await handleTransaction({ transaction: expectedReq, networkMap, ruleResult: ruleResult03 });
      // expect(result.cadpRequests[0].typologyResult.desc).toBe("Typology 029 Description from mock db config.");
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle successful request, different typology operators', async () => {
      const expectedReq = getMockRequest();
      jest
        .spyOn(databaseManager, 'getTypologyExpression')
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    { id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '-',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '-',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '+',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '/',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '*',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '*',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',
                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '/',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '+',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        });
      cacheStringArr = new Map();
      jest.spyOn(databaseManager, 'addOneGetCount').mockImplementation((_key: string, value: Record<string, unknown>): Promise<number> => {
        return new Promise<number>((resolve, _reject) => {
          if (cacheStringArr.get(_key)) cacheStringArr.get(_key)?.push(value);
          else cacheStringArr.set(_key, [value]);
          resolve(cacheStringArr.get(_key)?.length ?? 0);
        });
      });

      jest.spyOn(databaseManager, 'getMemberValues').mockImplementation((_key: string): Promise<Record<string, unknown>[]> => {
        return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
          resolve(cacheStringArr.get(_key) ?? []);
        });
      });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const ruleResult04: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '004@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      await handleTransaction({ transaction: expectedReq, ruleResult: ruleResult03, networkMap });

      mockedAxios.post.mockReturnValue(
        new Promise((resolve, _reject) => {
          resolve({ status: 400 });
        }),
      );

      await handleTransaction({ transaction: expectedReq, ruleResult: ruleResult04, networkMap: networkMap });
      await handleTransaction({ transaction: expectedReq, ruleResult: ruleResult03, networkMap: networkMap });
      await handleTransaction({ transaction: expectedReq, ruleResult: ruleResult03, networkMap: networkMap });
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle successful request, division operator defaults', async () => {
      const expectedReq = getMockRequest();
      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementationOnce(async (_typology: Typology) => {
        return new Promise((resolve, _reject) =>
          resolve([
            [
              {
                cfg: '1.0.0',
                id: '029@1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [
                  {
                    id: '003@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 100,
                    false: 2,
                  },
                  {
                    id: '004@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 50,
                    false: 2,
                  },
                ],
                expression: {
                  operator: '/',
                  terms: [
                    { id: '003@1.0.0', cfg: '1.0.0' },
                    { id: '004@1.0.0', cfg: '1.0.0' },
                  ],
                  expression: undefined,
                },
              },
            ],
          ]),
        );
      });
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: false,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'test123',
      };

      // mockedAxios.post.mockResolvedValue({ status: 200 });

      await handleTransaction({ transaction: expectedReq, networkMap: networkMap, ruleResult: ruleResult });
      expect(responseSpy).toHaveBeenCalled();
      // if (result) test = true;
      // expect(test).toBeTruthy();
      await handleTransaction({ transaction: expectedReq, networkMap: networkMap, ruleResult: ruleResult });
      expect(responseSpy).toHaveBeenCalled();
      // if (result) test = true;
      // expect(test).toBeTruthy();
      await handleTransaction({ transaction: expectedReq, networkMap: networkMap, ruleResult: ruleResult });
      expect(responseSpy).toHaveBeenCalled();
      // if (result) test = true;
      // expect(test).toBeTruthy();
      await handleTransaction({ transaction: expectedReq, networkMap: networkMap, ruleResult: ruleResult });
      expect(responseSpy).toHaveBeenCalled();
      // if (result) test = true;
      // expect(test).toBeTruthy();
    });

    it('should handle successful request, typology evaluation defaults', async () => {
      const expectedReq = getMockRequest();
      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementationOnce(async (_typology: Typology) => {
        return new Promise((resolve, _reject) =>
          resolve([
            [
              {
                cfg: '1.0.0',
                id: '029@1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [
                  {
                    id: '003@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 100,
                    false: 2,
                  },
                  {
                    id: '004@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 50,
                    false: 2,
                  },
                ],
                expression: {
                  operator: '/',
                  terms: [
                    { id: '003@1.0.0', cfg: '1.0.0' },
                    { id: '004@1.0.0', cfg: '1.0.0' },
                  ],
                  expression: undefined,
                },
              },
            ],
          ]),
        );
      });
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: false,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      // mockedAxios.post.mockResolvedValue({ status: 200 });

      let result = await handleTransaction({ transaction: expectedReq, networkMap: networkMap, ruleResult: ruleResult });
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      expect(responseSpy).toHaveBeenCalled();
    });

    it('should handle successful request, with a unmatched ruleId', async () => {
      jest.resetAllMocks();
      cacheString = {};
      const expectedReq = getMockRequest();
      let test = false;

      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementationOnce(async (_typology: Typology) => {
        return new Promise((resolve, _reject) =>
          resolve([
            [
              {
                cfg: '029@1.0.0',
                id: '1.0.0',
                workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                rules: [
                  {
                    id: '003@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 100,
                    false: 2,
                  },
                  {
                    id: '004@1.0.0',
                    cfg: '1.0.0',
                    ref: '.01',
                    true: 50,
                    false: 2,
                  },
                ],
                expression: {
                  operator: '/',
                  terms: [
                    { id: '003@1.0.0', cfg: '1.0.0' },
                    { id: '004@1.0.0', cfg: '1.0.0' },
                  ],
                  expression: undefined,
                },
              },
            ],
          ]),
        );
      });

      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"005@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);

      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '001_Derived_account_age_payee',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      jest
        .spyOn(databaseManager, 'addOneGetAll')
        .mockImplementation((_key: string, value: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
          return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
            //cacheString = value;
            resolve([{ ruleResult: ruleResult }]);
          });
        });

      await handleTransaction({ transaction: expectedReq, ruleResult, networkMap: networkMap });
      // if (result) test = true;
      // expect(test).toBeTruthy();
      expect(responseSpy).toHaveBeenCalledTimes(0);
    });

    it('should handle successful request, rule result is false', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: false,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const result = await handleTransaction({ transaction: expectedReq, networkMap, ruleResult });
      expect(responseSpy).toHaveBeenCalled();
      // if (result) test = true;
      // expect(test).toBeTruthy();
    });

    it('should handle successful request, getTypologyExpression error', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: false,
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
        await handleTransaction({ transaction: expectedReq, networkMap, ruleResult });
      } catch {
        console.log('Error handle transaction');
      }

      expect(responseSpy).toHaveBeenCalledTimes(0);
      // if (result) test = true;
      // expect(test).toBeTruthy();
    });

    it('should handle successful request, undefined typology expression', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: false,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      jest.spyOn(databaseManager, 'getTypologyExpression').mockImplementation(async (_typology: Typology) => {
        return new Promise((resolve, _reject) => {
          resolve(undefined);
        });
      });

      mockedAxios.post.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockReturnValue(
        new Promise((resolve, _reject) => {
          resolve({ status: 400 });
        }),
      );

      const result = await handleTransaction({ transaction: expectedReq, networkMap, ruleResult });
      expect(responseSpy).toHaveBeenCalledTimes(0);
      // if (result) test = true;
      // expect(test).toBeTruthy();
    });

    it('should handle successful request, cms and cadproc result error', async () => {
      const expectedReq = getMockRequest();
      jest
        .spyOn(databaseManager, 'getTypologyExpression')
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',

                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    { id: '003@1.0.0', cfg: '1.0.0', ref: '.01', true: 100, false: 2 },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '-',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '-',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',

                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '+',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '/',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',

                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '*',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '*',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        })
        .mockImplementationOnce(async (_typology: Typology) => {
          return new Promise((resolve, _reject) =>
            resolve([
              [
                {
                  cfg: '1.0.0',
                  id: '029@1.0.0',

                  workflow: { alertThreshold: '25', interdictionThreshold: '50' },
                  rules: [
                    {
                      id: '003@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 100,
                      false: 2,
                    },
                    {
                      id: '004@1.0.0',
                      cfg: '1.0.0',
                      ref: '.01',
                      true: 50,
                      false: 2,
                    },
                  ],
                  expression: {
                    operator: '/',
                    terms: [
                      { id: '003@1.0.0', cfg: '1.0.0' },
                      { id: '004@1.0.0', cfg: '1.0.0' },
                    ],
                    expression: {
                      operator: '+',
                      terms: [
                        { id: '003@1.0.0', cfg: '1.0.0' },
                        { id: '004@1.0.0', cfg: '1.0.0' },
                      ],
                      expression: undefined,
                    },
                  },
                },
              ],
            ]),
          );
        });

      jest
        .spyOn(databaseManager, 'addOneGetAll')
        .mockImplementation((_key: string, value: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
          return new Promise<Record<string, unknown>[]>((resolve, _reject) => {
            //cacheString = value;
            resolve([value]);
          });
        });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      mockedAxios.post.mockRejectedValue(new Error('Test Failure Path'));

      // let result = await handleTransaction(expectedReq, networkMap, ruleResult03);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq, networkMap, ruleResult03);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq, networkMap, ruleResult03);
      // if (result) test = true;
      // expect(test).toBeTruthy();
      // result = await handleTransaction(expectedReq, networkMap, ruleResult03);
      // if (result) test = true;
      // expect(test).toBeTruthy();

      responseSpy.mockImplementation().mockReturnValue(new Error('Test Failure Path'));

      try {
        await handleTransaction({ transaction: expectedReq, networkMap, ruleResult: ruleResult03 });
      } catch {
        console.log('Error of handling of transaction');
      }

      expect(responseSpy).toHaveBeenCalled();
    });

    it('should test typology expression', async () => {
      jest.clearAllMocks()
      const expectedReq = getMockRequest();
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"028@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"029@1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"005@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      jest.spyOn(databaseManager, 'getMembers').mockImplementation((_key: string): Promise<string[]> => {
        return new Promise<string[]>((resolve, _reject) => {
          resolve([
            JSON.stringify({
              ruleResult: { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' },
            }),
            JSON.stringify({
              ruleResult: { result: true, id: '004@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' },
            }),
          ]);
        });
      });

      jest.spyOn(databaseManager, 'addOneGetCount').mockImplementation((_key: string, value: Record<string, unknown>): Promise<number> => {
        return new Promise<number>((resolve, _reject) => {
          cacheString = value;
          resolve(1);
        });
      });

      await handleTransaction({ transaction: expectedReq, networkMap, ruleResult });
      expect(responseSpy).toHaveBeenCalledTimes(1);

      // mockedAxios.post.mockResolvedValue({ status: 200 });

      // const result = await handleTransaction(expectedReq, networkMap, ruleResult);
      // if (result) test = true;
      // expect(test).toBeTruthy();
    });

    it('Should handle failure to post to CADP', async () => {
      const expectedReq = getMockRequest();
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        prcgTm: 0,
        result: true,
        id: '003@1.0.0',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: '.01',
      };

      const errorSpy = jest.spyOn(server, 'handleResponse').mockRejectedValue(() => {
        throw new Error('Testing purposes');
      });

      await handleTransaction({
        transaction: expectedReq,
        networkMap,
        ruleResult,
      });

      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
