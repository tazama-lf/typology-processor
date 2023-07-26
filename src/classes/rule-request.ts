import { type Pain001V11Transaction } from './Pain.001.001.11/iPain001Transaction';
import { type Typology } from './network-map';

export class RuleRequest {
  transaction: Pain001V11Transaction;
  typologies: Typology[];
  constructor(transaction: Pain001V11Transaction, typologies: Typology[]) {
    this.transaction = transaction;
    this.typologies = typologies;
  }
}
