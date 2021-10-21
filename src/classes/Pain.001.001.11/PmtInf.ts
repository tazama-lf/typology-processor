import { CdtTrfTxInf } from './CdtTrfTxInf';

class ReqdExctnDt {
  Dt = '';
  DtTm = '';
}

class DtAndPlcOfBirth {
  BirthDt = '';
  CityOfBirth = '';
  CtryOfBirth = '';
}

// Common class
class SchmeNm {
  Prtry = '';
}

// Common class
class Othr {
  Id = '';
  SchmeNm: SchmeNm = new SchmeNm();
}

class PrvtId {
  DtAndPlcOfBirth: DtAndPlcOfBirth = new DtAndPlcOfBirth();
  Othr: Othr = new Othr();
}

class DbtrId {
  PrvtId: PrvtId = new PrvtId();
}

class CtctDtls {
  MobNb = '';
}

class Dbtr {
  Nm = '';
  Id: DbtrId = new DbtrId();
  CtctDtls: CtctDtls = new CtctDtls();
}

class DbtrAcctId {
  Othr: Othr = new Othr();
}

class DbtrAcct {
  Id: DbtrAcctId = new DbtrAcctId();
  Nm = '';
}

class DbtAdvc {
  Cd = '';
  Prtry = '';
}

class ReqdAdvcTp {
  DbtAdvc: DbtAdvc = new DbtAdvc();
}

class ClrSysMmbId {
  MmbId = '';
}

class FinInstnId {
  ClrSysMmbId: ClrSysMmbId = new ClrSysMmbId();
}

class DbtrAgt {
  FinInstnId: FinInstnId = new FinInstnId();
}

export class PmtInf {
  PmtInfId = '';
  PmtMtd = '';
  ReqdAdvcTp: ReqdAdvcTp = new ReqdAdvcTp();
  ReqdExctnDt: ReqdExctnDt = new ReqdExctnDt();
  Dbtr: Dbtr = new Dbtr();
  DbtrAcct: DbtrAcct = new DbtrAcct();
  DbtrAgt: DbtrAgt = new DbtrAgt();
  CdtTrfTxInf: CdtTrfTxInf = new CdtTrfTxInf();
}
