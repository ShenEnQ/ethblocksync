var baseService = require('./baseService');
var Web3 = require("web3");
var [provider, web3] = baseService.createNewProvider();
async function  main() {
    let begin = new Date().getTime();
    console.log('program start');
    let startBlockNumber = 5445108;
    let curBlockNumber = startBlockNumber;
    let stopBlockNumber = 4370000;
    while (curBlockNumber >= stopBlockNumber && startBlockNumber >= stopBlockNumber) {
        let block = await baseService.getBlock(curBlockNumber);
        if (block) {
            console.log(curBlockNumber + '###' + block.hash);
            baseService.logToFile(curBlockNumber + '###' + block.hash, 'block_info.txt');
            curBlockNumber -= 1;
        }
        if (curBlockNumber % 10 == 0) {
            //console.log(startBlockNumber - curBlockNumber);
            //console.log((startBlockNumber - curBlockNumber) * 1.0 / (startBlockNumber - stopBlockNumber));
            let percent =100 *  Math.floor((startBlockNumber - curBlockNumber) * 1.0 / (startBlockNumber - stopBlockNumber) * 10000) / 10000;
            console.log(curBlockNumber + ' ---------------- finished: ' + percent + ' %');
        }
       
    }
    let end = new Date().getTime();
    console.log('program end, use time:' + (end - begin) / 1000 / 60 + ' min');
}

main();