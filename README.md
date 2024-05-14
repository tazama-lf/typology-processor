# 4. Typology Processor

See also [Typology Processing](https://github.com/frmscoe/docs/blob/main/Product/typology-processing.md)

- [4. Typology Processor](#4-typology-processor)
  - [Code Activity Diagram](#code-activity-diagram)
  - [Code Repository](#code-repository)
  - [Usage](#usage)
    - [Sample Typology Expression](#sample-typology-expression)
    - [Sample NATS subscription payload](#sample-nats-subscription-payload)
    - [Sample response from TP:](#sample-response-from-tp)
  - [Testing](#testing)

![](images/image-20220706-133859.png)

## Code Activity Diagram

![](images/image-20231124-060051.png)

[https://github.com/ActioFRM/uml-diagrams/blob/main/TP.plantuml](https://github.com/ActioFRM/uml-diagrams/blob/main/TP.plantuml)

## Code Repository

[https://github.com/ActioFRM/typology-processor](https://github.com/ActioFRM/typology-processor)

### Configure environment

| Variable | Purpose | Example
| ------ | ------ | ------ |
| `FUNCTION_NAME` | Denotes the type of application that is running. This is also used in logs to show the source of logs | `TP`
| `NODE_ENV` | Represents the environment the ampplication is currently running in | `dev`
| `MAX_CPU` | Max number of CPUs to use | `1`
| `CMS_PRODUCER` | NATS topic for forwarding of interdicting typologies to a CMS | `CMS`
| `DATABASE_NAME` | ArangoDB database for TP | `Configuration`
| `DATABASE_URL` | ArangoDB server URL | `tcp://arango:8529`
| `COLLECTION_NAME` | ArangoDB collection inside database for Typology Expressions | `typologyExpression`
| `DATABASE_NETWORKMAP` | ArangoDB collection inside database for Network Map | `networkmap`
| `DATABASE_USER` | ArangoDB username | `root`
| `DATABASE_PASSWORD` | ArangoDB password for username | `<secure_user_password>`
| `DATABASE_CERT_PATH` | Certificate's path used for TLS by Arango | `<path_to_certificate>`
| `CACHE_ENABLED` | Redis Cache integration for ArangoDB is redis config is provided | `false`
| `CACHE_TTL` | TTL of Cache entries | `1000`
| `SIDECAR_HOST` | Sidecar log host | `sidecar-url:5000`
| `LOGSTASH_HOST` | The endpoint at where logstash is served | `http://0.0.0.0`
| `LOGSTASH_PORT` | The port of where logstash is served | `9700`
| `LOGSTASH_LEVEL` | Level of log granularity | `log`, `debug`, `trace` `warn` `error`
| `APM_ACTIVE` | A flag configuring whether Application Performance Monitoring is enabled | `true`
| `APM_SERVICE_NAME` | A name to identify the application from APM log | `TP`
| `APM_URL` | Endpoint at which APM is reached | `<apm-url>`
| `APM_SECRET_TOKEN` | Token used to auth with APM | `<some secret>`
| `REDIS_DB` | Redis database index (default redis has 16 ie. 0~15) | `0`
| `REDIS_SERVERS` | [Redis] Host in json format | `[{"host":"redis", "port":6379}]`
| `REDIS_IS_CLUSTER` | A flag to indicate if [Redis] is served in cluster mode | `false`
| `REDIS_AUTH` | [Redis] password | `01ARZ3Example`

## Usage

### Sample Typology Expression

```json
{
  "desc": "Use of several currencies, structured transactions, with a great number of persons involved, large number of transactions related to each other during a short time period.",
  "id": "typology-processor@1.0.0",
  "cfg": "001@1.0.0",
  "workflow": {
    "alertThreshold": 800
  },
  "rules": [
    {
      "id": "003@1.0.0",
      "cfg": "1.0.0",
      "ref": ".err",
      "true": 0,
      "false": 0
    },
    {
      "id": "003@1.0.0",
      "cfg": "1.0.0",
      "ref": ".01",
      "true": 0,
      "false": 0
    },
    {
      "id": "003@1.0.0",
      "cfg": "1.0.0",
      "ref": ".02",
      "true": 400,
      "false": 0
    }
  ],
  "expression": {
    "operator": "+",
    "terms": [
      {
        "id": "083@1.0.0",
        "cfg": "1.0.0"
      }
    ]
  }
}
```

### Sample NATS subscription payload

```json
{
    "transaction": {
        "TxTp": "pain.001.001.11",
        "CstmrCdtTrfInitn": {
            "GrpHdr": {
                "MsgId": "2669e349-500d-44ba-9e27-7767a16608a0",
                "CreDtTm": "2021-10-07T09:25:31.000Z",
                "NbOfTxs": 1,
                "InitgPty": {
                    "Nm": "Ivan Reese Russel-Klein",
                    "Id": {
                        "PrvtId": {
                            "DtAndPlcOfBirth": {
                                "BirthDt": "1967-11-23",
                                "CityOfBirth": "Unknown",
                                "CtryOfBirth": "ZZ"
                            },
                            "Othr": {
                                "Id": "+27783078685",
                                "SchmeNm": {
                                    "Prtry": "MSISDN"
                                }
                            }
                        }
                    },
                    "CtctDtls": {
                        "MobNb": "+27-783078685"
                    }
                }
            },
            "PmtInf": {
                "PmtInfId": "b51ec534-ee48-4575-b6a9-ead2955b8069",
                "PmtMtd": "TRA",
                "ReqdAdvcTp": {
                    "DbtAdvc": {
                        "Cd": "ADWD",
                        "Prtry": "Advice with transaction details"
                    }
                },
                "ReqdExctnDt": {
                    "Dt": "2021-10-07",
                    "DtTm": "2021-10-07T09:25:31.000Z"
                },
                "Dbtr": {
                    "Nm": "Ivan Reese Russel-Klein",
                    "Id": {
                        "PrvtId": {
                            "DtAndPlcOfBirth": {
                                "BirthDt": "1967-11-23",
                                "CityOfBirth": "Unknown",
                                "CtryOfBirth": "ZZ"
                            },
                            "Othr": {
                                "Id": "+27783078685",
                                "SchmeNm": {
                                    "Prtry": "MSISDN"
                                }
                            }
                        }
                    },
                    "CtctDtls": {
                        "MobNb": "+27-783078685"
                    }
                },
                "DbtrAcct": {
                    "Id": {
                        "Othr": {
                            "Id": "+27783078685",
                            "SchmeNm": {
                                "Prtry": "PASSPORT"
                            }
                        }
                    },
                    "Nm": "Ivan Russel-Klein"
                },
                "DbtrAgt": {
                    "FinInstnId": {
                        "ClrSysMmbId": {
                            "MmbId": "dfsp001"
                        }
                    }
                },
                "CdtTrfTxInf": {
                    "PmtId": {
                        "EndToEndId": "c51ec534-ee48-4575-b6a9-ead2955b8069"
                    },
                    "PmtTpInf": {
                        "CtgyPurp": {
                            "Prtry": "TRANSFER"
                        }
                    },
                    "Amt": {
                        "InstdAmt": {
                            "Amt": {
                                "Amt": "50431891779910900",
                                "Ccy": "USD"
                            }
                        },
                        "EqvtAmt": {
                            "Amt": {
                                "Amt": "50431891779910900",
                                "Ccy": "USD"
                            },
                            "CcyOfTrf": "USD"
                        }
                    },
                    "ChrgBr": "DEBT",
                    "CdtrAgt": {
                        "FinInstnId": {
                            "ClrSysMmbId": {
                                "MmbId": "dfsp002"
                            }
                        }
                    },
                    "Cdtr": {
                        "Nm": "April Sam Adamson",
                        "Id": {
                            "PrvtId": {
                                "DtAndPlcOfBirth": {
                                    "BirthDt": "1923-04-26",
                                    "CityOfBirth": "Unknown",
                                    "CtryOfBirth": "ZZ"
                                },
                                "Othr": {
                                    "Id": "+27782722305",
                                    "SchmeNm": {
                                        "Prtry": "MSISDN"
                                    }
                                }
                            }
                        },
                        "CtctDtls": {
                            "MobNb": "+27-782722305"
                        }
                    },
                    "CdtrAcct": {
                        "Id": {
                            "Othr": {
                                "Id": "+27783078685",
                                "SchmeNm": {
                                    "Prtry": "MSISDN"
                                }
                            }
                        },
                        "Nm": "April Adamson"
                    },
                    "Purp": {
                        "Cd": "MP2P"
                    },
                    "RgltryRptg": {
                        "Dtls": {
                            "Tp": "BALANCE OF PAYMENTS",
                            "Cd": "100"
                        }
                    },
                    "RmtInf": {
                        "Ustrd": "Payment of USD 49932566118723700.89 from Ivan to April"
                    },
                    "SplmtryData": {
                        "Envlp": {
                            "Doc": {
                                "Cdtr": {
                                    "FrstNm": "Ivan",
                                    "MddlNm": "Reese",
                                    "LastNm": "Russel-Klein",
                                    "MrchntClssfctnCd": "BLANK"
                                },
                                "Dbtr": {
                                    "FrstNm": "April",
                                    "MddlNm": "Sam",
                                    "LastNm": "Adamson",
                                    "MrchntClssfctnCd": "BLANK"
                                },
                                "DbtrFinSvcsPrvdrFees": {
                                    "Ccy": "USD",
                                    "Amt": "499325661187237"
                                },
                                "Xprtn": "2021-10-07T09:30:31.000Z"
                            }
                        }
                    }
                }
            },
            "SplmtryData": {
                "Envlp": {
                    "Doc": {
                        "InitgPty": {
                            "InitrTp": "CONSUMER",
                            "Glctn": {
                                "Lat": "-3.1291",
                                "Long": "39.0006"
                            }
                        }
                    }
                }
            }
        }
    },
    "ruleResult": {
        "rule": "003@1.0.0",
        "result": true,
        "subRuleRef": "123"
        "prcgTm": 123456,
        "wght": 0
    },
    "networkMap": {
        "active": true,
        "cfg": "1.0.0",
        "messages": [
            {
                "id": "004@1.0.0",
                "host": "NATS Server",
                "cfg": "1.0.0",
                "txTp": "pacs.002.001.12",
                "channels": [
                    {
                        "id": "001@1.0.0",
                        "host": "NATS Server",
                        "cfg": "1.0.0",
                        "typologies": [
                            {
                                "id": "typology-processor@1.0.0",
                                "host": "NATS Server",
                                "cfg": "001@1.0.0",
                                "rules": [
                                    {
                                        "id": "003@1.0.0",
                                        "host": "RuleRequest003",
                                        "cfg": "1.0.0"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

### Sample response from TP:

> :exclamation: BROKEN IN CONFLUENCE

## Testing

Jenkins is [configured](https://frmjenkins.sybrin.com/job/Testing/job/typology_processor/) to execute the [TypologyProcessorTests.json](https://github.com/ActioFRM/postman/blob/main/TypologyProcessorTests.json)