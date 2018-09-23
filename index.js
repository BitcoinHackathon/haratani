let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default;
let BITBOX = new BITBOXCli({restURL: 'https://trest.bitcoin.com/v1/'});

const _ = require('lodash');
const secret = Buffer.from("cb5394594391c66e5573bf79f9b2a8a54a4df3726efd45f8913dd57763a82c0a", "hex");

function getNode(mnemonic) {
  let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic);
  // master HDNode
  let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, "testnet");

  // HDNode of BIP44 account
  let account = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");

  // derive the first external change address HDNode
  let change = BITBOX.HDNode.derivePath(account, "0/0");

  return change;
}

async function sendTransaction(node, sendAmount, toAddress, hashedSecret, unlockFor) {
  let transactionBuilder = new BITBOX.TransactionBuilder('testnet');

  // add input
  let utxos = _.chain(await BITBOX.Address.utxo([cashAddress]))
    .flatten()
    .orderBy(['satoshis'], ['desc'])
    .value();
    console.log(utxos)

  const originalAmount = utxos.reduce((r, utxo) => {
    // TODO: confirmation数を加味する
    transactionBuilder.addInput(utxo.txid, utxo.vout);
    return r + utxo.satoshis;
  }, 0);

  // お釣りを計算
  let fee = 500;
  let changeAmount = originalAmount - sendAmount - fee;

  // 取引用outputを追加
  let lockTimeBuf = Buffer.alloc(4);
  lockTimeBuf.writeUInt32LE(Math.floor(Date.now() / 1000) + unlockFor, 0);

  let data = BITBOX.Script.encode([
    BITBOX.Script.opcodes.OP_IF,
    BITBOX.Script.opcodes.OP_HASH160,
    hashedSecret,
    BITBOX.Script.opcodes.OP_EQUAL,
    BITBOX.Script.opcodes.OP_ENDIF
  ]);
  console.log(`p2script: ${data.toString('hex')}`);

  let p2sh_hash160 = BITBOX.Crypto.hash160(data);
  let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);
  let address = BITBOX.Address.fromOutputScript(scriptPubKey);
  console.log(`script addr: ${address}`);

  transactionBuilder.addOutput(address, sendAmount);

  // お釣りを追加
  transactionBuilder.addOutput(BITBOX.HDNode.toCashAddress(node), changeAmount);

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

let mnemonic = 'abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change'
mnemonic = 'defense simple crew earn matter mask coral jeans twelve split finger armed'

let node = getNode(mnemonic);
console.log(node);

let cashAddress = BITBOX.HDNode.toCashAddress(node);
let legacyAddress = BITBOX.Address.toLegacyAddress(cashAddress);
console.log(`cashAddress: ${cashAddress}`);
console.log(`cashAddress(legacy): ${legacyAddress}`);

(async () => {
  try {

    let result = await sendTransaction(
      node,
      2000,
      cashAddress,
      BITBOX.Crypto.hash160(secret),
      60 * 60 * 24 * 14 // 2 weeks
    );
    console.log(result);
  } catch (error) {
    console.error(error);
  }
})();
