import { databaseManager } from '..';
import { type NetworkMap } from '@frmscoe/frms-coe-lib/lib/interfaces';
import { unwrap } from '@frmscoe/frms-coe-lib/lib/helpers/unwrap';

function getRuleMap(networkMap: NetworkMap | undefined): { rulesHost: string[]; tadpHost: string[] } {
  const rulesHost: string[] = new Array<string>();
  const tadpHost: string[] = new Array<string>();
  if (networkMap)
    for (const Message of networkMap?.messages) {
      if (tadpHost.findIndex((m: string) => m === Message.host) < 0) tadpHost.push(Message.host);
      if (Message.channels && Message.channels.length > 0)
        for (const channel of Message.channels) {
          if (channel.typologies && channel.typologies.length > 0)
            for (const typology of channel.typologies) {
              if (typology.rules && typology.rules.length > 0)
                for (const rule of typology.rules) {
                  if (rulesHost.findIndex((r: string) => r === rule.host) < 0) rulesHost.push(rule.host);
                }
            }
        }
    }
  return { rulesHost, tadpHost };
}

export const getRulesHostFromNetworkMap = async (): Promise<{ rulesHost: string[]; tadpHost: string[] }> => {
  const networkConfigurationList = await databaseManager.getNetworkMap();
  const unwrappedNetworkMap = unwrap<NetworkMap>(networkConfigurationList as NetworkMap[][]);
  const networkMap = getRuleMap(unwrappedNetworkMap);
  return { rulesHost: networkMap.rulesHost, tadpHost: networkMap.tadpHost };
};
