// ==UserScript==
// @name         youku-needjs
// @description  Play Videos with html5 on youku.com
// @include      http://v.youku.com/*
// @version      1.24
// @license      GPLv3
// @author       goowaMie
// @email        gsushzhsosgsu@gmail.com
// @run-at       document-end
// @grant        none
// ==/UserScript==

/**
 * 1.24 2013.5.11
 * This script supports chromium and opera, and needs javascript to be enabled.
 * 1.23 2013.5.11
 * Metadata changed.
 * 1.22 2013.4.11
 * Support Greasemonkey 1.8.
 * 1.21 2013.3.27
 * Add autoscroll for video playlist.
 * 1.20 2013.3.18
 * Add @grant, @run-at segment.
 * Main page no need to enable js environment.
 * 1.19 2013.3.5
 * Fix: failed to hide the none existed videos.
 *    - hd = []; hd === [] // will return false, so we have to use
 *      hd.length > 0 to check that array not empty.
 * 1.18 2013.3.5
 * Fix: failed to display different video formats. Replacing that with yk.
 * 1.17 2013.3.3
 * Fix the z-index bug.
 * 1.16 2013.3.3
 * Using that to replace yk in a subfunction.
 * 1.15 2013.3.3
 * 修复了部分播放列表无法使用的问题;
 * Beautify and redesign this program;
 * 1.14 2013.1.31
 * 加入了生成pls列表文件的功能;
 * 取消了对youku.com的依赖;
 * 1.13 2013.1.25
 * 修复unsafeWindow的问题;
 * 修改了label与input的位置关系, 以方便点击;
 * 1.12 2012.10.1
 * 修改了标题的命名方式
 * 1.11 2012.7.21
 * 修改了显示面版的字符长度, 使标题能全部显示;
 * 修改了圆角及与页边的距离;
 * 1.10 2012.4.2
 * 修正部分v.youku.com/v_playlist错误;
 * 修正视频下载列表的显示;
 * v1.9 2012.3.28
 * 修正iceweasel中格式的选择问题;
 * v1.8
 * 修正了URL编码问题; 选择格式时自动调节播话器尺寸; 2012.2.23
 * v1.7
 * 加入了对v_playlist的支持;
 * v1.6
 * 优化了启动优先级;
 * v1.5
 * 视频格式的选择更简单;
 * 加入 '下载' 按纽, 用于下载m3u列表;
 * 修改@include 链接, 以支持v.youku.com/v_playlist/*;
 * v1.4
 * 给<video>加了一个box-shadow; 
 * 加入自动播放flv的效果;
 * 加入关灯时自动将panel隐藏到右下角的效果;
 * 修正了mp4, hd2格式的url无法获取的bug;
 * 移除了yk.checkFormat() 函数;
 * 优化了格式选择的效果;
 * v1.3
 * 更新了UI; 支持视频格式的选择;
 * v1.2
 * 支持Firefox 及 Opera, 生成m3u播放列表;
 * v1.1
 * 加入<video> 移除flash;
 * v1.0
 * 2012.2.11
 */

var uw = unsafeWindow,
    log = uw.console.log,
    error = uw.console.error;

var yk = {
  /** store xhr result, with json format **/
  json: false,

  /** store video formats and its urls **/
  formats: {
    'flv': [],
    'mp4': [],
    'hd2': [],
  },

  /** video title **/
  title: false,

  /** store video id **/
  videoId: false,

  /** video format choosed by used: flv/mp4/hd2, flv is default **/
  choice: 'flv',

  /**
   * Program starter
   */
  run: function() {
    this.getVideoId();
    if (this.videoId === false) {
      error('Failed to get videoId!');
      return false;
    }

    /**
     * When getPlayList get response, it will call decodeURL().
     * And decodeURL() will call createUI().
     */
    //log('before getPlayList() -- ', this);
    this.getPlayList();
  },

  /**
   * Get video id, and stored in yk.videoId.
   *
   * Page url for playing page almost like this:
   *   http://v.youku.com/v_show/id_XMjY1OTk1ODY0.html
   *   http://v.youku.com/v_playlist/f17273995o1p0.html
   */
  getVideoId: function() {
    var urlReg = /(?:id_)(.*)(?:.html)/, 
        urlReg2 = /(?:v_playlist\/f)(.*)(?:o1p\d.html)/,
        match = false;
        //prefix = 'http://v.youku.com/player/getPlayList/VideoIDS/';

    if (urlReg.test(uw.location.href)) {
      match = urlReg.exec(uw.location.href);
    } else if (urlReg2.test(uw.location.href)) {
      match = urlReg2.exec(uw.location.href);
    } else {
      return false;
    }

    if (match.length === 2) {
      this.videoId = match[1];
    }
  },

  /**
   * Get video playlist.
   * 
   * This functions post an xhr request.
   */
  getPlayList: function() {
    var plsURL = 'http://v.youku.com/player/getPlayList/VideoIDS/' + 
                  this.videoId,
        xhr = new XMLHttpRequest(),
        that = this;
    
    xhr.open('GET', plsURL);
    xhr.onreadystatechange = function() {
      log('xhr: ', xhr);
      if (xhr.readyState === 4 && xhr.status === 200) {
        //log('xhr response: ', xhr.response);
        that.json = JSON.parse(xhr.response);
        that.decodeURL();
      }
    };
    xhr.send();
  },

  /**
   * Decrypted the video link from json object.
   */
  decodeURL: function() {
    var urlPrefix = 'http://f.youku.com/player/getFlvPath/sid/' +
          '00_00/st/',
        url,
        title,
        fileId,
        format,
        formats,
        json,
        tmp,
        i,
        j;
    
    if (this.json === false) {
      error('Failed to get json object!');
      return false;
    }

    json = this.json.data[0];
    // 设定视频的标题;
    this.title = json.title;
    // 检测可用的格式;
    if (json.segs.flv && json.segs.flv.length) {
      formats = ['flv'];
    }

    if (json.segs.mp4 && json.segs.mp4.length) {
      formats[1] = 'mp4';
    }

    if (json.segs.hd2 && json.segs.hd2.length) {
      formats[2] = 'hd2';
    }

    for (i = 0; format = formats[i]; i += 1) {
      fileId = this.getFileId(json.seed, json.streamfileids[format]);
      for (j = 0; j < json.segs[format].length; j += 1) {
        // 修正了编码问题, 应该用十六进制的序号;
        //
        fileId = fileId.slice(0, 9) + j.toString(16).toUpperCase() + 
                 fileId.slice(10);
        // 修正hd2的格式命名问题;
        tmp = format;
        if (tmp === 'hd2') {
          tmp = 'flv';
        }
        url = urlPrefix + tmp + '/fileid/' + fileId + '?K=' + 
          json.segs[format][j].k + ',k2:' + 
          json.segs[format][j].k2;

        this.formats[format][j] = url;
      }
    }

    // 调用UI函数;
    this.createUI();
  },

  /**
   * Get file id of each video file.
   *
   * This function is the key to decode youku video source.
   * @param string seed
   *  - the file seed number.
   * @param string fileId
   *  - file Id.
   * @return string
   *  - return decrypted file id.
   */
  getFileId: function(seed, fileId) {
    var mixed = getFileIdMixed(seed),
        ids = fileId.split('\*'),
        len = ids.length - 1,
        realId = '',
        idx,
        i;
    
    function getFileIdMixed(seed) {
      var mixed = [],
          source = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP' +
                   'QRSTUVWXYZ/\\:._-1234567890',
          len = source.length,
          index,
          i;
    
      for (i = 0; i < len; i += 1) {
          seed = (seed * 211 + 30031) % 65536;
          index = Math.floor(seed / 65536 * source.length);
          mixed.push(source.charAt(index));
          source = source.replace(source.charAt(index), '');
      }
      return mixed;
    }

    for (i = 0; i < len; i += 1) {
      idx = parseInt(ids[i]);
      realId += mixed[idx];
    }
    return realId;
  },


  /**
   * Create User interface.
   *
   * This function is called in decodeURL().
   */
  createUI: function() {
    // 检查可用的视频格式;
    this.createPanel();
    this.createPlaylist();
  },

  /**
   * Create a new <style> tag with str as its content.
   * @param string styleText
   *   - The <style> tag content.
   */
  addStyle: function(styleText) {
    var style = uw.document.createElement('style');
    if (uw.document.head) {
      uw.document.head.appendChild(style);
      style.innerHTML = styleText;
    }
  },

  /**
   * Create the control panel.
   */
  createPanel: function() {
    var panel = uw.document.createElement('div');

    uw.document.body.appendChild(panel);
    panel.className = 'yk-panel';
    this.addStyle([
      '.yk-panel {',
        'position: fixed; ',
        'right: 10px; ',
        'bottom: 10px; ',
        'z-index: 99999; ',
        'border: 2px solid #ccc; ',
        'border-top-left-radius: 14px; ',
        'margin: 10px 0px 0px 0px; ',
        'padding: 10px; ',
        'background-color: #fff; ',
        'overflow-y: hidden; ',
        'max-height: 90%; ',
        'min-width: 100px; ',
        'min-height: 120px; ',
      '}',
      '.yk-panel:hover {',
        'overflow-y: auto; ',
      '}',
      '.yk-label {',
        'margin-right: 10px;',
      '}'
    ].join(''));

    panel.innerHTML = [
      '<form id="chooseFormat">',
        '<label for="chooseFlv" class="yk-label">',
          '<input type="radio" id="chooseFlv" name="formatChoice" checked="checked" />',
          '<span>标清</span>',
        '</label>',
        '<label style="display: none;" for="chooseMp4" class="yk-label">',
          '<input type="radio" id="chooseMp4" name="formatChoice" />',
          '<span>高清</span>',
        '</label>',
        '<label style="display: none;" for="chooseHd2" class="yk-label">',
          '<input type="radio" id="chooseHd2" name="formatChoice" />',
          '<span>超清</span>',
        '</label>',
        '<a id="pls-link" href="#">Get playlist</a>',
      '</form>', 
      '<div id="playlist"></div>',
    ].join('');
  },

  /**
   * Create the playlist.
   */
  createPlaylist: function() {
    var tmp,
        that = this,
        i,
        chooseFlv = uw.document.getElementById('chooseFlv'),
        chooseMp4 = uw.document.getElementById('chooseMp4'),
        chooseHd2 = uw.document.getElementById('chooseHd2'); 
      
    log(this.formats);
    // 显示flv 格式的列表;
    if (this.formats.flv.length > 0) {
      // Default: show flv videos.
      this.modifyList('flv');
      chooseFlv.addEventListener('change', function() {
        that.modifyList('flv');
      }, false);
    }

    // mp4 格式的列表;
    if (this.formats.mp4.length > 0 ) {
      chooseMp4.parentNode.style.display = 'inline';
      chooseMp4.addEventListener('change', function() {
        that.modifyList('mp4');
      }, false);
    }
    // hd2 格式的列表;
    if (this.formats.hd2.length > 0) {
      chooseHd2.parentNode.style.display = 'inline';
      chooseHd2.addEventListener('change', function() {
        that.modifyList('hd2');
      }, false);
    }
  },
    
  /**
   * Modify the playlist content.
   *
   * Empty playlist first, add the new links of specific video format.
   * @param string format 
   *  - specific video format.
   */
  modifyList: function(format) {
    var classes = {
          'flv': 'playlistFlv', 
          'mp4': 'playlistMp4', 
          'hd2': 'playlistHd2',
        },
        playlist = uw.document.getElementById('playlist'),
        tmp, 
        url,
        i;
    
    // 清空内容;
    playlist.innerHTML = '';

    for (i = 0; url = this.formats[format][i]; i += 1) {
      tmp = uw.document.createElement('a');
      playlist.appendChild(tmp);
      tmp.className = classes[format];
      tmp.style.display = 'block';
      tmp.href = url;
      //tmp.id = classes[format] + i;
      if (i < 9) {
        tmp.innerHTML = this.title + '(0' + String(i + 1) + ')';
      } else {
        tmp.innerHTML = this.title + '(' + String(i + 1) + ')';
      }
      //tmp.innerHTML = String(i + 1) + ') ' + yk.title;
        //yk.title.substring(0, 9);
    }

    // Refresh m3u playlist file.
    uw.document.getElementById('pls-link').href = this.plsDataScheme(format);
  },

  /**
   * Generate Playlist using base64 and Data URI scheme.
   * So that we can download directly and same it as a pls file using HTML.
   * URL:http://en.wikipedia.org/wiki/Data_URI_scheme
   * @param string format
   *  - the video format.
   * @return string
   *  - Data scheme containting playlist.
   */
  plsDataScheme: function(format) {
    return 'data:audio/x-scpls;charset=UTF-8;base64,' + 
           this.base64.encode(this.generatePls(format));
  },

  /**
   * Generate pls - a multimedia playlist file, like m3u.
   * @param string format
   *  - the video format.
   * @return string
   *  - playlist content.
   */
  generatePls: function(format) {
    var output = '',
        videos = this.formats[format],
        len = videos.length,
        i = 0;

    output += '[Playlist]\n';
    output += 'NumberOfEntries=' + len + '\n';
    for (i = 0; i < len; i += 1) {
      output += 'File' + (i+1) + '=' + videos[i] + '\n';
    }
    return output;
  },

  /**
   * base64 function wrap
   * usage: base64.encode(str); base64.decode(base64_str);
   */
  base64: {
    encodeChars : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrs' +
      'tuvwxyz0123456789+/',
    decodeChars : [
  　　-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  　　-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  　　-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63,
  　　52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
  　　-1,　0,　1,　2,　3,  4,　5,　6,　7,　8,　9, 10, 11, 12, 13, 14,
  　　15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1,
  　　-1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
  　　41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1],

    encodeFunction: function(str) {
    　　var out = '',
        len = str.length,
        i = 0,
        c1,
        c2,
        c3;
    
      while(i < len) {
        c1 = str.charCodeAt(i++) & 0xff;
        if(i === len) {
          out += this.encodeChars.charAt(c1 >> 2);
          out += this.encodeChars.charAt((c1 & 0x3) << 4);
          out += "==";
          break;
        }
        c2 = str.charCodeAt(i++);
        if(i === len) {
          out += this.encodeChars.charAt(c1 >> 2);
          out += this.encodeChars.charAt(((c1 & 0x3)<< 4) | 
              ((c2 & 0xF0) >> 4));
          out += this.encodeChars.charAt((c2 & 0xF) << 2);
          out += "=";
          break;
        }
        c3 = str.charCodeAt(i++);
        out += this.encodeChars.charAt(c1 >> 2);
        out += this.encodeChars.charAt(((c1 & 0x3)<< 4) |
            ((c2 & 0xF0) >> 4));
        out += this.encodeChars.charAt(((c2 & 0xF) << 2) |
            ((c3 & 0xC0) >>6));
        out += this.encodeChars.charAt(c3 & 0x3F);
      }
      return out;
    },

    decodeFunction: function(str) {
      var c1,
        c2,
        c3,
        c4,
        len = str.length,
        out = '',
        i = 0;

      while(i < len) {
        do {
          c1 = this.decodeChars[str.charCodeAt(i++) & 0xff];
        } while(i < len && c1 === -1);
        if(c1 === -1) {
          break;
        }

        do {
          c2 = this.decodeChars[str.charCodeAt(i++) & 0xff];
        } while(i < len && c2 === -1);
        if(c2 === -1) {
          break;
        }
        out += String.fromCharCode((c1 << 2) |
            ((c2 & 0x30) >> 4));
        
        do { 
          c3 = str.charCodeAt(i++) & 0xff;
          if(c3 === 61) {
            return out;
          }
          c3 = this.decodeChars[c3];
        } while(i < len && c3 === -1);
        if(c3 === -1) {
          break;
        }
        out += String.fromCharCode(((c2 & 0XF) << 4) |
            ((c3 & 0x3C) >> 2));

        do { 
          c4 = str.charCodeAt(i++) & 0xff;
          if(c4 === 61) {
            return out;
          }
          c4 = this.decodeChars[c4];
        } while(i < len && c4 === -1);
        if(c4 === -1) {
          break;
        }
        out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
      };
      return out;
    },

    utf16to8: function(str) {
      var out = '',
        len = str.length,
        i,
        c;

      for(i = 0; i < len; i++) {
        c = str.charCodeAt(i);
        if ((c >= 0x0001) && (c <= 0x007F)) {
          out += str.charAt(i);
        } else if (c > 0x07FF) {
          out += String.fromCharCode(0xE0 | ((c >> 12) & 0x0F));
          out += String.fromCharCode(0x80 | ((c >>　6) & 0x3F));
          out += String.fromCharCode(0x80 | ((c >>　0) & 0x3F));
        } else {
          out += String.fromCharCode(0xC0 | ((c >>　6) & 0x1F));
          out += String.fromCharCode(0x80 | ((c >>　0) & 0x3F));
        }
      }
      return out;
    },

    utf8to16: function(str) {
    　　var out = '',
        len = str.length,
        i = 0,
        c,
        char2,
        char3;
    
      while(i < len) {
        c = str.charCodeAt(i++);
        switch(c >> 4) {
        // 0xxxxxxx
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          out += str.charAt(i - 1);
          break;
        // 110x xxxx　 10xx xxxx
        case 12: case 13:
          char2 = str.charCodeAt(i++);
          out += String.fromCharCode(((c & 0x1F) << 6) |
              (char2 & 0x3F));
          break;
        // 1110 xxxx　10xx xxxx　10xx xxxx
        case 14:
          char2 = str.charCodeAt(i++);
          char3 = str.charCodeAt(i++);
          out += String.fromCharCode(((c & 0x0F) << 12) |
            ((char2 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
          break;
        }
      }
      return out;
    },

    // This is encode/decode wrap, which convert chars between UTF-8
    // and UTF-16;
    encode: function(str) {
      return this.encodeFunction(this.utf16to8(str));
    },

    decode: function(str) {
      return this.utf8to16(this.decodeFunction(str));
    },
  },

/** end of yk **/
};

/** loader **/
yk.run();
