import { type Pain001V11Transaction } from './Pain.001.001.11/iPain001Transaction';
import { type Typology } from '@frmscoe/frms-coe-lib/lib/interfaces';

export class RuleRequest {
  transaction: Pain001V11Transaction;
  typologies: Typology[];
  constructor(transaction: Pain001V11Transaction, typologies: Typology[]) {
    this.transaction = transaction;
    this.typologies = typologies;
  }
}
