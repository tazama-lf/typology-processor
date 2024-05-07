Sample configuration:

```json
{
  "typology_name": "Typology_29",
  "typology_version": "1.1",
  "rules_values": [
    {
      "rule_id": "Rule_15_1.4",
      "rule_true_value": "70",
      "rule_false_value": "0"
    },
    {
      "rule_id": "Rule_27_1.0",
      "rule_true_value": "77",
      "rule_false_value": "0"
    },
    {
      "rule_id": "Rule_05_1.0",
      "rule_true_value": "90",
      "rule_false_value": "5"
    }
  ],
  "typology_expression": {
    "operation": "+",
    "values": ["Rule_05_1.0", "Rule_27_1.0"],
    "nested_expression": {
      "operation": "-",
      "values": ["Rule_27_1.0", "Rule_15_1.4"],
      "nested_expression": {
        "operation": "*",
        "values": ["Rule_15_1.4", "Rule_05_1.0"]
      }
    }
  }
}
```

---

Sample HTTP request to /execute endpoint:

```json
{
    "transaction": {
        "GroupHeader": {
            "InitiatingParty": {
                "Identification": {
                    "ContactDetails": {
                        "MobileNumber": "Hello"
                    },
                    "Identification": "c5249c18-3518-4975-82a2-5313bd6661f1",
                    "Other": {
                        "ContactDetails": {
                            "MobileNumber": "Hello"
                        },
                        "Identification": "2b04e485-bd4b-4c8c-8ec1-2d31ca07c848",
                        "PrivateIdentification": {
                            "DateAndPlaceOfBirth": {
                                "Birthdate": "Hello"
                            }
                        },
                        "SchemeName": {
                            "Proprietary": "Hello"
                        }
                    },
                    "PrivateIdentification": {
                        "DateAndPlaceOfBirth": {
                            "Birthdate": "Hello"
                        }
                    },
                    "SchemeName": {
                        "Proprietary": "Hello"
                    }
                },
                "Name": "'ABD AL-MALIK2"
            }
        },
        "PaymentInformation": {
            "CreditTransferTransactionInformation": {
                "Amount": {
                    "EquivalentAmount": {
                        "Amount": 1.1,
                        "CurrencyOfTransfer": "Hello"
                    },
                    "InstructedAmount": {}
                },
                "Creditor": {
                    "Identification": {
                        "ContactDetails": {
                            "MobileNumber": "Hello"
                        },
                        "Identification": "e838d001-5dd9-4e7d-a67f-285889ea9a09",
                        "Other": {
                            "ContactDetails": {
                                "MobileNumber": "Hello"
                            },
                            "Identification": "d8b2b3d0-e00b-4a92-8e45-60b4fdf0563b",
                            "PrivateIdentification": {
                                "DateAndPlaceOfBirth": {
                                    "Birthdate": "1989-07-132",
                                    "CityOfBirth": "Hello",
                                    "CountryOfBirth": "",
                                    "ProvinceOfBirth": "Hello"
                                }
                            },
                            "SchemeName": {
                                "Proprietary": "Hello"
                            }
                        },
                        "PrivateIdentification": {
                            "DateAndPlaceOfBirth": {
                                "Birthdate": "Hello"
                            }
                        },
                        "SchemeName": {
                            "Proprietary": "Hello"
                        }
                    },
                    "Name": "Hello"
                },
                "CreditorAccount": {
                    "Identification": {
                        "ContactDetails": {},
                        "Identification": "a58cc6c9-e0cf-41c6-bc67-e73c2240fa74",
                        "Other": {
                            "ContactDetails": {},
                            "Identification": "aec18357-04ec-4fb3-aefc-33579e6068b4",
                            "PrivateIdentification": {},
                            "SchemeName": {}
                        },
                        "PrivateIdentification": {},
                        "SchemeName": {}
                    },
                    "Name": "Hello",
                    "Proxy": "Hello"
                },
                "CreditorAgent": {
                    "FinancialInstitutionIdentification": {
                        "ClearingSystemMemberIdentification": {
                            "MemberIdentification": "Hello"
                        }
                    }
                },
                "PaymentIdentification": {
                    "EndToEndIdentification": "aec18362-04ec-4fb3-aefc-33579e6068b"
                },
                "PaymentTypeInformation": {
                    "CategoryPurpose": {
                        "Proprietary": "Hello"
                    }
                },
                "RegulatoryReporting": {
                    "Details": {
                        "Code": "Hello"
                    }
                },
                "RemittanceInformation": {
                    "Structured": {
                        "AdditionalRemittanceInformation": "Hello"
                    }
                },
                "SupplementaryData": {
                    "fees_amount": 1.1,
                    "fees_currency": "Hello"
                }
            },
            "Debtor": {
                "Identification": {
                    "ContactDetails": {},
                    "Identification": "e274ddc4-cc8c-4e7d-8d46-02fdee14a5d5",
                    "Other": {
                        "ContactDetails": {},
                        "Identification": "66d46c16-bcd6-43f0-adac-2a5d289529ba",
                        "PrivateIdentification": {},
                        "SchemeName": {}
                    },
                    "PrivateIdentification": {},
                    "SchemeName": {}
                },
                "Name": "Hello"
            },
            "DebtorAccount": {
                "Identification": {},
                "Name": "Hello",
                "Proxy": "Hello"
            },
            "DebtorAgent": {
                "FinancialInstitutionIdentification": {
                    "ClearingSystemMemberIdentification": {
                        "MemberIdentification": "Hello"
                    }
                }
            },
            "PaymentInformationIdentification": "Hello"
        },
        "SupplementaryData": {
            "geoCode_latitude": "Hello",
            "geoCode_longitude": "Hello",
            "payee_merchantClassificationCode": "Hello",
            "payer_merchantClassificationCode": "Hello",
            "transactionType_initiatorType": "Hello"
        }
    },
    "ruleResult": {
        "rule": "Rule_27_1.0",
        "result": true
    },
    "networkMap": {
        "transactions": [
            {
                "transaction_type": "pain.001.001.12",
                "transaction_name": "CustomerCreditTransferInitiationV11",
                "channels": [
                    {
                        "channel_id": "UUIDv4",
                        "channel_name": "Fraud",
                        "typologies": [
                            {
                                "typology_id": "Typology_29.1.0",
                                "typology_name": "Typology_29",
                                "typology_version": "1.0",
                                "rules": [
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_27_1.0",
                                        "rule_version": "1.0"
                                    },
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_15_1.4",
                                        "rule_version": "1.0"
                                    },
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_05_1.0",
                                        "rule_version": "1.0"
                                    }
                                ]
                            },
                            {
                                "typology_id": "Typology_30.1.0",
                                "typology_name": "Typology_30",
                                "typology_version": "1.0",
                                "rules": [
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_27_1.0",
                                        "rule_version": "1.0"
                                    },
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_15_1.4",
                                        "rule_version": "1.0"
                                    },
                                    {
                                        "rule_id": "UUIDv4",
                                        "rule_name": "Rule_05_1.0",
                                        "rule_version": "1.0"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ]
    }
} 
```
