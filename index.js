var Downloader = require('./lib/downloader.js');
var options = {
  host: 'localhost',
  port : 3010,
  path: '/getVideos/sample/index.m3u8'
};

var downloader = new Downloader(options, 'tmpVideos/sample');
downloader.startDownload();
downloader.on('finished', function (){
    console.log('Finished');
});

downloader.on('eror', function(){
    console.log('Error');
});

downloader.on('progress', function(){
    console.log('progress');
});
