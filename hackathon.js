let BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default;
let BITBOX = new BITBOXCli({ restURL: 'https://trest.bitcoin.com/v1/' });

let wormhole = require('wormholecash/lib/Wormhole').default;
let Wormhole = new wormhole({ restURL: 'https://trest.bitcoin.com/v1/' });

// 送金する
function send(node, txid, originalAmount, vout, toAddress) {
    let transactionBuilder = new BITBOX.TransactionBuilder('testnet');

    transactionBuilder.addInput(txid, vout);

    let fee = 250;
    let sendAmount = originalAmount - fee;
    transactionBuilder.addOutput(toAddress, sendAmount);

    let keyPair = BITBOX.HDNode.toKeyPair(node);
    let redeemScript;
    transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

    let tx = transactionBuilder.build();
    let hex = tx.toHex();

    BITBOX.RawTransactions.sendRawTransaction(hex).then((result) => { console.log(result); }, (err) => { console.log(err); });
}

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

async function nulldata(node, txid, originalAmount, vout, toAddress) {
    let transactionBuilder = new BITBOX.TransactionBuilder('testnet');

    transactionBuilder.addInput(txid, vout);

    let fee = 250;
    let sendAmount = originalAmount - fee;
    transactionBuilder.addOutput(toAddress, sendAmount);

    let data = "BCHForEveryone";
    let buf = BITBOX.Script.nullData.output.encode(Buffer.from(data, 'ascii'));
    transactionBuilder.addOutput(buf, 0);

    let keyPair = BITBOX.HDNode.toKeyPair(node);
    let redeemScript;
    transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

    let tx = transactionBuilder.build();
    let hex = tx.toHex();

    return await BITBOX.RawTransactions.sendRawTransaction(hex)
}

// let mnemonic = Wormhole.Mnemonic.generate(256, Wormhole.Mnemonic.wordLists().english);
let mnemonic = 'abstract general fiscal enough behind patch nephew fever float parrot afford barely describe motion long that neither have raw shift index reveal cloth change'

let node = getNode(mnemonic);

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

        let result = await nulldata(node, utxo[0][0].txid, utxo[0][0].satoshis, utxo[0][0].vout, cashAddress);
        console.log(result);
    } catch (error) {
        console.error(error);
    }
})();

// cashaddr to legacy
// let legacyAddress = Wormhole.Address.toLegacyAddress(cashAddress);
// -> 'n4BLoZA6aPuGENJSfXRD8VfnHVCgUjNKWJ'


// send(change, '9cd7cdceda49b6ffbc224d00f18725a32d2af8bff5fcd46e3aa08ad3a31b3cc8', 88488, 0, 'bchtest:qzh9h74njtek0amehfpqwqjj6xygpzqvrc9l9hhjcy');


// balanceの取得
