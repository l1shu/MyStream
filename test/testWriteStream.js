// 向 1.txt 文件中写入 012345
const fs = require("fs");
const WriteStream = require("../WriteStream");

// 创建可写流
let ws = new WriteStream("test/2.txt", {
    highWaterMark: 3
});

let i = 0;

function write() {
    let flag = true;
    while (i < 6 && flag) {
        flag = ws.write(i++ + "", "utf8");
        console.log(flag);
    }
}

ws.on("drain", function() {
    console.log("写入成功");
    write();
});
write();

ws.on('error', () => {console.log(err)})

// true
// true
// false
// 写入成功
// true
// true
// false
// 写入成功