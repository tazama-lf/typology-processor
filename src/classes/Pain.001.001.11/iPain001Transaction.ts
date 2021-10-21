import { CdtTrfTxInf } from './CdtTrfTxInf';
import { GrpHdr } from './GrpHdr';
import { PmtInf } from './PmtInf';
import { SplmtryData } from './SplmtryData';

/* eslint-disable */
String.prototype.toMobileNumber = function (this: string) {
  if (!this || this.length < 4) return this;
  let toReturn = this.replace('+', '');
  toReturn = `+${toReturn.substr(0, 3)}-${toReturn.substr(3)}`;
  return toReturn;
};

class CstmrCdtTrfInitn {
  MsgId = '';
  GrpHdr: GrpHdr = new GrpHdr();
  PmtInf: PmtInf = new PmtInf();
  SplmtryData: SplmtryData = new SplmtryData();
}

export class Pain001V11Transaction {
  TxTp = 'pain.001.001.11';
  CstmrCdtTrfInitn: CstmrCdtTrfInitn = new CstmrCdtTrfInitn();

  constructor(init: Partial<Pain001V11Transaction>) {
    if (!init) {
      throw new Error('Pain001V11Transaction was not received in the request body');
    }

    // We assign all the properties present in the init parameter to the object we are creating.
    Object.assign(this, init);
  }
}
