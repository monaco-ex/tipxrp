/*
Copytight (c) 2017-2018 Monaco-ex LLC, Japan.

Licensed under MITL.
*/
'use strict';

const {RippleAPI} = require('ripple-lib');
const utils = require('./utils');
const db = utils.getDatabaseInstance();
const Twit = require('twit-promise');
const twit = new Twit({
  consumer_key: process.env.HUBOT_TWITTER_KEY,
  consumer_secret: process.env.HUBOT_TWITTER_SECRET,
  access_token: process.env.HUBOT_TWITTER_TOKEN,
  access_token_secret: process.env.HUBOT_TWITTER_TOKEN_SECRET,
  timeout_ms: 60*1000
});

const tip = (id_str, dest_screen_name, value) => 
  twit.get('users/show', { screen_name: dest_screen_name })
    .then(result => {
      const data = result.data;
      if (!data.id_str) {
        throw new Error('Unknown user');
      }
      return db.tx(t => t.batch([
        t.none('insert into u (id_str) values ($1) on conflict on constraint u_pkey do nothing', id_str),
        t.none('insert into u (id_str) values ($1) on conflict on constraint u_pkey do nothing', data.id_str),
        t.one('select tag from u where id_str = $1', id_str),
        t.one('select tag from u where id_str = $1', data.id_str),
        t.one('select balance from u, account where id_str = $1 and u.tag = account.tag', id_str)])
        .then(x => {
           const src = x[4].balance;
           if (src - value < 0) {
             throw new Error('Balance is too low to tip. Please deposit.');
           }
           return t.batch([
            t.none('insert into account (balance, tag) values (0, $1) on conflict on constraint account_pkey do nothing', x[3].tag),
            t.none('update account set balance = balance - $1 where tag = $2', [value, x[2].tag]),
            t.none('update account set balance = balance + $1 where tag = $2', [value, x[3].tag]),
            t.none('insert into tip_journal (source, destination, xrp) values($1, $2, $3)', [id_str, data.id_str, value])]);
        }))
    })

module.exports = {
  doIt: tip
};
