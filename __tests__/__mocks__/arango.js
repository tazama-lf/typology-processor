const arangojs = require('arangojs');

class MockDatabase {
  constructor(config) {
    return {
      exists() {
        return true;
      },
      isArangoDatabase: true,
    };
  }
}

module.exports = { ...arangojs, Database: MockDatabase };
