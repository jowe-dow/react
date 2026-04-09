# 03. Hooks 实现机制

> 源码文件：`packages/react-reconciler/src/ReactFiberHooks.js`

## 概述

**学习目标**：
- 理解 Hook 链表结构及其与 Fiber 节点的关系
- 掌握 `useState` 挂载与更新的完整流程
- 理解 `useEffect` 与 `useLayoutEffect` 的执行时机差异
- 弄清楚"为什么 Hooks 不能在条件语句中调用"的底层原因

---

## Hook 链表结构

每个函数组件的 `fiber.memoizedState` 字段指向该组件所有 Hook 的**链表头节点**。

```js
// 单个 Hook 节点的数据结构
type Hook = {
  memoizedState: any,       // 当前状态值
                            //   useState: 状态值本身
                            //   useEffect: effect 对象
                            //   useRef: { current: value }
                            //   useMemo: [value, deps]
                            //   useCallback: [fn, deps]

  baseState: any,           // 跳过低优先级更新后的基础状态
  baseQueue: Update | null, // 因优先级不足被跳过的更新队列

  queue: UpdateQueue | null, // 更新队列（环形链表，见下文）
  next: Hook | null,         // 指向下一个 Hook
};
```

对于以下组件：

```jsx
function Counter() {
  const [count, setCount] = useState(0);    // Hook 1
  const [name, setName] = useState('React');// Hook 2
  useEffect(() => { ... }, [count]);         // Hook 3
  const ref = useRef(null);                  // Hook 4
  // ...
}
```

对应的 `fiber.memoizedState` 链表：

```
fiber.memoizedState
  └── Hook1 (useState: count=0)
        next → Hook2 (useState: name='React')
                 next → Hook3 (useEffect: {create, deps, next...})
                           next → Hook4 (useRef: {current: null})
                                    next → null
```

> **这就是为什么 Hooks 不能在条件语句中使用**：React 每次渲染时按顺序取 Hook 节点，如果某次渲染跳过了一个 Hook（条件为 false），后续所有 Hook 都会错位，取到错误的状态！

---

## Hooks Dispatcher 切换机制

React 用不同的 `dispatcher` 区分挂载（mount）和更新（update）阶段：

```js
// 挂载阶段（首次渲染）
const HooksDispatcherOnMount = {
  useState: mountState,
  useEffect: mountEffect,
  useRef: mountRef,
  useMemo: mountMemo,
  // ...
};

// 更新阶段（重新渲染）
const HooksDispatcherOnUpdate = {
  useState: updateState,
  useEffect: updateEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  // ...
};

// 渲染函数组件时切换 dispatcher
ReactSharedInternals.H = workInProgress.alternate === null
  ? HooksDispatcherOnMount
  : HooksDispatcherOnUpdate;
```

---

## useState 完整生命周期

### 挂载阶段（mountState）

**源码位置**：L1894（`mountStateImpl`）、L1922（`mountState`）

```js
function mountStateImpl<S>(initialState: (() => S) | S): Hook {
  // 1. 创建新的 Hook 节点，追加到 fiber.memoizedState 链表尾部
  const hook = mountWorkInProgressHook();

  // 2. 支持惰性初始化（只在首次渲染执行一次）
  if (typeof initialState === 'function') {
    // useState(() => computeExpensiveValue())
    initialState = initialState();
  }

  // 3. 初始化状态和更新队列
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,       // 待处理的 Update 环形链表
    lanes: NoLanes,      // 队列中 Update 的 Lane 集合
    dispatch: null,      // setCount 函数（后面绑定）
    lastRenderedReducer: basicStateReducer,  // (state, action) => action
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  return hook;
}

function mountState<S>(initialState: (() => S) | S): [S, Dispatch<...>] {
  const hook = mountStateImpl(initialState);
  const queue = hook.queue;

  // 绑定 dispatch：闭包捕获当前 fiber 和 queue
  const dispatch: Dispatch<...> = dispatchSetState.bind(
    null,
    currentlyRenderingFiber,  // 当前渲染的 fiber
    queue,
  );
  queue.dispatch = dispatch;

  // 返回 [当前状态, setter函数]
  return [hook.memoizedState, dispatch];
}
```

关键函数 `mountWorkInProgressHook`：

```js
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // 链表为空，这是第一个 Hook
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 追加到链表尾部
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```

### 触发更新（dispatchSetState）

当用户调用 `setCount(1)` 时：

```js
function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,   // 新的值，或 (prevState) => newState 函数
): void {
  // 1. 分配优先级 Lane
  const lane = requestUpdateLane(fiber);

  // 2. 创建 Update 对象
  const update: Update<S, A> = {
    lane,
    revertLane: NoLane,
    action,        // 保存用户传入的新值或更新函数
    hasEagerState: false,
    eagerState: null,
    next: (null: any),
  };

  // 3. 优化：如果当前没有进行中的渲染，尝试提前计算新值
  //    如果新值等于旧值，跳过重新渲染！
  if (isRenderPhaseUpdate(fiber)) {
    // 渲染阶段触发的更新（如在render中调用 setState）
    didScheduleRenderPhaseUpdateDuringPass = true;
    update.lane = mergeLanes(lane, renderLane);
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    const alternate = fiber.alternate;
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      // 当前没有待处理的更新，提前计算新值（Eager State 优化）
      const lastRenderedReducer = queue.lastRenderedReducer;
      const currentState = queue.lastRenderedState;
      const eagerState = lastRenderedReducer(currentState, action);
      update.hasEagerState = true;
      update.eagerState = eagerState;

      if (is(eagerState, currentState)) {
        // 新值 === 旧值，直接退出，不触发重新渲染！
        enqueueConcurrentHookUpdateAndEagerlyBailout(fiber, queue, update);
        return;
      }
    }

    // 4. 将 Update 推入并发队列
    const root = enqueueConcurrentHookUpdate(fiber, queue, update, lane);
    if (root !== null) {
      // 5. 调度渲染
      scheduleUpdateOnFiber(root, fiber, lane);
    }
  }
}
```

### 更新阶段（updateState → updateReducer）

**源码位置**：L1936（`updateState`）

```js
function updateState<S>(initialState: ...): [S, Dispatch<...>] {
  // useState 本质上是 reducer 固定为 (state, action) => action 的 useReducer
  return updateReducer(basicStateReducer, initialState);
}

function updateReducer<S, I, A>(reducer, initialArg, init?): [S, Dispatch<A>] {
  // 1. 取当前 Hook 节点（按顺序，从链表头开始）
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  queue.lastRenderedReducer = reducer;

  // 2. 消费 pending 环形链表
  const current: Hook = (currentHook: any);
  let baseQueue = current.baseQueue;

  // 将渲染期间新来的 Update 与已有 baseQueue 合并
  const pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // pending 是环形链表（pending.next 指向链表头）
    if (baseQueue !== null) {
      // 将 pendingQueue 接在 baseQueue 后面
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  // 3. 遍历消费 Update 链表，计算新状态
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;

    do {
      const updateLane = removeLanes(update.lane, OffscreenLane);

      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不足：跳过这个 Update，保留到 baseQueue
        const clone: Update<S, A> = {
          lane: updateLane,
          revertLane: update.revertLane,
          action: update.action,
          hasEagerState: update.hasEagerState,
          eagerState: update.eagerState,
          next: (null: any),
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
      } else {
        // 优先级足够：执行这个 Update
        if (update.hasEagerState) {
          // 已经提前计算好了，直接用
          newState = update.eagerState;
        } else {
          newState = reducer(newState, update.action);
        }
      }
      update = update.next;
    } while (update !== null && update !== first);

    // 4. 更新 Hook 状态
    hook.memoizedState = newState;
    hook.baseState = newBaseState === null ? newState : newBaseState;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }

  const dispatch = queue.dispatch;
  return [hook.memoizedState, dispatch];
}
```

---

## useEffect 实现机制

### 挂载阶段（mountEffect）

```js
function mountEffect(create, deps) {
  mountEffectImpl(
    PassiveEffect | PassiveStaticEffect,  // flags
    HookPassive,                          // hookFlags
    create,
    deps,
  );
}

function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 给 fiber 打上 PassiveEffect 标记
  currentlyRenderingFiber.flags |= fiberFlags;

  // effect 对象存在 hook.memoizedState
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,  // 首次挂载，标记为需要执行
    create,
    createEffectInstance(),
    nextDeps,
  );
}
```

### effect 对象结构

```js
type Effect = {
  tag: HookFlags,        // HookHasEffect（需要执行）| HookPassive | HookLayout
  create: () => (() => void) | void,  // 用户的 effect 函数
  inst: EffectInstance,  // { destroy: null }（存放清理函数）
  deps: Array<mixed> | null,          // 依赖数组
  next: Effect,          // 链表，指向下一个 effect
};
```

### 更新阶段：依赖对比

```js
function updateEffect(create, deps) {
  updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const effect: Effect = hook.memoizedState;
  const inst = effect.inst;

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevEffect: Effect = currentHook.memoizedState;
      const prevDeps = prevEffect.deps;

      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // deps 没变 → 不标记 HookHasEffect，commit 阶段跳过执行
        hook.memoizedState = pushEffect(hookFlags, create, inst, nextDeps);
        return;
      }
    }
  }

  // deps 变了 → 标记 HookHasEffect，commit 阶段执行
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushEffect(
    HookHasEffect | hookFlags,
    create,
    inst,
    nextDeps,
  );
}

// deps 对比（Object.is 浅比较）
function areHookInputsEqual(nextDeps, prevDeps) {
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (is(nextDeps[i], prevDeps[i])) {  // Object.is
      continue;
    }
    return false;
  }
  return true;
}
```

---

## useEffect vs useLayoutEffect

| 特性 | `useEffect` | `useLayoutEffect` |
|------|-------------|-------------------|
| Hook flags | `HookPassive` | `HookLayout` |
| Fiber flags | `PassiveEffect` | `UpdateEffect` |
| 执行时机 | commit 后**异步**（宏任务） | commit Mutation 阶段后**同步** |
| 阻塞浏览器绘制 | ❌ | ✅（在绘制前执行） |
| 读取 DOM 尺寸 | ⚠️ 可能有闪烁 | ✅ 推荐 |
| 服务端渲染 | ✅ 安全 | ⚠️ 会有警告 |
| 类比 | `componentDidMount`（异步版）| `componentDidMount`（同步版）|

**执行顺序示例**：

```jsx
function Child() {
  useLayoutEffect(() => {
    console.log('3. Child useLayoutEffect');
    return () => console.log('Child useLayoutEffect cleanup');
  }, []);

  useEffect(() => {
    console.log('5. Child useEffect');
    return () => console.log('Child useEffect cleanup');
  }, []);

  return <div />;
}

function Parent() {
  useLayoutEffect(() => {
    console.log('4. Parent useLayoutEffect');
  }, []);

  useEffect(() => {
    console.log('6. Parent useEffect');
  }, []);

  return <Child />;
}

// 输出顺序：
// 1. render Child
// 2. render Parent
// 3. Child useLayoutEffect     ← commit layout 阶段（自下而上）
// 4. Parent useLayoutEffect
// 5. 浏览器绘制
// 6. Child useEffect           ← commit 完成后异步执行
// 7. Parent useEffect
```

---

## 其他常用 Hooks 简析

### useRef

```js
function mountRef<T>(initialValue: T): {current: T} {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;  // 返回同一个对象引用，不会因重新渲染而变化
}

function updateRef<T>(initialValue: T): {current: T} {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;  // 直接返回，不做任何处理
}
```

`useRef` 之所以不触发重新渲染，是因为修改 `ref.current` 不调用任何 setter，React 不感知此变化。

### useMemo

```js
function mountMemo<T>(nextCreate: () => T, deps): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();  // 立即执行
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState;

  if (nextDeps !== null) {
    const prevDeps = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];  // deps 未变，返回缓存值
    }
  }

  const nextValue = nextCreate();  // deps 变了，重新计算
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
```

---

## 关键要点

1. **Hook 链表**：`fiber.memoizedState` 是链表头，按 Hook 调用顺序串联，必须保证每次渲染顺序一致
2. **mount vs update**：通过切换 dispatcher 实现，mount 创建节点，update 复用节点并计算新值
3. **Environment State**：Update 以环形链表存在 `queue.pending`，更新时展开并按 Lane 过滤消费
4. **Eager State 优化**：`setCount(sameValue)` 不触发重渲染（`Object.is` 提前比较）
5. **useEffect 异步**：通过 Scheduler 的 `NormalPriority` 任务异步调度，不阻塞绘制

---

## 下一章

→ [04. Diff 算法](./04-diff.md) — 了解 React 如何对比新旧 Fiber 树，最小化 DOM 操作
