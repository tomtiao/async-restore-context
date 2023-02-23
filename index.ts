// Helper start
type OkResult<T> = { error: undefined, value: T }
type ErrResult<E> = { error: E, value: undefined }
type Result<T, E> =
    | ErrResult<E>
    | OkResult<T>

type OkAsyncResult<T> = { error: undefined, result: T, instance: undefined }
type ErrAsyncResult<T, E> = { error: E, result: undefined, instance: Generator<Promise<T>, Promise<T>, T> }
type AsyncResult<T, E> =
    | OkAsyncResult<T>
    | ErrAsyncResult<T, E>

class Connection {
    static connections: Map<string, Connection> = new Map();

    id: string;
    constructor(id: string) {
        this.id = id;
    }

    static create(userId: string) {
        const connection = new Connection(userId);
        this.connections.set(userId, connection);
        return connection;
    }

    static get(userId: string) {
        return this.connections.get(userId);
    }

    connectionCb: ((...args: unknown[]) => unknown)[] = [];
    onConnected(cb: (...args: any[]) => any) {
        this.connectionCb.push(cb);
    }

    disconnectCb: ((...args: unknown[]) => unknown)[] = [];
    onDisconnected(cb: (...args: unknown[]) => unknown) {
        this.disconnectCb.push(cb);
    }

    connect() {
        this.connectionCb.forEach((cb) => cb(this.id));
    }

    disconnect() {
        this.disconnectCb.forEach((cb) => cb());
        Connection.connections.delete(this.id);
    }
}

class Serializer {
    static serialize(id: string, o: unknown) {
        globalThis.localStorage.setItem(id, JSON.stringify(o));
    }
    static deserialize(id: string) {
        return JSON.parse(globalThis.localStorage.getItem(id)!);
    }
    static has(id: string) {
        return globalThis.localStorage.getItem(id) !== null;
    }
    static delete(id: string) {
        globalThis.localStorage.removeItem(id);
    }
}

function co<T, E>(gen: (...args: any[]) => Generator<Promise<T>, Promise<T>, T>, args: any[]) {
    return execute(gen(...args), undefined as E, undefined as T);
}
// Helper end

function* coreLogic(prevState?: unknown): Generator<Promise<number>, Promise<number>, number> {
    let state;
    if (prevState) {
        state = prevState;
    } else {
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
        } catch {
            continue;
        }
    }
    // 某些计算
    console.log("此前状态", state);

    return Promise.resolve(result);
}

function choose() {
    return new Promise<number>((resolve, reject) => {
        const current = Connection.get(currentId);
        current!.onDisconnected(() => {
            reject(new Error("用户断线"));
        });

        // 用户成功输入
        input!.addEventListener("click", () => {
            resolve(Math.trunc(Math.random() * 43));
        }, { once: true });
    });
}

function execute<T, E>(
    gen: Generator<Promise<T>, Promise<T>, T>,
    err: E | undefined,
    v: T | undefined,
    resume = false
): Promise<AsyncResult<T, E>> {
    let value: Promise<T>, done: boolean;

    if (err) {
        if (resume) {
            ({ value, done = false } = gen.throw(err));
        } else {
            return Promise.resolve({ error: err, result: undefined, instance: gen });
        }
    } else {
        ({ value, done = false } = gen.next(v as T));
    }

    if (done) {
        return value.then(
            (v) => Promise.resolve({ error: undefined, result: v, instance: undefined }),
            (err) => Promise.resolve({ error: err, result: undefined, instance: gen })
        );
    }

    return value.then(
        (v) => execute(gen, undefined as E, v),
        (err) => execute(gen, err, undefined)
    );
}

const abnormal: Map<string, ErrAsyncResult<number, Error>> = new Map();

const currentId = 'a';

async function mainLoop(id: string) {
    let result: AsyncResult<number, Error>;
    if (abnormal.has(id)) {
        const prevResult = abnormal.get(id)!;
        abnormal.delete(id);

        result = await execute(prevResult.instance, prevResult.error, undefined, true);
    } else if (Serializer.has(id)) {
        result = await co(coreLogic, [Serializer.deserialize(id)]);
    } else {
        result = await co(coreLogic, []);
    }

    if (result.error) {
        console.error(result.error);
        // 用户断线，保存
        abnormal.set(id, {
            instance: result.instance,
            error: result.error,
            result: undefined
        });
        return;
    }
    // 正常结束
    Serializer.delete(id);
    console.log("编号", id, "结果", result.result);
}

let connectionStatus: 0 | 1 | 2 = 0;

// UI start
const statusP = document.querySelector("#status");
function updateStatusText() {
    switch (connectionStatus) {
        case 0:
            statusP!.textContent = "状态：已断开";
            break;
        case 1:
            statusP!.textContent = "状态：已连接。等待输入…";
            break;
        case 2:
            statusP!.textContent = "状态：已连接。用户已输入";
            break;
    }
}

const toggleConnect = document.querySelector("#user-toggle-connect");
toggleConnect!.addEventListener("click", () => {
    if (connectionStatus === 0) {
        const conn = Connection.create(currentId);
        conn.onConnected(mainLoop);
        conn.connect();
        connectionStatus += 1;
        updateStatusText();
    } else if (connectionStatus === 1 || connectionStatus === 2) {
        Connection.get(currentId)?.disconnect();
        connectionStatus = 0;
        updateStatusText();
    }
});

const input = document.querySelector("#user-input");
input!.addEventListener("click", () => {
    if (connectionStatus === 1) {
        connectionStatus += 1;
        updateStatusText();
    }
});

const refresh = document.querySelector("#refresh");
refresh?.addEventListener("click", () => {
    globalThis.location.reload();
});

const clear = document.querySelector("#clear-storage");
clear?.addEventListener("click", () => {
    globalThis.localStorage.clear();
});

updateStatusText();
// UI end