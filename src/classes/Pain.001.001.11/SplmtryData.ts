class Glctn {
  Lat = '';
  Long = '';
}

class InitgPty {
  InitrTp = '';
  Glctn: Glctn = new Glctn();
}

class Doc {
  InitgPty: InitgPty = new InitgPty();
}

class Envlp {
  Doc: Doc = new Doc();
}

export class SplmtryData {
  Envlp: Envlp = new Envlp();
}
