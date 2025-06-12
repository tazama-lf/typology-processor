<!-- SPDX-License-Identifier: Apache-2.0 -->

# Typology Processor

## Overview
An overview of the processor is detailed [here](https://github.com/tazama-lf/docs/blob/main/Product/typology-processing.md)

- [Typology Processor](#typology-processor)
  - [Overview](#overview)
  - [Inputs](#inputs)
  - [Internal process flow](#internal-process-flow)
  - [Example Output](#example-output)
  - [Environment variables](#environment-variables)
        - [Additional Variables](#additional-variables)
  - [Deployment](#deployment)
  - [Usage](#usage)
    - [Sample Typology Configuration](#sample-typology-configuration)
    - [Sample NATS subscription payload](#sample-nats-subscription-payload)
  - [Troubleshooting](#troubleshooting)
      - [npm install](#npm-install)
      - [npm build](#npm-build)

![](images/image-20220706-133859.png)

## Inputs

```js
{
  transaction: { 
    networkMap; // https://raw.githubusercontent.com/tazama-lf/frms-coe-lib/f2368a9b4613f446528feba55ffbe8d1b887038d/src/interfaces/NetworkMap.ts
    ruleResult; // https://raw.githubusercontent.com/tazama-lf/frms-coe-lib/f2368a9b4613f446528feba55ffbe8d1b887038d/src/interfaces/rule/RuleResult.ts
    transaction; // { TxTp: "pacs.002.001.12", "FIToFIPmtSts": { /* Pacs002 */ } }
    metaData: // { traceParent: "00-4bf92f3577b34da6a3ce928d0e0e4736-00f067aa0ba902b7-01" }
  }
};
```

## Internal process flow

```mermaid
flowchart TD
    start[Start] --> init[Initialize Processor]
    init --> listen[Listen for Transactions]
    received[Transaction Received]
    received --> handle[Handle Transaction]
    handle --> cache[Check Cache for Rules]
    cache -->|Cache Hit| hit[Use Cached Rules]
    cache -->|Cache Miss| nohit[Fetch Rules from DB]
    hit --> aggregate[Aggregate Rule Results]
    nohit --> aggregate[Aggregate Rule Results]
    aggregate --> score[Calculate Typology Score]
    score --> breach[Check Alert and Interdiction Thresholds]
    breach  --> interdict{Interdiction<br>Threshold<br>Breached?}
    interdict --> |Yes| suppress{Suppress<br>interdiction?}
    interdict --> |No| alert{Alert Threshold Breached}
    suppress --> |Yes| alert{Alert Threshold Breached}
    suppress --> |No| suppressN[Send to Interdiction Service]
    suppressN --> alert{Alert Threshold Breached}
    alert --> |Yes| alertY[Set review flag]
    alertY --> send[Send to TADProc]
    alert --> |No| send[Send to TADProc]
    send --> cleanup[Cleanup Cache]
    cleanup --> stop[End]
```

## Example Output
<details>

<summary>JSON structure of the payload the typology processor outputs</summary>

```js
{
  typologyResult: {
    id: "typology-processor@1.0.0",
    cfg: "999@1.0.0",
    result: 100,
    ruleResults: [
      {
        id: "EFRuP@1.0.0",
        cfg: "none",
        subRuleRef: "none",
        prcgTm: 8145412,
        wght: "0",
      },
      {
        id: "901@1.0.0",
        cfg: "1.0.0",
        subRuleRef: ".01",
        prcgTm: 67631142,
        wght: "100",
      },
    ],
    workflow: {
      alertThreshold: 200,
      interdictionThreshold: 400,
      flowProcessor: "EFRuP@1.0.0",
    },
    review: true,
    prcgTm: 25819313473,
  },
  transaction: {
    TxTp: "pacs.002.001.12",
    FIToFIPmtSts: {
      GrpHdr: {
        MsgId: "cf60b5b7734a4cec88778937a5a0d501",
        CreDtTm: "2025-06-12T08:08:08.472Z",
      },
      TxInfAndSts: {
        OrgnlInstrId: "b85b0975def8426895b7950d4962e808",
        OrgnlEndToEndId: "4b76ad6885ee4c948ce731fc06d68d31",
        TxSts: "ACCC",
        ChrgsInf: [
          {
            Amt: {
              Amt: 0,
              Ccy: "USD",
            },
            Agt: {
              FinInstnId: {
                ClrSysMmbId: {
                  MmbId: "fsp001",
                },
              },
            },
          },
          {
            Amt: {
              Amt: 0,
              Ccy: "USD",
            },
            Agt: {
              FinInstnId: {
                ClrSysMmbId: {
                  MmbId: "fsp001",
                },
              },
            },
          },
          {
            Amt: {
              Amt: 0,
              Ccy: "USD",
            },
            Agt: {
              FinInstnId: {
                ClrSysMmbId: {
                  MmbId: "fsp002",
                },
              },
            },
          },
        ],
        AccptncDtTm: "2023-06-02T07:52:31.000Z",
        InstgAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: "fsp001",
            },
          },
        },
        InstdAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: "fsp002",
            },
          },
        },
      },
    },
  },
  networkMap: {
    active: true,
    cfg: "1.0.0",
    messages: [
      {
        id: "004@1.0.0",
        cfg: "1.0.0",
        txTp: "pacs.002.001.12",
        typologies: [
          {
            id: "typology-processor@1.0.0",
            cfg: "999@1.0.0",
            rules: [
              {
                id: "EFRuP@1.0.0",
                cfg: "none",
              },
              {
                id: "901@1.0.0",
                cfg: "1.0.0",
              },
            ],
          },
        ],
      },
    ],
  },
  DataCache: {
    dbtrId: "dbtr_8abc80a7b7bc4ec88fd02a9adc56d3eaMSISDN",
    cdtrId: "cdtr_0938580d34414a4eaf45c3f8f201b9deTAZAMA_EID",
    cdtrAcctId: "cdtrAcct_95e04bcc6e54492599b8b4dd03e3333fTAZAMA_EIDfsp002",
    dbtrAcctId: "dbtrAcct_d87971a0bcc74519ae20c45a8b4d9dc5MSISDNfsp001",
    instdAmt: {
      amt: 110.05,
      ccy: "XTS",
    },
    intrBkSttlmAmt: {
      amt: 110.05,
      ccy: "XTS",
    },
    creDtTm: "2025-06-12T08:03:08.472Z",
  },
  metaData: {
    prcgTmDP: 12644208,
    prcgTmED: 35151190,
  },
}
```

<details>

## Environment variables

You then need to configure your environment: a [sample](.env.template) configuration file has been provided and you may adapt that to your environment. Copy it to `.env` and modify as needed:

```sh
cp .env.template .env
```
A [registry](https://github.com/tazama-lf/docs) of environment variables is provided to provide more context for what each variable is used for.

##### Additional Variables

| Variable | Purpose | Example
| ------ | ------ | ------ |
| `DATABASE_NAME` | ArangoDB database for TP | `configuration`
| `DATABASE_URL` | ArangoDB server URL | `tcp://arango:8529`
| `DATABASE_USER` | ArangoDB username | `root`
| `DATABASE_PASSWORD` | ArangoDB password for username | `<secure_user_password>`
| `DATABASE_CERT_PATH` | Certificate's path used for TLS by Arango | `<path_to_certificate>`
| `SUPPRESS_ALERTS` | Suppress forwarding of Typology Result to the interdiction service | `false`
| `INTERDICTION_PRODUCER` | The interdiction service NATS subject where typology interdiction threshold breaches will be reported | `interdiction-service`

## Deployment

## Usage

### Sample Typology Configuration

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
      "termId": "v003at100at100",
      "wghts": [
        {
          "ref": ".err",
          "wght": 0
        },
        {
          "ref": ".01",
          "wght": 0
        },
        {
          "ref": ".02",
          "wght": 400
        }
      ]
    },
    {
      "id": "EFRuP@1.0.0",
      "cfg": "none",
      "termId": "vEFRuPat100at100",
      "wghts": [
        {
          "ref": "block",
          "wght": 0
        },
        {
          "ref": "override",
          "wght": 0
        },
        {
          "ref": "none",
          "wght": 0
        }
      ]
    }
  ],
  "expression": [
    "Add", 
    "v003at100at100", 
    "v003at100at100"
  ]
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
}
```

## Troubleshooting
#### npm install
Ensure generated token has read package rights

#### npm build
Ensure that you're on the current LTS version of Node.JS
