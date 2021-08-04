/* eslint-disable @typescript-eslint/no-unsafe-call */
import { sendUnaryData, ServerUnaryCall, UntypedHandleCall } from '@grpc/grpc-js';
import { CustomerCreditTransferInitiation } from '../classes/iPain001Transaction';
import { NetworkMap, Typology } from '../classes/network-map';
import { RuleResult } from '../classes/rule-result';
import { IFlowFileServiceServer, FlowFileServiceService } from '../models/nifi_grpc_pb';
import { FlowFileReply, FlowFileRequest } from '../models/nifi_pb';
import { LoggerService } from '../services/logger.service';
import { handleTransaction } from '../services/logic.service';
import apm from 'elastic-apm-node';

/**
 * gRPC Health Check
 * https://github.com/grpc/grpc-node/tree/master/packages/grpc-health-check
 */
class Execute implements IFlowFileServiceServer {
  [method: string]: UntypedHandleCall;

  public async send(call: ServerUnaryCall<FlowFileRequest, FlowFileReply>, callback: sendUnaryData<FlowFileReply>): Promise<void> {    
    LoggerService.log('Start - Handle execute request');
    const res: FlowFileReply = new FlowFileReply();
    let networkMap: NetworkMap = new NetworkMap();
    let ruleResult: RuleResult = new RuleResult();
    let req: CustomerCreditTransferInitiation = new CustomerCreditTransferInitiation({});
    let sReqData = '';
    try {
      try {
        sReqData = Buffer.from(call.request.getContent_asB64(), 'base64').toString();
      } catch (error) {
        LoggerService.error(`Failed to parse execution request from base64 as Json`, error, 'typology.server.ts');
        throw error;
      }
      const request = JSON.parse(sReqData);
      networkMap = request.networkMap;
      ruleResult = request.ruleResult;
      req = request.transaction;
    } catch (parseError) {
      const failMessage = `Failed to parse execution request`;
      LoggerService.error(failMessage, parseError, 'typology.server.ts');
      LoggerService.log('End - Handle execute request');
      res.setResponsecode(0);
      res.setBody(failMessage);
      callback(null, res);
      return;
    }

    try {
      await handleTransaction(req, networkMap, ruleResult, callback);
    } catch (err) {
      const failMessage = 'Failed to process execution request.';
      LoggerService.error(failMessage, err, 'ApplicationService');
      res.setResponsecode(0);
      res.setBody(failMessage);
      callback(null, res);
      return;
    } finally {
      LoggerService.log('End - Handle execute request');
    }
  }
}

export default {
  service: FlowFileServiceService, // Service interface
  handler: new Execute(), // Service interface definitions
};
