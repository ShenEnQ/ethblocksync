'use strict';
var Web3 = require("web3");
var BigNumber = require('bignumber.js');
var _ = require("underscore")._;
let fs = require('fs');
const path = require('path');
let httpRequest = require('request');

var baseService = require('./baseService');
var schedule = require('node-schedule');



var decimail_error_file = 'decimal_err.log';
var event_decimail_error_file = 'event_decimal_err.log';
let configFile = 'conf/config.json';
let taskRecordPath = 'conf/taskrecord.txt';
let addressInfoPath = 'conf/addressInfo.txt';
let timeTaskPath = 'conf/timetask.txt';

var [provider, web3] = baseService.createNewProvider();



//main();
//test();
//schduleTask();
if (require.main === module) {
    //main();
    //schduleTask();
    
    //locateEndBlockNumber(new Date(), 3600);
    timeTask("*/5 * * * *", 300,true);
}

async function test() {
    //must load dictionary first
    await baseService.loadTokenContractDict( addressInfoPath);
    let blockHigh = await baseService.getBlockHeight();
    let block = await baseService.getBlock(5904575);
    if (block) {
        let count = 0;
        let transactions = block.transactions;
        if (transactions.length > 0) {
            count++;
            for (let j = 0; j < transactions.length; j++) {
                processTransaction(transactions[j], 0, 'test.log', 0,block);
            }
        }
    }
}

//Start the task manually
async function main() {
    //must load dictionary first
    await baseService.loadTokenContractDict(addressInfoPath);
    let startBlock = 6075340;
    let total = 100000;
    let blockStep = 10000;
    let arg = process.argv;
    if (arg.length > 2 && arg[2]) {
        startBlock = parseInt(arg[2]);
        total = parseInt(arg[3]);
    }
    decimail_error_file = 'decimal_error_' + startBlock + "_" + total + ".log";
    console.log('program will start at block:' + startBlock);
    for (let i = 0; i <1; i++){
        batchRun(startBlock + i * total, total, blockStep,i,false);
    }
}




async function batchRun(startBlock, total,blockStep, thNumber,isSchdule) {
    let begin = new Date().getTime();
    if (total < blockStep)
        blockStep = total
    let curPage = startBlock;

    console.log(thNumber + '#  ' + startBlock + "-" + (startBlock + total));
    await baseService.sleep(3);
    for (let i = startBlock; i < startBlock + total; i++) {

        if (i > curPage + blockStep) {
            curPage = i-1;
        }
        let logFileName = 'block-' + curPage + '-' + (curPage + blockStep) + '.txt';
        if (isSchdule) {
            let nowDate = new Date().toLocaleDateString();
            logFileName = 'schdule-' + nowDate + '.txt';
        }
        //let sourceFileName = './source_data/source-' + curPage + '-' + (curPage + blockStep) + '.txt';

        let block = await baseService.getBlock(i);
        if (block) {
            let transactions = block.transactions;
            if (transactions.length > 0) {
                for (let j = 0; j < transactions.length; j++) {
                    processTransaction(transactions[j], 0, logFileName, thNumber, block);   
                    //saveSource(transactions[j], 0, sourceFileName, thNumber, block)
                }
                //await sleep(0.05);
            }
            console.log(thNumber + "#block " + i + " over:" + transactions.length + '  finished: ' + new BigNumber(i - startBlock).dividedBy(total).multipliedBy(100).toPrecision(3)+" %");
        }
        //await sleep(0.5);
    }
    let end = new Date().getTime();
    console.log('do =' + total + ',use time:' + (end - begin) / 1000 / 60 + ' min');
}

async function saveSource(txHash, failTimes, fileName, threadNumber, block) {
    if (failTimes > 100) {
        console.log("======================== Save to File fail,jump this transaction :" + txHash);
        return;
    }
    let tran = await baseService.getTransaction(txHash);
    let receipt = await baseService.getTransferReceipt(txHash);
    if (tran && receipt) {
        baseService.logToFile(block.number + '##' + block.timestamp + '##' + JSON.stringify(tran) + '##' + JSON.stringify(receipt), fileName);
    }
}


async function processTransaction(txHash, failTimes,logFileName,threadNumber,block) {
    if (failTimes > 30) {
        console.log("======================== processTransaction fail,jump this transaction !!!!!!");
        return;
    }
    let is_error = '';
    let from = '';
    let to = '';
    let contrac_add = '';
    let amount = '';
    let eth_token_type = '';
    let time = '';
    let transaction_type = '';
    let txhash = '';
    let txfee = '';
    let gas = '';

    let method_id = '';  
    try {
        let transaction = await baseService.getTransaction(txHash);
        let receipt = await baseService.getTransactionReceipt(txHash);
        if (transaction && receipt) {   
            txhash = transaction.hash;
            //'0xa9059cbb' =>transfer;  '0x23b872dd' => transferFrom
            if ((transaction.input.startsWith('0xa9059cbb') || transaction.input.startsWith('0x23b872dd')) && transaction.value ==0) {
                contrac_add = transaction.to;
                transaction_type = 'token_transfer'
                //if method is transfer
                if (transaction.input.startsWith('0xa9059cbb')) {
                    let dataArr = baseService.getTransferParams(transaction.input);
                    from = transaction.from;
                    method_id = dataArr[0];
                    to = dataArr[1];
                    amount = dataArr[2];
                }//if method is transferFrom
                else if (transaction.input.startsWith('0x23b872dd')) {    
                    let dataArr = baseService.getTransferFromParams(transaction.input);
                    method_id = dataArr[0];
                    from = dataArr[1];
                    to = dataArr[2];
                    amount = dataArr[3];
                }
                let decimal = await baseService.getDecimal(contrac_add, txHash, decimail_error_file);
                amount = new BigNumber(amount).dividedBy(10 ** parseInt(decimal)).toString(10);
                if (baseService.contractMap[contrac_add]) {
                    eth_token_type = baseService.contractMap[contrac_add];
                }
                
                
                if (receipt.status != undefined) {
                    is_error = !receipt.status;
                } else {
                    is_error = await baseService.getTrxStatusFromEtherScan(txHash);
                    //is_error = false;
                }
                if (is_error == false && receipt.logs.length == 0) {
                    console.log('===============' + method_id+'  failed trx, event logs is empty,trx: ' + txHash)
                    is_error = true;
                }

                gas = receipt.gasUsed;
                txfee = new BigNumber(receipt.gasUsed).multipliedBy(new BigNumber(transaction.gasPrice).dividedBy(10 ** 18)).toNumber();
                time = block.timestamp;

                let final_res = {
                    is_error: is_error,
                    from: from,
                    to: to,
                    contrac_add: contrac_add,
                    amount: amount,
                    eth_token_type: eth_token_type,
                    time: time,
                    transaction_type: transaction_type,
                    txhash: txhash,
                    txfee: txfee,
                    gas: gas,
                    block: transaction.blockNumber,
                    method_id: method_id,
                    block_hash: block.hash
                };
                baseService.logToFile(_.values(final_res).toString(), logFileName);
            } else if (transaction.value > 0 ) {//eth tranfer trx
                transaction_type = 'eth_trade';
                let receipt = await baseService.getTransactionReceipt(txHash);
                //if block number less than 43700000, receipt.status is undefined
                if (receipt.status != undefined) {
                    is_error = !receipt.status;
                } else {
                    is_error = await baseService.getTrxStatusFromEtherScan(txHash); 
                }
                gas = receipt.gasUsed;
                txfee = new BigNumber(receipt.gasUsed).multipliedBy(new BigNumber(transaction.gasPrice).dividedBy(10 ** 18)).toNumber();
                
                time = block.timestamp;
                let amount = new BigNumber(transaction.value).dividedBy(10 ** 18).toString(10);
                let final_res = {
                    is_error: is_error,
                    from: transaction.from,
                    to: transaction.to,
                    contrac_add: '',
                    amount: amount,
                    eth_token_type: 'ETH',
                    time: time,
                    transaction_type: transaction_type,
                    txhash: transaction.hash,
                    txfee: txfee,
                    gas: gas,
                    block: transaction.blockNumber,
                    method_id: '',
                    block_hash: block.hash
                }
                baseService.logToFile(_.values(final_res).toString(), logFileName);
            }
            else if (receipt.logs.length>0){
                //console.log('input data is empty: ' + transaction.input+" ##############  "+txHash);
                let logArray = receipt.logs;
                for (let i = 0; i < logArray.length; i++) {
                    let logItem = logArray[i];
                    //if event is Transfer
                    let transfer_sign = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
                    if (logItem.topics.length > 0 && logItem.topics[0] == transfer_sign) {
                        is_error = !receipt.status;
                        contrac_add = transaction.to;
                        if (logItem.data.startsWith('0x')) {
                            logItem.data = logItem.data.substring(2);
                        }
                        if (logItem.topics.length > 1) {
                            from = web3.eth.abi.decodeParameter('address', logItem.topics[1]);
                            to = web3.eth.abi.decodeParameter('address',logItem.topics[2]);
                            amount = web3.eth.abi.decodeParameter('uint256',logItem.data);
                        } else {//Erc-721 contract
                            //from = web3.eth.abi.decodeParameter('address', logItem.data.substr(0, 64));
                            //to = web3.eth.abi.decodeParameter('address', logItem.data.substr(64, 64)); 
                            //amount = web3.eth.abi.decodeParameter('uint256', logItem.data.substr(128, 64));
                            //jump
                            continue;
                        }
                        
                        let decimal = await baseService.getDecimal(contrac_add, txHash, event_decimail_error_file);
                        amount = new BigNumber(amount).dividedBy(10 ** parseInt(decimal)).toString(10);
                        if (amount == 'NaN') {
                            continue;
                        }
                        if (baseService.contractMap[contrac_add]) {
                            eth_token_type = baseService.contractMap[contrac_add];
                        }
                        transaction_type = 'inner_token_transfer';
                        gas = receipt.gasUsed;
                        
                        txfee = new BigNumber(receipt.gasUsed).multipliedBy(new BigNumber(transaction.gasPrice).dividedBy(10 ** 18)).toNumber();
                        let final_res = {
                            is_error: is_error,
                            from: from,
                            to: to,
                            contrac_add: contrac_add,
                            amount: amount,
                            eth_token_type: eth_token_type,
                            time: block.timestamp,
                            transaction_type: transaction_type,
                            txhash: txhash,
                            txfee: txfee,
                            gas: gas,
                            block: transaction.blockNumber,
                            method_id: transfer_sign,
                            block_hash: block.hash
                        };
                        baseService.logToFile(_.values(final_res).toString(), logFileName);
                    }
                }
            }
        }
    } catch (e) {
        if (e.message.indexOf("decode uint256 from") > 0) {
            console.log("Couldn't decode uint256 from...return : " + txHash);
            return;
        }
        let s = Math.floor(Math.random() * 5 + 1) + 3;//4 ~ 9
        console.error(threadNumber+"#"+failTimes + '---Get this tx info error ,sleep:'+s+"    "+ txHash,e);
        await baseService.sleep(s);
        await processTransaction(txHash, failTimes + 1, logFileName, threadNumber);
    }
}


async function locateYesterdayEndBlockNumber(specified_date) {
    let currentBlockNum = await baseService.getBlockHeight();
    let now = new Date();
    if (specified_date) {
        now = new Date(specified_date);
    }
    now.setHours(0, 0, 0, 0);
    let endTimestamp = now.getTime() / 1000;
    let startTimestamp = endTimestamp - 24 * 3600;
    let searchStep = 50;//Do not initialize to 1 

    while (true) {
        let block = await baseService.getBlock(currentBlockNum);

        if (block.timestamp < endTimestamp) {
            if (searchStep == 1) {
                break;
            }

            currentBlockNum += searchStep;
            searchStep = 1;
            continue;

        } else {
            let curFormatDate = new Date(block.timestamp * 1000).toLocaleString();
            console.log('step:' + searchStep + '================   jump block : ' + currentBlockNum + ' -- ' + curFormatDate);
            currentBlockNum -= searchStep;
        }
    }
    return [startTimestamp, endTimestamp, currentBlockNum];
}


/*
*  cronRule(string)
*  intervalSeconds(int): Synchronize from the block before the current number of seconds
*  beginFromLast(bool):Whether it is from the position where the last synchronization ended, if false, intervalSeconds effect.
*
*/
async function timeTask(cronRule, intervalSeconds, beginFromLast) {
    await baseService.loadTokenContractDict(addressInfoPath);
    console.log('==============Time Task Created===================');
    schedule.scheduleJob(cronRule, async function () {
        let begin = new Date().getTime();
        let nowTime = new Date();
         //update config first, update the flag
        let config = JSON.parse(fs.readFileSync(configFile).toString().trim());
        let needClear = config.timeTask;
        config.timeTask = true;
        fs.writeFileSync(configFile, JSON.stringify(config));

        let [startDate, endDate, startBlock, endBlock] = await locateEndBlockNumber(nowTime, intervalSeconds);
        let traskRecordArray = await baseService.loadTaskRecord(timeTaskPath);
        if (traskRecordArray && traskRecordArray.length > 0 && beginFromLast) {
            let arry = traskRecordArray.pop().split('#');
            startBlock = parseInt(arry[3]);
        }
        console.log('schdule task will start: ', startDate.toLocaleString(), '###', endDate.toLocaleString(), '###', startBlock, '###', endBlock);
        let dirName = new Date().toLocaleDateString();
        fs.existsSync(dirName) == false && fs.mkdirSync(dirName);
        let dataFile = dirName + '/task-' + new Date().getHours()+ '-' + startBlock + '-' + endBlock + '.txt';
        if (needClear) {
            baseService.clearFile(dataFile);
        }
        let currentBlockNum = startBlock;
        while (true) {
            if (currentBlockNum >= endBlock) {
                break;
            }
            let block = await baseService.getBlock(currentBlockNum);
            if (!block) {
                baseService.sleep(5);
                console.log('get block failed,try again later....: ' + currentBlockNum);
                continue;
            }
            let blockFormatDate = new Date(block.timestamp * 1000).toLocaleString();
            let transactions = block.transactions;
            if (transactions.length > 0) {
                for (let j = 0; j < transactions.length; j++) {
                    processTransaction(transactions[j], 0, dataFile, 0, block);
                }
            }
            console.log("#block " + currentBlockNum + " over:" + transactions.length + ' -- ' + blockFormatDate);
            currentBlockNum += 1;
        }
        baseService.sleep(10);
        config = JSON.parse(fs.readFileSync(configFile).toString().trim());
        config.timeTask = false;
        fs.writeFileSync(configFile, JSON.stringify(config));

        baseService.logToFile(startDate.toLocaleString() + "#" + endDate.toLocaleString() + "#" + startBlock + "#" + endBlock, timeTaskPath);
        let end = new Date().getTime();
        console.log('schdule task finish: ' + startBlock + ' - ' + currentBlockNum + ', use time:' + (end - begin) / 1000 / 60 + ' min');
    });
}


//Download yesterday's block
async function schduleTaskNew(cronRule, specifyDate) {
    //must load dictionary first
    await baseService.loadTokenContractDict(addressInfoPath);
    console.log('==============Schedule Task Created===================');
    schedule.scheduleJob(cronRule, async function () {//
        let configSource = fs.readFileSync(configFile).toString().trim();
        let config = JSON.parse(configSource);
        let needClear = config.isRunning;
        config.isRunning = true;
        fs.writeFileSync(configFile, JSON.stringify(config));

        let [startTimestamp, endTimestamp, currentBlockNum] = await locateYesterdayEndBlockNumber(specifyDate);

        let begin = new Date().getTime();
        let startBlock = 0;

        console.log('=========================schdule task will start: ' + startTimestamp + ' - ' + endTimestamp + ' -- ' + currentBlockNum);
        let nowDate = new Date(startTimestamp * 1000).toLocaleDateString();
        let logFileName = 'schdule-' + nowDate + '.txt';

        if (needClear) {
            baseService.clearFile(logFileName);
        }
        while (true) {
            let block = await baseService.getBlock(currentBlockNum);
            if (!block) {
                baseService.sleep(5);
                console.log('get block failed,try again later....: ' + currentBlockNum);
                continue;
            }
            let curFormatDate = new Date(block.timestamp * 1000).toLocaleString();
            if (block.timestamp >= startTimestamp && block.timestamp < endTimestamp) {
                if (startBlock == 0) {
                    startBlock = currentBlockNum;
                }
                let transactions = block.transactions;
                if (transactions.length > 0) {
                    for (let j = 0; j < transactions.length; j++) {
                        processTransaction(transactions[j], 0, logFileName, 0, block);
                    }
                    //await sleep(0.05);
                }
                console.log("#block " + currentBlockNum + " over:" + transactions.length + ' -- ' + curFormatDate);
            } else if (block.timestamp < startTimestamp) {
                break;
            } else {
                console.log('================out   jump block : ' + currentBlockNum + ' -- ' + curFormatDate);
            }
            currentBlockNum -= 1;
        }
        await baseService.sleep(10);

        config = JSON.parse(fs.readFileSync(configFile).toString().trim());
        config.isRunning = false;
        fs.writeFileSync(configFile, JSON.stringify(config));

        baseService.logToFile(nowDate + "###" + currentBlockNum + " - " + startBlock, taskRecordPath);
        let end = new Date().getTime();
        console.log('schdule task finish: ' + startBlock + ' - ' + currentBlockNum + ', use time:' + (end - begin) / 1000 / 60 + ' min');
    });

}


async function locateEndBlockNumber(now, intervalSeconds) {
    let startDate = new Date(now.getTime() - intervalSeconds * 1000);
    console.log('locate start:', startDate.toLocaleString(), ' ------  ', now.toLocaleString() ); 
    let currentBlockNum = -1;
    while (currentBlockNum == -1) {
        currentBlockNum = await baseService.getBlockHeight();
        baseService.sleep(5);
    }
    await baseService.sleep(3);
    let endTimestamp = now.getTime() / 1000;
    let startTimestamp = endTimestamp - intervalSeconds;
    let searchStep = 10;//Do not initialize to 1 

    let startBlock = 0;
    let endBlock = 0;
    let startFlag = true;
    let endFlag = true;
    while (true) {
        let block = await baseService.getBlock(currentBlockNum);
        if (!block) {
            console.log(currentBlockNum + ' block is null');
            currentBlockNum -= 1;
            continue;
        }

        if (block.timestamp < endTimestamp && endFlag) {
            if (searchStep == 1) {
                endBlock = currentBlockNum;
                endFlag = false;
                searchStep = 10;
                continue;
            }
            currentBlockNum += searchStep;
            searchStep = 1;
            continue;

        } else if (block.timestamp < startTimestamp && startFlag) {
            if (searchStep == 1) {
                startBlock = currentBlockNum;
                startFlag = false;
                break;
            }
            currentBlockNum += searchStep;
            searchStep = 1;
            continue;
        } else {
            let curFormatDate = new Date(block.timestamp * 1000).toLocaleString();
            console.log('step:' + searchStep + '================   jump block : ' + currentBlockNum + ' -- ' + curFormatDate);
            currentBlockNum -= searchStep;
        }
    }
    console.log('locate result :', startTimestamp, endTimestamp, startBlock, endBlock);
    return [startDate, now, startBlock, endBlock];
}

exports.schduleTaskNew = schduleTaskNew;
exports.timeTask = timeTask;