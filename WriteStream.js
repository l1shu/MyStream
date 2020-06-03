const EventEmitter = require("events");
const fs = require("fs");

class WriteStream extends EventEmitter {
  constructor (path, options = {}) {
    super();

    this.path = path; // 写入文件的路径
    this.flags = options.flags || "w"; // 文件标识位, w: 打开文件用于写入。 如果文件不存在则创建文件，如果文件存在则截断文件。
    this.encoding = options.encoding || "utf8"; // 字符编码
    this.fd = options.fd || null; // 文件描述符
    this.mode = options.mode || 0o666; // 权限位, 0o666（可读写）
    this.autoClose = options.autoClose || true; // 是否自动关闭
    this.start = options.start || 0; // 写入文件的起始位置
    this.highWaterMark = options.highWaterMark || 16 * 1024; // 对比写入字节数的标识

    this.writing = false; // 是否正在写入
    this.buffers = []; // 缓存，正在写入就存入缓存中
    this.len = 0; // 当前缓存中 Buffer 总共的字节数
    this.pos = this.start; // 下次写入文件的位置（变化的）

    // 创建可写流要打开文件
    this.open();
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

  /**
   * 多次执行 write 时
   * 默认第一次真正写入文件
   * 其他的都写入缓存，再一个一个的将缓存中存储的 Buffer 写入并从缓存清空
   */
  write (chunk, encoding = this.encoding, callback) {
    chunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    this.len += chunk.length;

    if (this.writing) {
      this.buffers.push({
        chunk,
        encoding,
        callback
      });
    } else {
      // 更改标识为正在写入，再次写入的时候走缓存
      this.writing = true;
      // 如果已经写入, 清空缓存区的内容
      this._write(chunk, encoding, () => this.clearBuffer());
    }

    return (this.len < this.highWaterMark);
  }

  _write (chunk, encoding, callback) {
    // 由于 open 异步执行，write 执行可能早于 open，此时不存在文件描述符
    if (typeof this.fd !== "number") {
      // 因为 open 用 emit 触发了 open 事件，所以在这是重新执行 write
      return this.once("open", () => this._write(chunk, encoding, callback));
    }

    // 写入文件
    fs.write(
      this.fd,
      chunk, // 要写入的 buffer
      0, // buffer中的偏移量
      chunk.length, // 要写入的字节数
      this.pos,
      (err, bytesWritten) => { // bytesWritten：从 buffer 中被写入的字节数
        if (err) {
          this.emit('error', err);
          
          if (this.autoClose) {
            // 关闭文件（触发 close 事件）
            this.destroy();
          }
          
          return;
        }

        this.pos += bytesWritten;
        this.len -= bytesWritten;
        callback();
      }
    );
  }

  clearBuffer () {
    // 先写入的在数组前面，从前面取出缓存中的 Buffer
    let buf = this.buffers.shift();

    // 如果存在 buf，证明缓存还有 Buffer 需要写入
    if (buf) {
      // 递归 _write 按照编码将数据写入文件
      this._write(buf.chunk, buf.encoding, () => this.clearBuffer());
    } else {
      // 下次（非同步）调用 write 方法时默认第一次真正写入文件
      this.writing = false;

      // 如果没有 buf，说明缓存内的内容已经完全写入文件并清空，需要触发 drain 事件
      this.emit("drain");
    }
  }
}

module.exports = WriteStream;