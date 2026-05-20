const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// 限制传输大小为 50mb 保证高清图片端到端加密大流顺畅
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 5e7
});

app.use(express.static(__dirname));

const activeNodes = {};

io.on('connection', (socket) => {
    console.log(`📡 设备接入核心: ${socket.id}`);

    // 节点登记上线
    socket.on('node:online', ({ username, publicKey }) => {
        activeNodes[socket.id] = { id: socket.id, username, publicKey };
        io.emit('system:count', Object.keys(activeNodes).length);
        console.log(`🌐 节点激活: [${username}] ID: ${socket.id}`);
    });

    // 搜索真实存在的节点
    socket.on('node:search', (targetId, callback) => {
        const node = activeNodes[targetId];
        if (node) {
            callback({ success: true, node: { id: node.id, username: node.username, publicKey: node.publicKey } });
        } else {
            callback({ success: false, message: "⚠️ 未找到该节点特征码，对方可能未接入网络或已下线" });
        }
    });

    // 端到端私密流转发（支持文字、富文本与图片乱码大流）
    socket.on('chat:private_stream', ({ toId, msgId, encryptedMsg, msgType }) => {
        if (activeNodes[toId] && io.sockets.sockets.get(toId)) {
            io.to(toId).emit('chat:receive_stream', {
                fromId: socket.id,
                fromUsername: activeNodes[socket.id].username,
                msgId,
                encryptedMsg,
                msgType
            });
        }
    });

    // 状态流：正在输入状态同步
    socket.on('chat:typing_state', ({ toId, isTyping }) => {
        io.to(toId).emit('chat:typing_relay', { fromId: socket.id, isTyping });
    });

    // 状态流：消息已读状态回执中转
    socket.on('chat:read_receipt', ({ toId, msgId }) => {
        io.to(toId).emit('chat:read_receipt_relay', { fromId: socket.id, msgId });
    });

    // 状态流：安全撤回特定消息
    socket.on('chat:recall_req', ({ toId, msgId }) => {
        io.to(toId).emit('chat:recall_relay', { fromId: socket.id, msgId });
    });

    socket.on('disconnect', () => {
        if (activeNodes[socket.id]) {
            console.log(`❌ 节点断开: ID: ${socket.id}`);
            delete activeNodes[socket.id];
            io.emit('system:count', Object.keys(activeNodes).length);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`============ MESSENGER PRO CYBER CORE RUNNING ============`);
    console.log(`🚀 专属高安全通信控制台已就绪: http://localhost:${PORT}`);
    console.log(`==========================================================`);
});
