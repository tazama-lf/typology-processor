export interface IConfig {
  redisDB: string;
  redisAuth: string;
  redisHost: string;
  redisPort: number;
  grpcPort: number;
  restPort: number;
  logstashHost: string;
  logstashPort: number;
  functionName: string;
  cadpEndpoint: string;
  apmLogging: boolean;
  apmSecretToken: string;
  apmURL: string;
  dev: string;
  druidEndpoint: string;
}
