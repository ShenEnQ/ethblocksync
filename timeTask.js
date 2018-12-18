var task = require('./app');
let i = 0;
//start at 10:00 every day
let fs = require('fs');
let configFile = 'conf/config.json';
let configSource = fs.readFileSync(configFile).toString().trim();
let config = JSON.parse(configSource);


let date = new Date();
if (config.timeTask) {
    console.log('==============program died when task is running,and restart now,' + date.toLocaleString());
} else {
    console.log('==============program died and restart now, '+ date.toLocaleString());
}
//task.timeTask("0 */2 * * *", 7200, true);
task.timeTask("*/2 * * * *", 120, true);



setInterval(() => {
    console.log(new Date().toLocaleString() + '  time task service is running... ' + (i++));
}, 600 * 1000)

process.on('SIGTERM', function () {
    console.log('============ task进程退出1  ' + new Date().toLocaleString());
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