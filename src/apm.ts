// SPDX-License-Identifier: Apache-2.0
import { Apm } from '@tazama-lf/frms-coe-lib/lib/services/apm';
import { configuration } from './config';
/*
 * Initialize the APM Logging
 **/
const apm = new Apm({
  serviceName: configuration.apm?.serviceName,
  secretToken: configuration.apm?.secretToken,
  serverUrl: configuration.apm?.url,
  usePathAsTransactionName: true,
  active: configuration.apm?.active?.toLowerCase() === 'true',
});

export default apm;
