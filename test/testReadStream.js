// 文件 1.txt 内容为 0123456789
const fs = require("fs");
const ReadStream = require("../ReadStream");

// 创建可读流
let rs = new ReadStream("test/1.txt", {
    encoding: "utf8",
    start: 0,
    end: 5,
    highWaterMark: 2
});

rs.on("open", () => console.log("open"));

rs.on("data", data => {
    console.log(data, new Date());
    rs.pause();
});

rs.on("end", () => console.log("end"));
rs.on("close", () => console.log("close"));
rs.on("error", err => console.log(err));

let i = 0;
let id = setInterval(() => {
  if (i++ < 5) {
    rs.resume();
  } else {
    clearInterval(id);
  }
}, 1000);

// open
// 01 2020-06-03T14:17:04.602Z
// 23 2020-06-03T14:17:05.607Z
// 45 2020-06-03T14:17:06.613Z
// end
// close