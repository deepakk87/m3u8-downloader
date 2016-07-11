var m3u8 = require('m3u8');
var http = require('http');
var fs   = require('fs');
var util = require('util');
var touch = require('touch');
var util = require('util'),
    EventEmitter = require('events').EventEmitter;
module.exports = function (options , tmpDir) {
    this.options = options;
    this.tmpDir = tmpDir;
    this.queue = {};
    this.done = [];
    if (!fs.existsSync(tmpDir)){
        fs.mkdirSync(tmpDir);
    }
    //TODO ::  If the file Content has changed I want to Download It.
    this.fileDownloadAndUpdateStatus = function (fileUrl, cb){
        this.queue[fileUrl].started = true;
        var filename = fileUrl.split('/').pop();
        stats = fs.lstatSync(tmpDir + '/' + filename);
        // Is it a file?
        if (!stats.isFile()) {
            var writeStream = fs.createWriteStream(tmpDir + '/' + filename + '.download');
                        var url = JSON.parse(JSON.stringify(this.options));
                        url.path = fileUrl;
                        console.log('Segment to download');
                        console.log(url);
                        var request = http.get(url, function (response) {
                            response.pipe(writeStream);
                            writeStream.on('finish', function () {
                                if (response.headers['last-modified'])
                                touch.ftouchSync(fd, { 'mtime': new Date(response.headers['last-modified']) });
                                writeStream.close();
                                fs.rename(tmpDir + '/' + filename + '.download', tmpDir + '/' + filename, function (err) {
                                    if (!err){
                                        this.queue[fileUrl].finished = true;
                                        this.queue[fileUrl].error = null;
                                        this.queue[fileUrl].errorCount = 0;
                                        cb();
                                    }else{
                                        this.queue[fileUrl].error = err;
                                        this.queue[fileUrl].errorCount++;
                                        cb();
                                    }
                                });
                            });
                        }, function (err) {
                            //TODO :: If an error occur 
                            this.queue[fileUrl].error = err;
                            this.queue[fileUrl].errorCount++;
                            cb();
                        });
        }else{
            this.queue[fileUrl].finished = true;
            this.queue[fileUrl].error = null;
            this.queue[fileUrl].errorCount = 0;
            cb();
        }
    };

    this.downloadAllSegments = function(){
        var fileUrls = Object.keys(this.queue).filter(function (data){
                return finished !== true ||  (error && errCount < 5) ;
        });
        if (fileUrls.length> 0){
            var fileUrl = fileUrl[0];
            this.fileDownloadAndUpdateStatus(fileUrl, this.downloadAllSegments);
        } else {
            fileUrls = Object.keys(this.queue).filter(function (data){
                return finished === true;
            });

            if (fileUrls.length == Object.keys(this.queue).length){
                this.emit('finished', this.options);
            } else {
                this.emit('error', this.options, this.queue);
            }
        }
    }; 

    this.startDownload = function(){
        var parser = m3u8.createStream();
        //TODO:: This will be able to read HLS File as stream 
        parser.on('item', function(item) {
            // emits PlaylistItem, MediaItem, StreamItem, and IframeStreamItem
            var fileUrl = item.uri;
            this.queue[fileUrl] = {started : false, errCount : 0};
        });
        parser.on('m3u', function(m3u) {
            // fully parsed m3u file  Now start Downloading files 
            this.downloadAllSegments();
        });

        http.get(this.options, function (response){
            response.pipe(parser);
        });
    };
 };

util.inherits(module.exports , EventEmitter);





