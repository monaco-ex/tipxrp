/*
Copytight (c) 2017-2018 Monaco-ex LLC, Japan.

Licensed under MITL.
*/

const {RippleAPI} = require('ripple-lib');
const pgp = require('@monaco-ex/pg-promise')({});
const db = pgp(process.env.DATABASE_URL);

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

const getLedgerVersionRange = (tx) => {
  return Promise.all([
   tx.one('select version from since_ledger').then(result => parseInt(result.version) + 1),
   api.getLedger().then(res => res.ledgerVersion)
  ]); 
};

let current_ledger = 1;
const wallet_address = process.env.RIPPLE_ADDRESS;

const updateLedger = () => db
  .tx(tx =>
    api.connect()
      .then(() => getLedgerVersionRange(tx))
      .then(range => (current_ledger = (range[1] - range[0]) > 100000 ? range[0] + 100000 : range[1],
        console.log('Getting transactions between ' + range[0] + ' and ' + current_ledger + '. The latest is ' + range[1]),
        api.getTransactions(wallet_address, {
          minLedgerVersion: range[0],
          maxLedgerVersion: current_ledger
         })))
      .then(log => { console.log('updateLedger: ' + JSON.stringify(log)); return log; })
      .then(transactions => transactions.filter(x => 
        x.type === 'payment' &&
        x.outcome.result === 'tesSUCCESS' &&
        x.outcome.deliveredAmount.currency === 'XRP'))
      .then(filtered => filtered.map(x => {
        let destination_tag = x.specification.destination.tag;
        if (!destination_tag) {
          destination_tag = null;
        }
        const deposit_p = (x.specification.destination.address === wallet_address);
        const task1 = tx.none('insert into tx_journal (ledger_version, source, destination, xrp) values ($1, $2, $3, $4)', [
          x.outcome.ledgerVersion,
          x.specification.source.address,
          deposit_p
            ? destination_tag
            : x.specification.destination.address,
          (deposit_p ? 1 : -1) * x.outcome.deliveredAmount.value]);
        const queries = [];
        if (deposit_p) {
          if (destination_tag) {
            tx.none('insert into account (tag, balance) values ($1, 0) on conflict on constraint account_pkey do nothing',
              destination_tag);
            queries.push(tx.none('update account set balance = balance + $2 where tag = $1', [
              destination_tag,
              x.outcome.deliveredAmount.value ]));
          }
        } else {
          queries.push(tx.none('delete from pending_tx where txid = $1', x.id));
        }
        const task2 = tx.batch(queries);
        return Promise.all([task1, task2]);
      }))
      .then(() => tx.none('update since_ledger set version = $1 where version > 1', current_ledger))
      .then(() => api.disconnect()))
  .catch(console.error);

const getDestinationTag = (id_str) => db
  .tx(tx => 
    tx.batch([
      tx.none('insert into u (id_str) values ($1) on conflict on constraint u_pkey do nothing', id_str),
      tx.one('select tag, id_str from u where id_str = $1', id_str)])
      .then(results => results[1].tag))
  .catch(console.error);

const getWalletAddress = (id_str) => Promise.all([
  Promise.resolve(wallet_address),
  getDestinationTag(id_str)]);

const getBalance = (id_str) => db
  .tx(tx => 
    tx.oneOrNone('select balance from account, u where account.tag = u.tag and id_str = $1', id_str)
      .then(result => result ? result.balance : 0));

module.exports = {
  updateLedger: updateLedger,
  getWalletAddress: getWalletAddress,
  getBalance: getBalance,
  getDatabaseInstance: () => db
};
