let BITBOXCli = require("bitbox-cli/lib/bitbox-cli").default;
let BITBOX = new BITBOXCli({ restURL: "https://trest.bitcoin.com/v1/" });
let mnemonic =
  "abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change";

// root seed buffer
let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic);

// master HDNode
let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, "testnet");

// HDNode of BIP44 account
let account = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");

// derive the HDNode
let node = BITBOX.HDNode.derivePath(account, "0/0");

// HDNode to cashAddress
let cashAddress = BITBOX.HDNode.toCashAddress(node);

// create instance of Transaction Builder class
let transactionBuilder = new BITBOX.TransactionBuilder("testnet");

// set original amount, txid and vout
let originalAmount = 57424;
let txid = "5bf5671bab207f3f45751f3bb7fd0607684da163ada8e5edb805b0d54b20e3d4";
let vout = 0;

// add input
transactionBuilder.addInput(txid, vout);

// set fee and send amount
let fee = 250;
let sendAmount = originalAmount - fee;
console.log(sendAmount);

// add output
transactionBuilder.addOutput(cashAddress, sendAmount);

// const secret = BITBOX.Crypto.randomBytes(32);
let secret = Buffer.from(
  "c10caa0769f52404c854e969579a4d3ac80b9bdca7dc3092421e34d1f293e215",
  "hex"
);
console.log(`secret: ${secret.toString("hex")}`);

// encode custom script
let lockingScript = BITBOX.Script.encode([
  BITBOX.Crypto.hash160(secret),
  BITBOX.Script.opcodes.OP_EQUAL
]);

// encode locking script
let encodedScript = BITBOX.Script.encode(lockingScript);
console.log("locking", BITBOX.Script.toASM(encodedScript));

// HDNode to keypair
let key = BITBOX.HDNode.toKeyPair(node);

// set hash type
let hashType = 0xc1;

// call buildIncomplete
let tx = transactionBuilder.transaction.buildIncomplete();

// create sighash
let sigHash = tx.hashForWitnessV0(0, encodedScript, originalAmount, hashType);

// create hostSig
let hostSig = key.sign(sigHash).toScriptSignature(hashType);

// create unlocking script
let unlockingScript = [BITBOX.Crypto.hash160(secret)];

// concat scripts together
let children = unlockingScript.concat(lockingScript);

// encode scripts
let encodedScript2 = BITBOX.Script.encode(unlockingScript);
console.log("unlocking", BITBOX.Script.toASM(encodedScript2));

// set input script
tx.setInputScript(0, encodedScript2);

// to hex
let hex = tx.toHex();
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
// 59c8960607a0cc4e3c8ce45d71ee1671e3d76d9b135de761ddac26360ac36302
