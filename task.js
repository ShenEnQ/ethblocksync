var task = require('./app');
let i = 0;
//start at 10:00 every day
task.schduleTaskNew('0 00 03 * * *');
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