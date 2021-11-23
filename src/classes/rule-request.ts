import { Pain001V11Transaction } from './Pain.001.001.11/iPain001Transaction';
import { Typology } from './network-map';

export class RuleRequest {
  transaction: Pain001V11Transaction;
  typologies: Array<Typology>;
  constructor(transaction: Pain001V11Transaction, typologies: Array<Typology>) {
    this.transaction = transaction;
    this.typologies = typologies;
  }
}
