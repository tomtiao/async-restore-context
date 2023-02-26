"use strict";
// Helper start
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class Connection {
    constructor(id) {
        this.connectionCb = [];
        this.disconnectCb = [];
        this.id = id;
    }
    static create(userId) {
        const connection = new Connection(userId);
        this.connections.set(userId, connection);
        return connection;
    }
    static get(userId) {
        return this.connections.get(userId);
    }
    static onConnectionCreated(cb) {
        this.createdCb.push(cb);
    }
    onConnected(cb) {
        this.connectionCb.push(cb);
    }
    onDisconnected(cb) {
        this.disconnectCb.push(cb);
    }
    connect() {
        Connection.createdCb.forEach((cb) => cb(this.id));
        this.connectionCb.forEach((cb) => cb(this.id));
    }
    disconnect() {
        this.disconnectCb.forEach((cb) => cb());
        Connection.connections.delete(this.id);
    }
}
Connection.connections = new Map();
Connection.createdCb = [];
class Serializer {
    static serialize(id, o) {
        globalThis.localStorage.setItem(id, JSON.stringify(o));
    }
    static deserialize(id) {
        return JSON.parse(globalThis.localStorage.getItem(id));
    }
    static has(id) {
        return globalThis.localStorage.getItem(id) !== null;
    }
    static delete(id) {
        globalThis.localStorage.removeItem(id);
    }
}
function co(gen, args) {
    return execute(gen(...args), undefined, undefined);
}
// Helper end
function* coreLogic(prevState) {
    let state;
    if (prevState) {
        state = prevState;
    }
    else {
        // 某些计算
        state = Math.trunc(Math.random() * 115);
    }
    console.log("状态", state);
    Serializer.serialize(currentId, state);
    let result;
    while (true) {
        try {
            result = yield choose();
            break;
        }
        catch (_a) {
            continue;
        }
    }
    // 某些计算
    console.log("此前状态", state);
    return Promise.resolve(result);
}
function choose() {
    return new Promise((resolve, reject) => {
        const current = Connection.get(currentId);
        current.onDisconnected(() => {
            reject(new Error("用户断线"));
        });
        // 用户成功输入
        onInputOnce(() => {
            resolve(Math.trunc(Math.random() * 43));
        });
    });
}
function execute(gen, err, v, resume = false) {
    let value, done;
    if (err !== undefined) {
        if (resume) {
            ({ value, done = false } = gen.throw(err));
        }
        else {
            return Promise.resolve({ error: err, result: undefined, instance: gen });
        }
    }
    else {
        ({ value, done = false } = gen.next(v));
    }
    if (done) {
        return value.then((v) => Promise.resolve({ error: undefined, result: v, instance: undefined }), (err) => Promise.resolve({ error: err, result: undefined, instance: gen }));
    }
    return value.then((v) => execute(gen, undefined, v), (err) => execute(gen, err, undefined));
}
const abnormal = new Map();
const currentId = 'a';
function mainLoop() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const id = yield new Promise((resolve) => {
                Connection.onConnectionCreated((id) => resolve(id));
            });
            let result;
            if (abnormal.has(id)) {
                const prevResult = abnormal.get(id);
                abnormal.delete(id);
                result = yield execute(prevResult.instance, prevResult.error, undefined, true);
            }
            else if (Serializer.has(id)) {
                result = yield co(coreLogic, [Serializer.deserialize(id)]);
            }
            else {
                result = yield co(coreLogic, []);
            }
            if (result.error) {
                console.error(result.error);
                // 用户断线，保存
                abnormal.set(id, result);
                continue;
            }
            // 正常结束
            Serializer.delete(id);
            console.log("编号", id, "结果", result.result);
        }
    });
}
mainLoop();
let connectionStatus = 0;
// UI start
const statusP = document.querySelector("#status");
function updateStatusText() {
    switch (connectionStatus) {
        case 0:
            statusP.textContent = "状态：已断开";
            break;
        case 1:
            statusP.textContent = "状态：已连接。等待输入…";
            break;
        case 2:
            statusP.textContent = "状态：已连接。用户已输入";
            break;
    }
}
function onInputOnce(cb) {
    input.addEventListener("click", cb, { once: true });
}
const toggleConnect = document.querySelector("#user-toggle-connect");
toggleConnect.addEventListener("click", () => {
    var _a;
    if (connectionStatus === 0) {
        const conn = Connection.create(currentId);
        conn.connect();
        connectionStatus += 1;
        updateStatusText();
    }
    else if (connectionStatus === 1 || connectionStatus === 2) {
        (_a = Connection.get(currentId)) === null || _a === void 0 ? void 0 : _a.disconnect();
        connectionStatus = 0;
        updateStatusText();
    }
});
const input = document.querySelector("#user-input");
input.addEventListener("click", () => {
    if (connectionStatus === 1) {
        connectionStatus += 1;
        updateStatusText();
    }
});
const refresh = document.querySelector("#refresh");
refresh.addEventListener("click", () => {
    globalThis.location.reload();
});
const clear = document.querySelector("#clear-storage");
clear.addEventListener("click", () => {
    globalThis.localStorage.clear();
});
updateStatusText();
// UI end
