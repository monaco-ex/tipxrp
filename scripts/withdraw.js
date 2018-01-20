/*
Copytight (c) 2017-2018 Monaco-ex LLC, Japan.

Licensed under MITL.
*/
'use strict';

const {RippleAPI} = require('ripple-lib');
const utils = require('./utils');
const db = utils.getDatabaseInstance();



const api = new RippleAPI({
  server: process.env.RIPPLED_URL
});

api.on('error', (errorCode, errorMessage) => {
  console.log(errorCode + ': ' + errorMessage);
});
api.on('connected', () => {
  console.log('connected');
});
api.on('disconnected', (code) => {
  // code - [close code](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) sent by the server
  // will be 1000 if this was normal closure
  console.log('disconnected, code:', code);
});

const withdraw = (id_str, dst_address, amount, dst_tag) => {
  const fee = 0.15;
  return checkBalance(id_str, amount)
    .then(() => submitTransaction(dst_address, amount, fee, dst_tag)
      .then(tx => db.tx(t => 
        t.one('select tag from u where id_str = $1', id_str)
         .then(result => updateDB(tx.txid, result.tag, amount, fee))
         .then(() => [amount, fee, tx.txid])
      )))
};

const checkBalance = (id_str, amount) => 
  db.tx(t =>
    t.one('select balance from account, u where id_str = $1 and account.tag = u.tag', id_str)
      .then(result => {
        if (result.balance < amount) {
          throw new Error('Insufficent balance. You have ' + result.balance + 'XRP');
        }}));

const updateDB = (txid, src_tag, amount, fee) =>
  db.tx(t => t.batch([
      t.none('update account set balance = balance - $1 where tag = $2', [amount, src_tag]),
      t.none('insert into pending_tx (txid, src_tag, amount) values($1, $2, $3)', [txid, src_tag, amount - fee])
    ]))
    .catch(console.error);

const submitTransaction = (dst_address, amount, fee, dst_tag) => db
  .tx(t => 
    api.connect()
      .then(() => 
        getPaymentTransaction(api, process.env.RIPPLE_ADDRESS, dst_address, amount, fee, dst_tag)
         .then(prepared => {
           const sign = api.sign(prepared.txJSON, process.env.RIPPLE_SECRET);
           const tx = JSON.parse(prepared.txJSON);
           tx.txid = sign.id;
           tx.hex = sign.signedTransaction;
           return api.submit(sign.signedTransaction)
             .then(result => {
               if (result.resultCode !== 'tesSUCCESS') {
                 throw new Error(result.resultMessage);
               }
               return tx;
             })
         }))
       .then(tx => (api.disconnect(), tx)));

const createPayment = (src_address, dst_address, amount, dst_tag) => {
  const XRP = 'XRP';
  const result = {
    "source": {
      "address": src_address,
      "maxAmount": {
        "value": amount.toString(),
        "currency": XRP
      }
    },
    "destination": {
      "address": dst_address,
      "amount": {
        "value": amount.toString(),
        "currency": XRP
      }
    }
  };
  if (dst_tag) {
    result.destination.tag = dst_tag;
  }
  return result;
}

const getPaymentTransaction = (api, src_address, dst_address, amount, fee, dst_tag) => {
  if (amount <= fee) {
    throw new Error('Cannot withdraw. Your balance is lesser than transfer fee.');
  }
  const instructions = {
    maxLedgerVersionOffset: 15,
    fee: ''+fee
  };
  const payment = createPayment(src_address, dst_address, amount - fee, dst_tag);
  return api.preparePayment(src_address, payment, instructions);
}

module.exports = {
  doIt: withdraw
}
