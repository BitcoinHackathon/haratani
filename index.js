let BITBOXCli = require("bitbox-cli/lib/bitbox-cli").default;
let BITBOX = new BITBOXCli({ restURL: "https://trest.bitcoin.com/v1/" });

const _ = require("lodash");

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

async function sendTransaction(
  node,
  sendAmount,
  toAddress,
  hashedSecret,
  unlockFor
) {
  let transactionBuilder = new BITBOX.TransactionBuilder("testnet");

  // add input
  let utxos = _.chain(await BITBOX.Address.utxo([cashAddress]))
    .flatten()
    .orderBy(["satoshis"], ["desc"])
    .value();
  console.log("utxos:", utxos);

  const originalAmount = utxos.reduce((r, utxo) => {
    // TODO: confirmation数を加味する
    // console.log(utxo);
    return false;
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
    BITBOX.Script.opcodes.OP_EQUALVERIFY,
    ...p2pkhScript(toAddress),
    BITBOX.Script.opcodes.OP_ELSE,
    lockTimeBuf,
    BITBOX.Script.opcodes.OP_CHECKLOCKTIMEVERIFY,
    BITBOX.Script.opcodes.OP_DROP,
    ...p2pkhScript(BITBOX.HDNode.toCashAddress(node)),
    BITBOX.Script.opcodes.OP_ENDIF
  ]);
  // console.log(`p2script: ${data.toString("hex")}`);

  let p2sh_hash160 = BITBOX.Crypto.hash160(data);
  let scriptPubKey = BITBOX.Script.scriptHash.output.encode(p2sh_hash160);
  let address = BITBOX.Address.fromOutputScript(scriptPubKey, "testnet");
  console.log("addy", address);
  // console.log(`script addr: ${address}`);

  transactionBuilder.addOutput(address, sendAmount);

  // お釣りを追加
  transactionBuilder.addOutput(BITBOX.HDNode.toCashAddress(node), changeAmount);

  let keyPair = BITBOX.HDNode.toKeyPair(node);
  let redeemScript;
  transactionBuilder.sign(
    0,
    keyPair,
    redeemScript,
    transactionBuilder.hashTypes.SIGHASH_ALL,
    originalAmount
  );

  let tx = transactionBuilder.build();
  let hex = tx.toHex();

  BITBOX.RawTransactions.sendRawTransaction(hex).then(
    result => {
      // console.log(result);
    },
    err => {
      // console.log(err);
    }
  );
}

const secret = BITBOX.Crypto.randomBytes(32);
// console.log(`secret: ${secret.toString("hex")}`);

let mnemonic =
  "abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change";

let node = getNode(mnemonic);
// console.log(node);

let cashAddress = BITBOX.HDNode.toCashAddress(node);
let legacyAddress = BITBOX.Address.toLegacyAddress(cashAddress);
// console.log(`cashAddress: ${cashAddress}`);
// console.log(`cashAddress(legacy): ${legacyAddress}`);

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
