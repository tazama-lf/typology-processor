// SPDX-License-Identifier: Apache-2.0
import { Apm } from '@tazama-lf/frms-coe-lib/lib/services/apm';
/*
 * Initialize the APM Logging
 **/
const apm = new Apm({
  usePathAsTransactionName: true,
});

export default apm;
