const EventEmitter = require('events');
const fs = require('fs');

class ReadStream extends EventEmitter {
  constructor (path, options = {}) {
    super();

    this.path = path; // 读取文件的路径
    this.flags = options.flags || "r"; // 文件标识位，r：打开文件用于读取。 如果文件不存在，则会发生异常。
    this.encoding = options.encoding || null; // 字符编码
    this.fd = options.fd || null; // 文件描述符
    this.mode = options.mode || 0o666; // 权限位，0o666（可读写）
    this.autoClose = options.autoClose || true; // 是否自动关闭
    this.start = options.start || 0; // 读取文件的起始位置
    this.end = options.end || null; // 读取文件的结束位置（包含）
    this.highWaterMark = options.highWaterMark || 64 * 1024; // 每次读取文件的字节数

    this.flowing = false; // 控制当前是否是流动状态，默认为暂停状态
    this.buffer = Buffer.alloc(this.highWaterMark); // 存储读取内容的 Buffer
    this.pos = this.start; // 下次读取文件的位置（变化的）
    this.isEnd = false; // 是否结束

    // 创建可读流要打开文件
    this.open();


    // 如果监听了 data 事件，切换为流动状态
    this.on("newListener", type => {
      if (type === "data") {
        this.flowing = true;

        // 开始读取文件
        this.read();
      }
    });
  }

  open () {
    fs.open(this.path, this.flags, this.mode, (err, fd) => {
      if (err) {
        this.emit('error', err);

        if (this.autoClose) {
          // 关闭文件（触发 close 事件）
          this.destroy();
        }
        
        return;
      }

      this.fd = fd;
      this.emit('open')
    });
  }

  destroy () {
    if (typeof this.fd === 'number') {
      fs.close(this.fd, () => {});
    }

    this.emit("close");

    this.isEnd = true;
  }

  read () {
    // 由于 open 异步执行，read 执行可能早于 open，此时不存在文件描述符
    if (typeof this.fd !== 'number') {
      // 监听 open 方法中用 emit 触发的 open 事件，重新执行 read
      return this.once('open', () => this.read());
    }

    let howMuchToRead = this.end
      ? Math.min(this.highWaterMark, this.end - this.pos + 1)
      : this.highWaterMark;

    // 读取文件
    fs.read(
      this.fd,
      this.buffer, // 要被写入的 buffer
      0, // buffer 中开始写入的偏移量
      howMuchToRead,
      this.pos,
      (err, bytesRead) => { // bytesRead: 读取的字节数
        if (err) {
          this.emit('error', err);
          
          if (this.autoClose) {
            // 关闭文件（触发 close 事件）
            this.destroy();
          }
          
          return;
        }

        // 如果读到内容执行下面代码，读不到则触发 end 事件并关闭文件
        if (bytesRead > 0) {

          // 维护下次读取文件位置
          this.pos += bytesRead;

          // 保留有效的 Buffer，因为 buffer 覆盖时可能含有旧数据
          let realBuf = this.buffer.slice(0, bytesRead);

          // 根据编码处理 data 回调返回的数据
          realBuf = this.encoding ? realBuf.toString(this.encoding) : realBuf;

          // 触发 data 事件并传递数据
          this.emit('data', realBuf);

          // 递归读取
          if (this.flowing) {
            this.read();
          }

        } else {
          this.isEnd = true;
          this.emit('end'); // 触发 end 事件
          this.destroy(); // 关闭文件
        }
      }
    );
  }

  pause () {
    this.flowing = false;
  }

  resume () {
    this.flowing = true;
    if (!this.isEnd) this.read();
  }
}

module.exports = ReadStream;