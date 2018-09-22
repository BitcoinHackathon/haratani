let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default;
let BITBOX = new BITBOXCli({restURL: 'https://trest.bitcoin.com/v1/'});

let wormhole = require('wormholecash/lib/Wormhole').default;
let Wormhole = new wormhole({restURL: 'https://trest.bitcoin.com/v1/'});

function getNode(mnemonic) {
  let rootSeed = Wormhole.Mnemonic.toSeed(mnemonic);
  // master HDNode
  let masterHDNode = Wormhole.HDNode.fromSeed(rootSeed, "testnet");

  // HDNode of BIP44 account
  let account = Wormhole.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");

  // derive the first external change address HDNode
  let change = Wormhole.HDNode.derivePath(account, "0/0");

  return change;
}

function p2pkhScript(toAddress) {
  return [
    BITBOX.Script.opcodes.OP_DUP,
    BITBOX.Script.opcodes.OP_HASH160,
    Buffer.from(BITBOX.BitcoinCash.decodeBase58Check(BITBOX.Address.toLegacyAddress(toAddress)), 'hex'),
    BITBOX.Script.opcodes.OP_EQUALVERIFY,
    BITBOX.Script.opcodes.OP_CHECKSIG
  ]
}

function sendTransaction(node, txid, originalAmount, vout, toAddress, hashedSecret, unlockFor) {
  let transactionBuilder = new BITBOX.TransactionBuilder('testnet');

  transactionBuilder.addInput(txid, vout);

  let fee = 250;
  let sendAmount = originalAmount - fee;

  let data = BITBOX.Script.encode([
    BITBOX.Script.opcodes.OP_IF,
    BITBOX.Script.opcodes.OP_HASH160,
    hashedSecret,
    BITBOX.Script.opcodes.OP_EQUALVERIFY,
    ...p2pkhScript(toAddress),
    BITBOX.Script.opcodes.OP_ELSE,
    Date.now() + unlockFor,
    BITBOX.Script.opcodes.OP_CHECKLOCKTIMEVERIFY,
    BITBOX.Script.opcodes.OP_DROP,
    ...p2pkhScript(Wormhole.HDNode.toCashAddress(node))
  ]);
  transactionBuilder.addOutput(data, sendAmount);

  let keyPair = BITBOX.HDNode.toKeyPair(node);
  let redeemScript;
  transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL,
    originalAmount);

  let tx = transactionBuilder.build();
  let hex = tx.toHex();

  BITBOX.RawTransactions.sendRawTransaction(hex).then((result) => {
    console.log(result);
  }, (err) => {
    console.log(err);
  });
}

const secret = BITBOX.Crypto.randomBytes(32);

let mnemonic = 'abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change'

let node = getNode(mnemonic);
console.log(node);

let cashAddress = Wormhole.HDNode.toCashAddress(node);
let legacyAddress = Wormhole.Address.toLegacyAddress(cashAddress);
console.log(`cashAddress: ${cashAddress}`);
console.log(`cashAddress(legacy): ${legacyAddress}`);

(async () => {
  try {
    let details = await Wormhole.Address.details([cashAddress]);
    console.log(details);
    let utxo = await Wormhole.Address.utxo([cashAddress]);
    console.log(utxo);

    let result = await sendTransaction(
      node,
      utxo[0][0].txid,
      utxo[0][0].satoshis,
      utxo[0][0].vout,
      cashAddress,
      BITBOX.Crypto.hash160(secret),
      60 * 60 * 24 * 14 // 2 weeks
    );
    // console.log(result);
  } catch (error) {
    console.error(error);
  }
})();
