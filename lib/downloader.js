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
    this.baseUrl = options.path.substring(0, options.path.lastIndexOf('/')+1);
    this.done = [];
    if (!fs.existsSync(tmpDir)){
        fs.mkdirSync(tmpDir);
    }
    this.playlistFile = options.path.split('/').pop();
    //TODO ::  If the file Content has changed I want to Download It.
    var  fileDownloadAndUpdateStatus = function (fileUrl, self ,cb){
        var queue = self.queue;
        queue[fileUrl].started = true;
        stats = fs.stat(tmpDir + '/' + fileUrl, function (err, stat){
          if(err === null) {
            console.log('Already Segment is downloaded ' + fileUrl);
            queue[fileUrl].finished = true;
            queue[fileUrl].error = null;
            queue[fileUrl].errorCount = 0;
            cb(self);
          } else if (err.code == 'ENOENT') {
              // file does not existsSync
              var writeStream = fs.createWriteStream(tmpDir + '/' + fileUrl + '.download');
              var options = JSON.parse(JSON.stringify(self.options));
              options.path = self.baseUrl + fileUrl;
              console.log('New Segment to download ' + fileUrl);

              var request = http.get(options, function (response) {
                  response.pipe(writeStream);
                  writeStream.on('finish', function () {
                      if (response.headers['last-modified'])
                          touch.ftouchSync(fd, { 'mtime': new Date(response.headers['last-modified']) });
                      writeStream.close();
                      fs.rename(tmpDir + '/' + fileUrl + '.download', tmpDir + '/' + fileUrl, function (err) {
                          if (!err) {
                              queue[fileUrl].finished = true;
                              queue[fileUrl].error = null;
                              queue[fileUrl].errorCount = 0;
                              cb(self);
                          } else {
                              queue[fileUrl].error = err;
                              queue[fileUrl].errorCount++;
                              cb(self);
                          }
                      });
                  });
              }, function (err) {
                  //TODO :: If an error occur
                  console.log('Error Ocuured in HTTP Get ' + fileUrl);
                  queue[fileUrl].error = err;
                  queue[fileUrl].errorCount++;
                  cb(self);
              }).on('error', function(err){
                console.log(err);
                queue[fileUrl].error = err;
                queue[fileUrl].errorCount++;
                cb(self);
              });

          } else {
            console.log('Some other error: ', err.code);
            queue[fileUrl].error = err;
            queue[fileUrl].errorCount++;
            cb(self);
          }
        });
    };

    var downloadAllSegments = function(self){
        var fileUrls = Object.keys(self.queue).filter(function (data){
            var dd = self.queue[data];
            return dd.finished !== true  &&  dd.errCount < 5 ;
        });
        if (fileUrls.length> 0){
            var filename = fileUrls[0];
            console.log(filename);
            fileDownloadAndUpdateStatus(filename, self, downloadAllSegments);
        } else {
            fileUrls = Object.keys(self.queue).filter(function (data){
                var dd = self.queue[data];
                return dd.finished === true;
            });

            if (fileUrls.length == Object.keys(self.queue).length) {
                self.emit('finished', self.options, self.queue);
            } else {
                self.emit('error', self.options, self.queue);
            }
        }
    };

    this.startDownload = function(){
        console.log('start download called');
        var parser = m3u8.createStream();
        var self = this;
        var writeStream = fs.createWriteStream(tmpDir + '/' + this.playlistFile + '.download');
        //TODO:: This will be able to read HLS File as stream
        parser.on('item', function(item) {
            // emits PlaylistItem, MediaItem, StreamItem, and IframeStreamItem
            var filename = item.properties.uri;
            self.queue[filename] = {started : false, errCount : 0};
        });
        parser.on('m3u', function(m3u) {
           // fully parsed m3u file  Now start Downloading files
           downloadAllSegments(self);
        });     
        parser.on('error', function(){
            console.log('Error occured in parsing m3u8 file. Ignoring ...');
            try{
              var stats = fs.lstatSync(tmpDir + '/' + self.playlistFile);
              if (stats.isFile()) {
                  fs.unlinkSync(tmpDir + '/' + self.playlistFile);
              }
            } catch (err){

            }
            self.emit('error', self.options, self.queue);
        });
        self.options.indexFileName = tmpDir + '/' + self.playlistFile;
        self.options.folderName = tmpDir;
        try {
            // Query the entry
            stats = fs.lstatSync(tmpDir + '/' + self.playlistFile);
            // Is it a directory?
            if (stats.isFile()) {
                console.log('File Already Downloaded' + tmpDir + '/' + self.playlistFile);
                var readStream = fs.createReadStream(tmpDir + '/' + self.playlistFile);
                readStream.pipe(parser);
            }
        }
        catch (e) {
          http.get(self.options, function (response){
            response.pipe(writeStream).on('finish', function (){
                fs.rename(tmpDir + '/' + self.playlistFile + '.download', tmpDir + '/' + self.playlistFile, function (err) {
                console.log('File renamed ' + tmpDir + '/' + self.playlistFile);
                          if (!err) {
                              var readStream = fs.createReadStream(tmpDir + '/' + self.playlistFile);
                              readStream.pipe(parser);
                          } else {
                              self.emit('error', self.options, self.queue);
                              console.log('File renamed  Errorr Occured' + tmpDir + '/' + self.playlistFile);
                          }
               });
            });
          }).on('error', function(err){
            console.log(err);
            self.emit('error', self.options, self.queue);
          });
        }
    };
 };

util.inherits(module.exports , EventEmitter);
