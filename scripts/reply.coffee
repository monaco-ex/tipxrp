###
Copytight (c) 2017-2018 Monaco-ex LLC, Japan.

Licensed under MITL.
###
# Description
#   hubot scripts for diagnosing hubot
#
# Commands:
#   hubot tip @destination <num>
#   hubot giveme
#   hubot balance
#   hubot deposit
#   hubot withdraw <num> <XRPaddress>
#   hubot getcode
#   hubot invited
#
# Author:
#   Tip XRP <tipple@monaco-ex.org>

utils = require './utils'
withdraw = require './withdraw'
tip = require './tip'

randomTail = () ->
  "....".substring(Math.random() * 4) + "!!!".substring(Math.random() * 3)

module.exports = (robot) ->
  robot.respond /TIP\s+@(.*)\s+(([1-9]\d*|0)(\.\d+)?).*$/i, (msg) ->
    tip
      .doIt(msg.message.data.user.id_str, msg.match[1], +(msg.match[2]))
      .then () ->
        if msg.match[1] == 'tipxrp'
          msg.send "@#{msg.message.user.name} Thank you for your donation#{randomTail()}!"
        else
          msg.send "@#{msg.message.user.name} Sent #{msg.match[2]}XRP to @#{msg.match[1]}#{randomTail()}"
      .catch (error) ->
        msg.send "@#{msg.message.user.name} Fail to send. (msg: #{error.message})"

  robot.respond /GIVEME(\s.*)?$/i, (msg) ->
    msg.send "@#{msg.message.user.name} Faucet will not be implemented. Sorry#{randomTail()}"

  robot.respond /BALANCE(\s.*)?$/i, (msg) ->
    utils
      .getBalance(msg.message.data.user.id_str)
      .then (balance) ->
        msg.send "@#{msg.message.user.name} You have #{balance}XRP#{randomTail()}"

  robot.respond /DEPOSIT(\s.*)?$/i, (msg) ->
    utils
      .getWalletAddress(msg.message.data.user.id_str)
      .then (address) ->
        msg.send "@#{msg.message.user.name} Your XRP address/desination tag is #{address[0]} / #{address[1]}#{randomTail()}"

  robot.respond /WITHDRAW\s+(([1-9]\d*|0)(\.\d+)?)\s+((r\S{33})(\?dt=(\d+))?)(\s.*)?$/i, (msg) ->
    withdraw
      .doIt(msg.message.data.user.id_str, msg.match[5], +(msg.match[1]), +(msg.match[7]))
      .then (result) ->
        msg.send "@#{msg.message.user.name} Sending your #{result[0]}XRP (incl. tx fee #{result[1]}). txid: #{result[2]}"
      .catch (error) ->
        msg.send "@#{msg.message.user.name} Error in your withdrawal. (msg: #{error.message})"
        console.error error

  robot.respond /GETCODE(\s.*)?$/i, (msg) ->
    msg.send "@#{msg.message.user.name} Invitation program will not be implemented. Sorry#{randomTail()}"

  robot.respond /INVITED(\s.*)?$/i, (msg) ->
    msg.send "@#{msg.message.user.name} Invitation program will not be implemented. Sorry#{randomTail()}"

  robot.respond /FOLLOWME(\s.*)?$/i, (msg) ->
    robot.logger.info "followed #{msg.message.user.name}!"
    console.dir msg.message.user
    robot.adapter.join msg.message.user

  robot.respond /HELP(\s.*)?$/i, (msg) ->
    msg.send "@#{msg.message.user.name} Please open https://tipxrp.monaco-ex.org/"
