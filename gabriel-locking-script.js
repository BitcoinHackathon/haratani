let BITBOXCli = require("bitbox-cli/lib/bitbox-cli").default;
let BITBOX = new BITBOXCli({ restURL: "https://trest.bitcoin.com/v1/" });
let mnemonic =
  "abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change";

// root seed buffer
let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic);
console.log(rootSeed);

function p2pkhScript(toAddress) {
  return [
    BITBOX.Script.opcodes.OP_DUP,
    BITBOX.Script.opcodes.OP_HASH160,
    Buffer.from(
      BITBOX.BitcoinCash.decodeBase58Check(
        BITBOX.Address.toLegacyAddress(toAddress)
      ),
      "hex"
    ),
    BITBOX.Script.opcodes.OP_EQUALVERIFY,
    BITBOX.Script.opcodes.OP_CHECKSIG
  ];
}

// master HDNode
let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, "testnet");

// HDNode of BIP44 account
let account = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");
console.log(account);

// derive the HDNode
let node = BITBOX.HDNode.derivePath(account, "0/0");

// HDNode to cashAddress
let cashAddress = BITBOX.HDNode.toCashAddress(node);

// create instance of Transaction Builder class
let transactionBuilder = new BITBOX.TransactionBuilder("testnet");

// set original amount, txid and vout
let originalAmount = 56574;
let txid = "a26552abaed853aadd9a03a662f3d490df9dc0a3c39a3f3e809a74703e4b1664";
let vout = 0;

// add input
transactionBuilder.addInput(txid, vout);

// set fee and send amount
let fee = 350;
let sendAmount = originalAmount - fee;

// const secret = BITBOX.Crypto.randomBytes(32);
let secret = Buffer.from(
  "c10caa0769f52404c854e969579a4d3ac80b9bdca7dc3092421e34d1f293e215",
  "hex"
);
console.log(`secret: ${secret.toString("hex")}`);

// encode custom script
let data = BITBOX.Script.encode([
  BITBOX.Script.opcodes.OP_IF,
  BITBOX.Script.opcodes.OP_HASH160,
  BITBOX.Crypto.hash160(secret),
  BITBOX.Script.opcodes.OP_EQUALVERIFY,
  ...p2pkhScript(cashAddress),
  BITBOX.Script.opcodes.OP_ENDIF
]);

// hash160 script buffer
let p2sh_hash160 = BITBOX.Crypto.hash160(data);

// encode hash160 as P2SH output
let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);

// derive address from P2SH output
let address = BITBOX.Address.fromOutputScript(scriptPubKey, "testnet");

// add output
transactionBuilder.addOutput(address, sendAmount);

// HDNode to keypair
let key = BITBOX.HDNode.toKeyPair(node);

// empty redeemScript var
let redeemScript;

// sign input
transactionBuilder.sign(
  0,
  key,
  redeemScript,
  transactionBuilder.hashTypes.SIGHASH_ALL,
  originalAmount
);

// build to hex
let hex = transactionBuilder.build().toHex();
console.log(hex);

// POST to BCH network
BITBOX.RawTransactions.sendRawTransaction(hex).then(
  result => {
    console.log(result);
  },
  err => {
    console.log(err);
  }
);
