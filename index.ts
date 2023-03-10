// Helper start

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

    static createdCb: ((id: string) => unknown)[] = [];

    static onConnectionCreated(cb: (id: string) => unknown) {
        this.createdCb.push(cb);
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
        Connection.createdCb.forEach((cb) => cb(this.id));
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

function co<T = unknown, E = any>(
    gen: (...args: any[]) => Generator<Promise<T>, Promise<T>, T>,
    args: any[]
): Promise<AsyncResult<T, E>> {
    return execute(gen(...args), undefined, undefined as T);
}
// Helper end

function* coreLogic(prevState?: unknown): Generator<Promise<number>, Promise<number>, number> {
    let state;
    if (prevState) {
        state = prevState;
    } else {
        // ????????????
        state = Math.trunc(Math.random() * 115);
    }
    console.log("??????", state);
    Serializer.serialize(currentId, state);

    let result: number;
    while (true) {
        try {
            result = yield choose();
            break;
        } catch {
            continue;
        }
    }
    // ????????????
    console.log("????????????", state);

    return Promise.resolve(result);
}

function choose() {
    return new Promise<number>((resolve, reject) => {
        const current = Connection.get(currentId);
        current!.onDisconnected(() => {
            reject(new Error("????????????"));
        });

        // ??????????????????
        onInputOnce(() => {
            resolve(Math.trunc(Math.random() * 43));
        });
    });
}

function execute<T = unknown, E = any>(
    gen: Generator<Promise<T>, Promise<T>, T>,
    err: E,
    v: undefined,
    resume?: boolean
): Promise<AsyncResult<T, E>>;
function execute<T = unknown, E = any>(
    gen: Generator<Promise<T>, Promise<T>, T>,
    err: undefined,
    v: T,
    resume?: false
): Promise<AsyncResult<T, E>>;
function execute<T, E>(
    gen: Generator<Promise<T>, Promise<T>, T>,
    err: E,
    v: T,
    resume = false
): Promise<AsyncResult<T, E>> {
    let value: Promise<T>, done: boolean;

    if (err !== undefined) {
        if (resume) {
            ({ value, done = false } = gen.throw(err));
        } else {
            return Promise.resolve({ error: err, result: undefined, instance: gen });
        }
    } else {
        ({ value, done = false } = gen.next(v));
    }

    if (done) {
        return value.then(
            (v) => Promise.resolve({ error: undefined, result: v, instance: undefined }),
            (err) => Promise.resolve({ error: err, result: undefined, instance: gen })
        );
    }

    return value.then(
        (v) => execute(gen, undefined, v),
        (err) => execute(gen, err, undefined)
    );
}

const abnormal: Map<string, ErrAsyncResult<number, Error>> = new Map();

const currentId = 'a';

async function mainLoop() {
    while (true) {
        const id = await new Promise<string>((resolve) => {
            Connection.onConnectionCreated(
                (id) => resolve(id)
            );
        });

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
            // ?????????????????????
            abnormal.set(id, result);
            continue;
        }
        // ????????????
        console.log("??????", id, "??????", result.result);        
    }
}

mainLoop();

let connectionStatus: 0 | 1 | 2 = 0;

// UI start
const statusP = document.querySelector("#status");
function updateStatusText() {
    switch (connectionStatus) {
        case 0:
            statusP!.textContent = "??????????????????";
            break;
        case 1:
            statusP!.textContent = "????????????????????????????????????";
            break;
        case 2:
            statusP!.textContent = "????????????????????????????????????";
            break;
    }
}

function onInputOnce(cb: (...args: unknown[]) => void) {
    input!.addEventListener("click", cb, { once: true });
}

const toggleConnect = document.querySelector("#user-toggle-connect");
toggleConnect!.addEventListener("click", () => {
    if (connectionStatus === 0) {
        const conn = Connection.create(currentId);
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
refresh!.addEventListener("click", () => {
    globalThis.location.reload();
});

const clear = document.querySelector("#clear-storage");
clear!.addEventListener("click", () => {
    globalThis.localStorage.clear();
});

updateStatusText();
// UI end