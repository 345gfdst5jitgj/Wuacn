const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// 解除大文件传输限制，调高缓冲区
const io = new Server(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 
});

app.use(express.static(__dirname));
const activeNodes = {};

io.on('connection', (socket) => {
    socket.on('node:online', ({ username, publicKey }) => {
        activeNodes[socket.id] = { id: socket.id, username, publicKey };
        console.log(`🌐 节点接入: [${username}] ID: ${socket.id}`);
        io.emit('system:count', Object.keys(activeNodes).length);
    });

    socket.on('node:search', (targetId, callback) => {
        const target = activeNodes[targetId];
        if (target) {
            callback({ success: true, node: { id: target.id, username: target.username, publicKey: target.publicKey } });
        } else {
            callback({ success: false, message: "目标节点未在线或 ID 错误" });
        }
    });

    // 转发多媒体与文本混合加密流
    socket.on('chat:private_stream', ({ toId, encryptedMsg, msgType, fileName }) => {
        if (activeNodes[toId] && io.sockets.sockets.get(toId)) {
            io.to(toId).emit('chat:receive_stream', {
                fromId: socket.id,
                fromUsername: activeNodes[socket.id].username,
                encryptedMsg,
                msgType,
                fileName
            });
        }
    });

    // 实时已读回执中转
    socket.on('chat:read_receipt', ({ toId, msgId }) => {
        io.to(toId).emit('chat:read_relay', { fromId: socket.id, msgId });
    });

    // WebRTC 实时语音信令中转
    socket.on('rtc:signal', ({ toId, signalData }) => {
        io.to(toId).emit('rtc:signal_relay', { fromId: socket.id, signalData });
    });

    socket.on('chat:typing_state', ({ toId, isTyping }) => {
        io.to(toId).emit('chat:typing_relay', { fromId: socket.id, isTyping });
    });

    socket.on('disconnect', () => {
        if (activeNodes[socket.id]) {
            delete activeNodes[socket.id];
            io.emit('system:count', Object.keys(activeNodes).length);
        }
    });
});

server.listen(3000, () => console.log(`🚀 终极版全栈核心运行于: http://localhost:3000`));
