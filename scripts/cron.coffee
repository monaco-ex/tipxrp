###
Copytight (c) 2017-2018 Monaco-ex LLC, Japan.

Licensed under MITL.
###

cron = require('cron').CronJob
utils = require './utils'

module.exports = (robot) ->
  new cron '*/20 * * * * *', utils.updateLedger, null, true
  console.log 'Ledger will be updated.'
