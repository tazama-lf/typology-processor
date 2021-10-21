class PmtId {
  EndToEndId = '';
}

class CtgyPurp {
  Prtry = '';
}

class PmtTpInf {
  CtgyPurp: CtgyPurp = new CtgyPurp();
}

class InstdAmt {
  Amt = '';
  Ccy = '';
}

class EqvtAmtAmt {
  Amt = '';
  Ccy = '';
}

class EqvtAmt {
  Amt: EqvtAmtAmt = new EqvtAmtAmt();
  CcyOfTrf = '';
}

class Amt {
  InstdAmt: InstdAmt = new InstdAmt();
  EqvtAmt: EqvtAmt = new EqvtAmt();
}

class ClrSysMmbId {
  MmbId = '';
}

class FinInstnId {
  ClrSysMmbId: ClrSysMmbId = new ClrSysMmbId();
}

class CdtrAgt {
  FinInstnId: FinInstnId = new FinInstnId();
}

class DtAndPlcOfBirth {
  BirthDt = '';
  CityOfBirth = '';
  CtryOfBirth = '';
}

class SchmeNm {
  Prtry = '';
}

class PrvtIdOthr {
  Id = '';
  SchmeNm: SchmeNm = new SchmeNm();
}

class PrvtId {
  DtAndPlcOfBirth: DtAndPlcOfBirth = new DtAndPlcOfBirth();
  Othr: PrvtIdOthr = new PrvtIdOthr();
}

class CdtrId {
  PrvtId: PrvtId = new PrvtId();
}

class CtctDtls {
  MobNb = '';
}

class Cdtr {
  Nm = '';
  Id: CdtrId = new CdtrId();
  CtctDtls: CtctDtls = new CtctDtls();
}

class CdtrAcctIdOthr {
  Id = '';
  SchmeNm: SchmeNm = new SchmeNm();
}

class CdtrAcctId {
  Othr: CdtrAcctIdOthr = new CdtrAcctIdOthr();
}

class CdtrAcct {
  Id: CdtrAcctId = new CdtrAcctId();
  Nm = '';
}

class Purp {
  Cd = '';
}

class Dtls {
  Tp = '';
  Cd = '';
}

class RgltryRptg {
  Dtls: Dtls = new Dtls();
}

class RmtInf {
  Ustrd = '';
}

class DocCdtr {
  FrstNm = '';
  MddlNm = '';
  LastNm = '';
  MrchntClssfctnCd = '';
}

class DocDbtr {
  FrstNm = '';
  MddlNm = '';
  LastNm = '';
  MrchntClssfctnCd = '';
}

class DocDbtrFinSvcsPrvdrFees {
  Ccy = '';
  Amt = '';
}

class Doc {
  Cdtr: DocCdtr = new DocCdtr();
  Dbtr: DocDbtr = new DocDbtr();
  DbtrFinSvcsPrvdrFees: DocDbtrFinSvcsPrvdrFees = new DocDbtrFinSvcsPrvdrFees();
  Xprtn = '';
}

class Envlp {
  Doc: Doc = new Doc();
}

class SplmtryData {
  Envlp: Envlp = new Envlp();
}

export class CdtTrfTxInf {
  PmtId: PmtId = new PmtId();
  PmtTpInf: PmtTpInf = new PmtTpInf();
  Amt: Amt = new Amt();
  ChrgBr = '';
  CdtrAgt: CdtrAgt = new CdtrAgt();
  Cdtr: Cdtr = new Cdtr();
  CdtrAcct: CdtrAcct = new CdtrAcct();
  Purp: Purp = new Purp();
  RgltryRptg: RgltryRptg = new RgltryRptg();
  RmtInf: RmtInf = new RmtInf();
  SplmtryData: SplmtryData = new SplmtryData();
}
