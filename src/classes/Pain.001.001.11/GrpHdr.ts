class DtAndPlcOfBirth {
  BirthDt = '';
  CityOfBirth = '';
  CtryOfBirth = '';
}

class SchmeNm {
  Prtry = '';
}

class Othr {
  Id = '';
  SchmeNm: SchmeNm = new SchmeNm();
}

class PrvtId {
  DtAndPlcOfBirth: DtAndPlcOfBirth = new DtAndPlcOfBirth();
  Othr: Othr = new Othr();
}

class Id {
  PrvtId: PrvtId = new PrvtId();
}

class CtctDtls {
  MobNb = '';
}

class InitgPty {
  Nm = '';
  Id: Id = new Id();
  CtctDtls: CtctDtls = new CtctDtls();
}

export class GrpHdr {
  MsgId = '';
  CreDtTm = '';
  NbOfTxs = '';
  InitgPty: InitgPty = new InitgPty();
}
