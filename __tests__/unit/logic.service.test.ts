import { NetworkMap, Typology } from '../../src/classes/network-map';
import { RuleResult } from '../../src/classes/rule-result';
import { handleTransaction } from '../../src/logic.service';
import { Pain001V11Transaction } from '../../src/classes/Pain.001.001.11/iPain001Transaction';
import { ArangoDBService } from '../../src/clients';
import { ITypologyExpression } from '../../src/interfaces/iTypologyExpression';
import { cacheClient, databaseClient } from '../../src';
import _ from 'lodash';

const getMockRequest = () => {
  const quote = new Pain001V11Transaction(
    JSON.parse(
      '{"TxTp":"pain.001.001.11","CstmrCdtTrfInitn":{"GrpHdr":{"MsgId":"2669e349-500d-44ba-9e27-7767a16608a0","CreDtTm":"2021-10-07T09:25:31.000Z","NbOfTxs":1,"InitgPty":{"Nm":"IvanReeseRussel-Klein","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1967-11-23","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-783078685"}}},"PmtInf":{"PmtInfId":"b51ec534-ee48-4575-b6a9-ead2955b8069","PmtMtd":"TRA","ReqdAdvcTp":{"DbtAdvc":{"Cd":"ADWD","Prtry":"Advice with transaction details"}},"ReqdExctnDt":{"Dt":"2021-10-07","DtTm":"2021-10-07T09:25:31.000Z"},"Dbtr":{"Nm":"IvanReeseRussel-Klein","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1967-11-23","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-783078685"}},"DbtrAcct":{"Id":{"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"PASSPORT"}}},"Nm":"IvanRussel-Klein"},"DbtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp001"}}},"CdtTrfTxInf":{"PmtId":{"EndToEndId":"b51ec534-ee48-4575-b6a9-ead2955b8069"},"PmtTpInf":{"CtgyPurp":{"Prtry":"TRANSFER"}},"Amt":{"InstdAmt":{"Amt":{"Amt":"50431891779910900","Ccy":"USD"}},"EqvtAmt":{"Amt":{"Amt":"50431891779910900","Ccy":"USD"},"CcyOfTrf":"USD"}},"ChrgBr":"DEBT","CdtrAgt":{"FinInstnId":{"ClrSysMmbId":{"MmbId":"dfsp002"}}},"Cdtr":{"Nm":"AprilSamAdamson","Id":{"PrvtId":{"DtAndPlcOfBirth":{"BirthDt":"1923-04-26","CityOfBirth":"Unknown","CtryOfBirth":"ZZ"},"Othr":{"Id":"+27782722305","SchmeNm":{"Prtry":"MSISDN"}}}},"CtctDtls":{"MobNb":"+27-782722305"}},"CdtrAcct":{"Id":{"Othr":{"Id":"+27783078685","SchmeNm":{"Prtry":"MSISDN"}}},"Nm":"AprilAdamson"},"Purp":{"Cd":"MP2P"},"RgltryRptg":{"Dtls":{"Tp":"BALANCEOFPAYMENTS","Cd":"100"}},"RmtInf":{"Ustrd":"PaymentofUSD49932566118723700.89fromIvantoApril"},"SplmtryData":{"Envlp":{"Doc":{"Cdtr":{"FrstNm":"Ivan","MddlNm":"Reese","LastNm":"Russel-Klein","MrchntClssfctnCd":"BLANK"},"Dbtr":{"FrstNm":"April","MddlNm":"Sam","LastNm":"Adamson","MrchntClssfctnCd":"BLANK"},"DbtrFinSvcsPrvdrFees":{"Ccy":"USD","Amt":"499325661187237"},"Xprtn":"2021-10-07T09:30:31.000Z"}}}}},"SplmtryData":{"Envlp":{"Doc":{"InitgPty":{"InitrTp":"CONSUMER","Glctn":{"Lat":"-3.1291","Long":"39.0006"}}}}}}}',
    ),
  );
  return quote;
};

let cacheString = '';

describe('Logic Service', () => {
  let databaseServiceSpy: jest.SpyInstance;
  let getJsonSpy: jest.SpyInstance;
  let setJsonSpy: jest.SpyInstance;
  let deleteJsonSpy: jest.SpyInstance;

  beforeEach(() => {
    //const typology: Typology = { id: '028@1.0.0', cfg: '1.0.0', host: 'local', rules: [] }
    databaseServiceSpy = jest.spyOn(databaseClient, 'getTypologyExpression').mockImplementation(async (typology: Typology) => {
      return new Promise((resolve, reject) => {
        if (typology.id === "028@1.0.0")
          resolve({ cfg: "1.0.0", id: "028@1.0.0", rules: [{ id: "003@1.0.0", cfg: "1.0.0", ref: ".01", true: 100, false: 2 }, { id: "004@1.0.0", cfg: "1.0.0", ref: ".01", true: 50, false: 2 }], expression: { operator: "+", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "-", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "*", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "/", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "/", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: undefined } } } } } });
        else
          resolve({ cfg: "1.0.0", id: "029@1.0.0", rules: [{ id: "003@1.0.0", cfg: "1.0.0", ref: ".01", true: 100, false: 2 }, { id: "004@1.0.0", cfg: "1.0.0", ref: ".01", true: 50, false: 2 }], expression: { operator: "+", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "-", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "*", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "/", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: { operator: "/", terms: [{ "id": "003@1.0.0", "cfg": "1.0.0" }, { "id": "004@1.0.0", "cfg": "1.0.0" }], expression: undefined } } } } } });

      });
    });

    getJsonSpy = jest.spyOn(cacheClient, 'getJson').mockImplementation((key: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        resolve(cacheString);
      });
    });

    setJsonSpy = jest.spyOn(cacheClient, 'setJson').mockImplementation((key: string, value: string): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
        cacheString = value;
        resolve('OK');
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
      const result = await handleTransaction(expectedReq, networkMap, ruleResult);
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

      const ruleResult: RuleResult = { result: true, id: '001_Derived_account_age_payee', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };
      const result = await handleTransaction(expectedReq, networkMap, ruleResult);
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

      const ruleResult: RuleResult = { result: true, id: '001_Derived_account_age_payee', cfg: '1.0.0', reason: 'reason', subRuleRef: 'ref1' };
      const result = await handleTransaction(expectedReq, networkMap, ruleResult);
      if (result) test = true;
      expect(test).toBeTruthy();
    });
  });
});

