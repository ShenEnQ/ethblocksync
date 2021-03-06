﻿var task = require('./app');
let i = 0;
//start at 10:00 every day
let fs = require('fs');
let configFile = 'conf/config.json';
let configSource = fs.readFileSync(configFile).toString().trim();
let config = JSON.parse(configSource);


if (config.isRunning) {
    let date = new Date();
    date.setMinutes(date.getMinutes() + 3);
    console.log(date.toLocaleString()+'  died when task is running,and restart now')
    console.log(date.toLocaleString()+"============task will run right now");
    task.schduleTaskNew(date, null);//run right now
    //avoid two schdules start at the sametime
    let interval = setInterval(function () {
        configSource = fs.readFileSync(configFile).toString().trim();
        config = JSON.parse(configSource);
        let now = new Date();
        if (!config.isRunning) {
            task.schduleTaskNew('0 00 03 * * *', null);
            clearInterval(interval);
            console.log(now.toLocaleString() + '==========temp task finished, a regular task created');
        } else {
            console.log(now.toLocaleString() + '==========temp task is running, a regular task waitting to start');
        }
        
    }, 1000 * 60);
} else {
    console.log(new Date().toLocaleString()+'==============program died and restart now')
    task.schduleTaskNew('0 00 03 * * *', null);
}

setInterval(() => {
    console.log('service is running... '+ (i++));
}, 600 * 1000)

process.on('SIGTERM', function () {
    console.log('============ task进程退出1  '+new Date().toLocaleString());
    process.exit(0);
});

process.on('SIGINT', function () {
    console.log('============ task进程退出2  ' + new Date().toLocaleString());
    process.exit(0);
});


process.on('uncaughtException', function (err) {
    console.log('uncaughtException-->' + err.stack + '--' + new Date().toLocaleDateString() + '-' + new Date().toLocaleTimeString());
    process.exit();
});