/* eslint-disable */

import axios from 'axios';
import apm from 'elastic-apm-node';
import { app, cache, cacheClient, databaseClient } from '../../src';
import { Pain001V11Transaction } from '../../src/classes/Pain.001.001.11/iPain001Transaction';
import { NetworkMap, Typology } from '../../src/classes/network-map';
import { RuleResult } from '../../src/classes/rule-result';
import { handleTransaction } from '../../src/logic.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('elastic-apm-node');
const mockApm = apm as jest.Mocked<typeof apm>;

interface MockedSpan extends Omit<apm.Span, 'end'> {
  end: jest.Mock;
}

(mockApm.startSpan as jest.MockedFunction<typeof mockApm.startSpan>).mockReturnValue({
  end: jest.fn(),
} as MockedSpan);

const getMockRequest = () => {
  const quote = new Pain001V11Transaction(
    JSON.parse(
      '{"TxTp":"pain.001.001.11","CstmrCdtTrfInitn":{"GrpHdr":{"MsgId":"2669e349-500d-44ba-9e27-7767a16608a0","CreDtTm":"2021-10-07T09:25:31.000Z","NbOfTxs":1,"InitgPty":{"Nm":"IvanReeseRussel-Klein","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1967-11-23","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-783078685"}}},"PmtInf":{"PmtInfId":"b51ec534-ee48-4575-b6a9-ead2955b8069","PmtMtd":"TRA","ReqdAdvcTp":{"DbtAdvc":{"Cd":"ADWD","Prtry":"Advice with transaction details"}},"ReqdExctnDt":{"Dt":"2021-10-07","DtTm":"2021-10-07T09:25:31.000Z"},"Dbtr":{"Nm":"IvanReeseRussel-Klein","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1967-11-23","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-783078685"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"PASSPORT"}}},"Nm":"IvanRussel-Klein"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtTrfTxInf":{"PmtId":{"EndToEndId":"b51ec534-ee48-4575-b6a9-ead2955b8069"},"PmtTpInf":{"CtgyPurp":{"Prtry":"TRANSFER"}},"Amt":{"InstdAmt":{"Amt":{"Amt":"50431891779910900","Ccy":"USD"}},"EqvtAmt":{"Amt":{"Amt":"50431891779910900","Ccy":"USD"},"CcyOfTrf":"USD"}},"ChrgBr":"DEBT","CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"AprilSamAdamson","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1923-04-26","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27782722305","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-782722305"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"AprilAdamson"},"Purp":{"Cd":"MP2P"},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD49932566118723700.89fromIvantoApril"},"SplmtryData":{"Envlp":{"Doc":{"Cdtr":{"FrstNm":"Ivan","MddlNm":"Reese","LastNm":"Russel-Klein","MrchntClssfctnCd":"BLANK"},"Dbtr":{"FrstNm":"April","MddlNm":"Sam","LastNm":"Adamson","MrchntClssfctnCd":"BLANK"},"DbtrFinSvcsPrvdrFees":{"Ccy":"USD","Amt":"499325661187237"},"Xprtn":"2021-10-07T09:30:31.000Z"}}}}},"SplmtryData":{"Envlp":{"Doc":{"InitgPty":{"InitrTp":"CONSUMER","Glctn":{"Lat":"-3.1291","Long":"39.0006"}}}}}}}',
    ),
  );
  return quote;
};

afterAll(async (done) => {
  cache.close();
  cacheClient.client.quit();
  databaseClient.client.close();
  app.terminate();
  done();
});

let cacheString = '';

describe('Logic Service', () => {
  let databaseServiceSpy: jest.SpyInstance;
  let getJsonSpy: jest.SpyInstance;
  let setJsonSpy: jest.SpyInstance;
  let addOneGetAllSpy: jest.SpyInstance;
  let deleteJsonSpy: jest.SpyInstance;

  beforeEach(async () => {
    databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockImplementation(async (typology: Typology) => {
      return new Promise((resolve, reject) => {
        if (typology.id === '028@1.0.0')
          resolve({
            cfg: '1.0.0',
            id: '028@1.0.0',
            desc: '',
            threshold: 50,
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
          });
        else
          resolve({
            cfg: '1.0.0',
            id: '029@1.0.0',
            desc: '',
            threshold: 50,
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
          });
      });
    });

    getJsonSpy = jest.spyOn(cacheClient, 'getJson').mockImplementation((key: string): Promise<string[]> => {
      return new Promise<string[]>((resolve, reject) => {
        resolve([cacheString]);
      });
    });

    setJsonSpy = jest.spyOn(cacheClient, 'setJson').mockImplementation((key: string, value: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => {
        cacheString = value;
        resolve(0);
      });
    });

    addOneGetAllSpy = jest.spyOn(cacheClient, 'addOneGetAll').mockImplementation((key: string, value: string): Promise<string[] | null> => {
      return new Promise<string[] | null>((resolve, reject) => {
        cacheString = value;
        resolve([cacheString]);
      });
    });

    deleteJsonSpy = jest.spyOn(cacheClient, 'deleteKey').mockImplementation((key: string): Promise<number> => {
      return new Promise<number>((resolve, reject) => {
        cacheString = '';
        resolve(0);
      });
    });
  });

  describe('Handle Transaction', () => {
    it('should handle successful request', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, wrong status code', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };

      mockedAxios.post.mockResolvedValue({ status: 201 });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle description element from config in 3 different states', async () => {
      const expectedReq = getMockRequest();
      databaseServiceSpy = jest
        .spyOn(databaseClient, 'getTypologyExpression')
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              //No desc element present in this config
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '', // Empty string is found as a value of desc element
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: 'Typology 029 Description from mock db config.', // Valid Value
              threshold: 50,
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
            }),
          );
        });
      addOneGetAllSpy = jest
        .spyOn(cacheClient, 'addOneGetAll')
        .mockImplementation((key: string, value: string): Promise<string[] | null> => {
          return new Promise<string[] | null>((resolve, reject) => {
            cacheString = value;
            resolve([
              '{"result":true,"id":"003@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
              '{"result":false,"id":"004@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
            ]);
          });
        });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      //Case of no element of desc and element found with empty string (Negetive Testing)
      let result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      expect(result.cadpRequests[0].typologyResult.desc).toBe('No description provided in typology config.');
      expect(result.cadpRequests[1].typologyResult.desc).toBe('No description provided in typology config.');

      //Test the desc value that is similar to the one found in config file (Positive Testing)
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      expect(result.cadpRequests[0].typologyResult.desc).toBe('Typology 029 Description from mock db config.');
    });

    it('should handle successful request, different typology operators', async () => {
      const expectedReq = getMockRequest();
      databaseServiceSpy = jest
        .spyOn(databaseClient, 'getTypologyExpression')
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        });

      addOneGetAllSpy = jest
        .spyOn(cacheClient, 'addOneGetAll')
        .mockImplementation((key: string, value: string): Promise<string[] | null> => {
          return new Promise<string[] | null>((resolve, reject) => {
            cacheString = value;
            resolve([
              '{"result":true,"id":"003@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
              '{"result":false,"id":"004@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
            ]);
          });
        });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };
      //const ruleResult04: RuleResult = { result: true, id: '004@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      let result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, division operator defaults', async () => {
      const expectedReq = getMockRequest();
      databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockImplementationOnce(async (typology: Typology) => {
        return new Promise((resolve, reject) =>
          resolve({
            cfg: '1.0.0',
            id: '029@1.0.0',
            desc: '',
            threshold: 50,
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
          }),
        );
      });
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: false, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'test123' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      let result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, typology evaluation defaults', async () => {
      const expectedReq = getMockRequest();
      databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockImplementationOnce(async (typology: Typology) => {
        return new Promise((resolve, reject) =>
          resolve({
            cfg: '1.0.0',
            id: '029@1.0.0',
            desc: '',
            threshold: 50,
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
          }),
        );
      });
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: false, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      let result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, with a unmatched ruleId', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"005@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);

      const ruleResult: RuleResult = {
        result: true,
        id: '001_Derived_account_age_payee',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, rule result is false', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: false, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, getTypologyExpression error', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: false, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };

      databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockRejectedValue(async (typology: Typology) => {
        return new Promise((resolve, reject) => {
          resolve(new Error('Test'));
        });
      });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, undefined typology expression', async () => {
      const expectedReq = getMockRequest();

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = { result: false, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };

      databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockImplementation(async (typology: Typology) => {
        return new Promise((resolve, reject) => {
          resolve(undefined);
        });
      });

      //mockedAxios.post.mockResolvedValue({ status: 200 });
      mockedAxios.post.mockReturnValue(
        new Promise((resolve, reject) => {
          resolve({ status: 400 });
        }),
      );

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should handle successful request, cms and cadproc result error', async () => {
      const expectedReq = getMockRequest();
      databaseServiceSpy = jest
        .spyOn(databaseClient, 'getTypologyExpression')
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        })
        .mockImplementationOnce(async (typology: Typology) => {
          return new Promise((resolve, reject) =>
            resolve({
              cfg: '1.0.0',
              id: '029@1.0.0',
              desc: '',
              threshold: 50,
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
            }),
          );
        });

      addOneGetAllSpy = jest
        .spyOn(cacheClient, 'addOneGetAll')
        .mockImplementation((key: string, value: string): Promise<string[] | null> => {
          return new Promise<string[] | null>((resolve, reject) => {
            cacheString = value;
            resolve([
              '{"result":true,"id":"003@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
              '{"result":false,"id":"004@1.0.0","cfg":"1.0.0","reason":"reason","subRuleRef":".01"}',
            ]);
          });
        });

      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult03: RuleResult = { result: true, id: '003@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };
      //const ruleResult04: RuleResult = { result: true, id: '004@1.0.0', cfg: '1.0.0', reason: 'reason', subRuleRef: '.01' };

      mockedAxios.post.mockRejectedValue(new Error('Test Failure Path'));

      let result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
      result = await handleTransaction(expectedReq, networkMap, ruleResult03, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });

    it('should test typology expression', async () => {
      const expectedReq = getMockRequest();
      let test = false;
      const jNetworkMap = JSON.parse(
        '{"messages":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","txTp":"pain.001.001.11","channels":[{"id":"001@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0","typologies":[{"id":"028@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"004@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]},{"id":"029@1.0.0","host":"https://frmfaas.sybrin.com/function/off-frm-typology-processor","cfg":"1.0.0","rules":[{"id":"003@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"},{"id":"005@1.0.0","host":"http://openfaas:8080","cfg":"1.0.0"}]}]}]}]}',
      );
      const networkMap: NetworkMap = Object.assign(new NetworkMap(), jNetworkMap);
      const ruleResult: RuleResult = {
        result: true,
        id: '001_Derived_account_age_payee',
        cfg: '1.0.0',
        reason: 'reason',
        subRuleRef: 'ref1',
      };

      mockedAxios.post.mockResolvedValue({ status: 200 });

      const result = await handleTransaction(expectedReq, networkMap, ruleResult, { prcgTmCRSP: 23.45, prcgTmDp: 45.233 });
      if (result) test = true;
      expect(test).toBeTruthy();
    });
  });
});
