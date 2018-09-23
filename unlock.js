let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default;
let BITBOX = new BITBOXCli({restURL: 'https://trest.bitcoin.com/v1/'});

let wormhole = require('wormholecash/lib/Wormhole').default;
let Wormhole = new wormhole({restURL: 'https://trest.bitcoin.com/v1/'});

const secret = Buffer.from("e3fc868e27cbd6ac67264c2bfea1c4f97a4d72db7810f44e75382a0d4bb04d22", "hex");
const p2script = Buffer.from("63a914ce447aea9359c747e9b1403ed6fc4543a06b1de68876a9196fae5bfab392f367f779ba42070252d18880880c1e4129a21d88ac67042bedb85bb17576a9196fae5bfab392f367f779ba42070252d18880880c1e4129a21d88ac68", "hex");
const scriptAddr = "bchtest:pqyvjfrgff4fvw3z8s9qst3sss87ms8rqv6das3tu2";


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

let mnemonic = 'abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change'
let node = getNode(mnemonic);
console.log(node);

let cashAddress = Wormhole.HDNode.toCashAddress(node);
let legacyAddress = Wormhole.Address.toLegacyAddress(cashAddress);
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

  transactionBuilder.sign(0, key, undefined, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount)

  let hashType = 0xc1;

  let tx = transactionBuilder.transaction.buildIncomplete()

  let sigHash = tx.hashForWitnessV0(0, encodedScript, originalAmount, hashType);

  let hostSig = key.sign(sigHash).toScriptSignature(hashType);

  let unlockScript = [
    BITBOX.ECPair.toPublicKey(key),
    hostSig,
    secret,
    BITBOX.Script.opcodes.OP_TRUE,
    redeemScript.length,
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
    let details = await Wormhole.Address.details([scriptAddr]);
    console.log(details);
    let utxo = await Wormhole.Address.utxo([scriptAddr]);
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
