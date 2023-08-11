import apm from 'elastic-apm-node';
import { configuration } from './config';
/*
 * Initialize the APM Logging
 **/
if (configuration.apm.active === 'true') {
  apm.start({
    serviceName: configuration.apm?.serviceName,
    secretToken: configuration.apm?.secretToken,
    serverUrl: configuration.apm?.url,
    usePathAsTransactionName: true,
    active: Boolean(configuration.apm?.active),
  });
}
