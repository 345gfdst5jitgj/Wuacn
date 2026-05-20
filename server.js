const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 托管静态前端
app.use(express.static(__dirname));

// 存储全网在线的真实节点数据
const activeNodes = {};

io.on('connection', (socket) => {
    // 1. 节点上线：为其登记其真实 ID 和加密公钥
    socket.on('node:online', ({ username, publicKey }) => {
        activeNodes[socket.id] = {
            id: socket.id, // 这就是用户的真实全网唯一通讯 ID
            username: username,
            publicKey: publicKey
        };
        console.log(`🌐 节点上线: [${username}] ID: ${socket.id}`);
        // 广播更新全网在线人数，但不强行插入假人
        io.emit('system:count', Object.keys(activeNodes).length);
    });

    // 2. 真实 ID 搜索机制：允许用户输入 ID 查找目标
    socket.on('node:search', (targetId, callback) => {
        const targetNode = activeNodes[targetId];
        if (targetNode) {
            callback({ success: true, node: { id: targetNode.id, username: targetNode.username, publicKey: targetNode.publicKey } });
        } else {
            callback({ success: false, message: "未找到该节点 ID，请检查是否输入正确或对方已下线" });
        }
    });

    // 3. 点对点私密流转发
    socket.on('chat:private_stream', ({ toId, encryptedMsg }) => {
        if (activeNodes[toId] && io.sockets.sockets.get(toId)) {
            io.to(toId).emit('chat:receive_stream', {
                fromId: socket.id,
                fromUsername: activeNodes[socket.id].username,
                encryptedMsg: encryptedMsg
            });
        }
    });

    // 4. 输入状态实时互传
    socket.on('chat:typing_state', ({ toId, isTyping }) => {
        io.to(toId).emit('chat:typing_relay', { fromId: socket.id, isTyping });
    });

    // 5. 离线清理
    socket.on('disconnect', () => {
        if (activeNodes[socket.id]) {
            console.log(`❌ 节点下线: ID: ${socket.id}`);
            delete activeNodes[socket.id];
            io.emit('system:count', Object.keys(activeNodes).length);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 赛博加密通讯核心已跑在: http://localhost:${PORT}`);
});
