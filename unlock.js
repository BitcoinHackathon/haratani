let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default;
let BITBOX = new BITBOXCli({restURL: 'https://trest.bitcoin.com/v1/'});

const secret = Buffer.from("cb5394594391c66e5573bf79f9b2a8a54a4df3726efd45f8913dd57763a82c0a", "hex");
const p2script = Buffer.from("63a9145a25871c72b30b770911c945d28c90e44a7c4d668768", "hex");
const scriptAddr = "bchtest:pp5zcxexs3m0xmhv4gfs4gysc5lhgm938un4u7yk28";

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

let mnemonic = 'abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change'
mnemonic = 'defense simple crew earn matter mask coral jeans twelve split finger armed'
let node = getNode(mnemonic);
console.log(node);

let cashAddress = BITBOX.HDNode.toCashAddress(node);
let legacyAddress = BITBOX.Address.toLegacyAddress(cashAddress);
console.log(`cashAddress: ${cashAddress}`);
console.log(`cashAddress(legacy): ${legacyAddress}`);

function sendTransaction(node, txid, originalAmount, vout, toAddress, secret, redeemScript) {
  let transactionBuilder = new BITBOX.TransactionBuilder('testnet');

  transactionBuilder.addInput(txid, vout);

  let fee = 500;
  let sendAmount = originalAmount - fee;

  transactionBuilder.addOutput(toAddress, sendAmount);

  let encodedScript = BITBOX.Script.encode(redeemScript);
  let key = BITBOX.HDNode.toKeyPair(node);

  let hashType = 0xc1;

  let tx = transactionBuilder.transaction.buildIncomplete()

  let sigHash = tx.hashForWitnessV0(0, encodedScript, originalAmount, hashType);

  let hostSig = key.sign(sigHash).toScriptSignature(hashType);

  let unlockScript = [
    secret,
    BITBOX.Script.opcodes.OP_TRUE,
  ]

  let children = unlockScript.concat(redeemScript);

  let encodedUnlockScript = BITBOX.Script.encode(children);

  tx.setInputScript(0, encodedUnlockScript);

  let hex = tx.toHex();
  console.log(hex);

  BITBOX.RawTransactions.sendRawTransaction(hex).then((result) => { console.log(result); }, (err) => { console.log(err); });
}

(async () => {
  try {
    let details = await BITBOX.Address.details([scriptAddr]);
    console.log(details);
    let utxo = await BITBOX.Address.utxo([scriptAddr]);
    console.log(utxo);

    let result = await sendTransaction(
      node,
      utxo[0][0].txid,
      utxo[0][0].satoshis,
      utxo[0][0].vout,
      cashAddress,
      secret,
      p2script
    );
    // console.log(result);
  } catch (error) {
    console.error(error);
  }
})();
